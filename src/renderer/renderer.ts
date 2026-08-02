import {
  getNativeComponentMetadata,
  isNativeComponent,
  setRef,
  type NativeComponent,
  type Ref,
} from './native'
import {
  captureScopeError,
  createScope,
  flushScopeMounts,
  getReactiveScopeInspectionId,
  isSignal,
  runInScope,
  setReactiveScopeInspection,
  type ReactiveScope,
} from '../core/reactive'
import {
  type ResourceReference,
} from '../winui/resource'
import {
  Fragment,
  isDynamicNode,
  isErrorBoundaryNode,
  isListNode,
  isPortalNode,
  isVNode,
  type Child,
  type VNode,
} from '../core/vnode'
import {
  isNativeItemsRepeaterData,
  type NativeAdapter,
} from './adapters'
import { RendererPropertyService } from './renderer-properties'
import {
  ChildSyncHookError,
  resolveChildAdapter,
  resolveSlotAdapter,
  type ChildAdapter,
  type NativeCollection,
} from './renderer-children'
import {
  RecordState,
  type MountedRecord,
} from './renderer-lifecycle'
import { RendererBoundaryService } from './renderer-boundary'
import { RendererControlFlowService } from './renderer-control-flow'
import {
  RendererItemsRepeaterService,
  type RendererItemsRepeaterController,
} from './renderer-items-repeater'
import {
  describeInspectionError,
  describeInspectionTarget,
  RendererInspectorRuntime,
  type RendererInspector,
  type RendererInspectorOptions,
} from './inspector'

export {
  isNativeCollection,
} from './renderer-children'
export type {
  NativeCollection,
} from './renderer-children'

export interface RendererErrorContext {
  phase:
    | 'create'
    | 'property'
    | 'event'
    | 'children'
    | 'component'
    | 'render'
    | 'portal'
    | 'items-repeater'
    | 'reactive'
  target?: unknown
  property?: string
}

export type NativePropertySetter = (
  target: object,
  value: unknown,
  scope: ReactiveScope,
) => void

export type NativePropertyConverter = (
  target: object,
  value: unknown,
  property: string,
) => unknown

export interface RendererOptions {
  inspector?: RendererInspectorOptions
  releaseNative?: (value: object) => void
  asCollection?: (
    value: unknown,
    owner: object,
  ) => NativeCollection | null | undefined
  createText?: (value: string) => object
  propertySetters?: Record<string, NativePropertySetter>
  propertyConverters?: Record<string, NativePropertyConverter>
  convertProperty?: NativePropertyConverter
  setProperty?: (
    target: object,
    property: string,
    value: unknown,
  ) => boolean
  resolveResource?: (
    key: string,
    fallback: unknown,
    target: object,
    kind: ResourceReference['kind'],
  ) => unknown
  observeResourceChanges?: (
    target: object,
    callback: () => void,
    kind: ResourceReference['kind'],
  ) => void | (() => void)
  getResourceObservationKind?: (
    property: string,
    value: unknown,
    target: object,
  ) => ResourceReference['kind'] | undefined
  onUnknownProperty?: (
    target: object,
    property: string,
    value: unknown,
  ) => void
  onError?: (
    error: unknown,
    context: RendererErrorContext,
  ) => void
}

export interface RenderHandle {
  readonly container: object
  readonly roots: readonly unknown[]
  readonly disposed: boolean
  update(child: Child): void
  dispose(): void
}

export interface RendererDiagnostics {
  readonly nativeCreated: number
  readonly nativeDisposed: number
  readonly activeNative: number
  readonly componentsMounted: number
  readonly componentsDisposed: number
  readonly activeComponents: number
  readonly listEntriesCreated: number
  readonly listEntriesReused: number
}

interface ChildSlot {
  nodes: readonly unknown[]
  record: MountedRecord
}

interface MutableRendererDiagnostics {
  nativeCreated: number
  nativeDisposed: number
  activeNative: number
  componentsMounted: number
  componentsDisposed: number
  activeComponents: number
  listEntriesCreated: number
  listEntriesReused: number
}

class ChildrenController {
  private slots: ChildSlot[] = []
  private current: unknown[]
  private suspended = true
  private disposed = false
  private disposeFailed = false
  private retainedBaseline: unknown[] | undefined

  constructor(
    readonly renderer: Renderer,
    readonly adapter: ChildAdapter,
    readonly scope: ReactiveScope,
    readonly inspector: RendererInspectorRuntime,
    children: Child,
  ) {
    this.current = adapter.snapshot()
    const original = [...this.current]
    try {
      this.mountChildren(children)
      this.suspended = false
      this.synchronize(false)
    }
    catch (error) {
      this.suspended = true
      const cleanupError =
        this.disposeSlots(this.slots)
      let rollbackError: unknown
      try {
        this.current = this.adapter.sync(
          this.current,
          original,
        )
      }
      catch (failure) {
        rollbackError = failure
      }
      const failures = [
        error,
        ...(cleanupError !== undefined
          ? [cleanupError]
          : []),
        ...(rollbackError !== undefined
          ? [rollbackError]
          : []),
      ]
      if (failures.length > 1) {
        const failure = new AggregateError(
          failures,
          'Children mount and rollback failed.',
        )
        this.recordFailure(failure)
        throw failure
      }
      this.retainedBaseline = [...original]
      this.suspended = false
      this.renderer.handleError(
        error,
        { phase: 'children' },
        this.scope,
      )
    }
  }

  get desiredNodes(): readonly unknown[] {
    if (this.disposeFailed) {
      return [...this.current]
    }
    return this.slots.flatMap((slot) => [...slot.nodes])
  }

  get isDisposed(): boolean {
    return this.disposed
  }

  get requiresDisposeRetry(): boolean {
    return this.disposeFailed
  }

  replace(children: Child): void {
    if (this.disposed || this.disposeFailed) {
      throw new Error(
        'Cannot update a render tree whose native detachment failed; retry dispose().',
      )
    }

    this.suspended = true
    const cleanupError = this.disposeSlots(this.slots)
    if (cleanupError !== undefined) {
      this.disposeFailed = true
      this.suspended = false
      this.recordFailure(cleanupError)
      throw cleanupError
    }
    this.slots = []
    this.suspended = false
    let clearError: unknown
    try {
      this.synchronizeTo([], false)
    }
    catch (error) {
      clearError = error
    }
    if (clearError !== undefined) {
      this.disposeFailed = true
      this.recordFailure(clearError)
      throw clearError
    }
    this.retainedBaseline = undefined

    this.suspended = true
    try {
      this.mountChildren(children)
    }
    catch (error) {
      const stagedCleanupError =
        this.disposeSlots(this.slots)
      this.suspended = false
      if (stagedCleanupError !== undefined) {
        if (this.slots.length > 0) {
          this.disposeFailed = true
        }
        const failure = new AggregateError(
          [error, stagedCleanupError],
          'Children replacement mount and cleanup failed.',
        )
        this.recordFailure(failure)
        throw failure
      }
      this.slots = []
      this.recordFailure(error)
      throw error
    }

    this.suspended = false
    try {
      this.synchronize(false)
    }
    catch (error) {
      this.suspended = true
      const stagedCleanupError =
        this.disposeSlots(this.slots)
      let rollbackError: unknown
      try {
        this.current = this.adapter.sync(
          this.current,
          [],
        )
      }
      catch (failure) {
        rollbackError = failure
      }
      this.suspended = false
      if (stagedCleanupError === undefined) {
        this.slots = []
      }
      else if (this.slots.length > 0) {
        this.disposeFailed = true
      }
      const failures = [
        error,
        ...(stagedCleanupError !== undefined
          ? [stagedCleanupError]
          : []),
        ...(rollbackError !== undefined
          ? [rollbackError]
          : []),
      ]
      if (failures.length > 1) {
        const failure = new AggregateError(
          failures,
          'Children replacement and rollback failed.',
        )
        this.recordFailure(failure)
        throw failure
      }
      this.renderer.handleError(
        error,
        { phase: 'children' },
        this.scope,
      )
    }
  }

  private mountChildren(children: Child): void {
    for (const child of flattenChildren(children)) {
      const slot: ChildSlot = {
        nodes: [],
        record: undefined as unknown as MountedRecord,
      }

      slot.record = this.renderer.mount(
        child,
        (nodes) => {
          slot.nodes = nodes
          this.synchronize()
        },
        this.scope,
      )
      this.slots.push(slot)
    }
  }

  dispose(): void {
    if (this.disposed) {
      return
    }

    this.suspended = true
    const cleanupError = this.disposeSlots(this.slots)
    let syncError: unknown
    try {
      this.disposeFailed = false
      this.suspended = false
      this.synchronizeTo(
        this.retainedBaseline ?? [],
        false,
        true,
      )
    }
    catch (error) {
      syncError = error
    }
    if (
      syncError === undefined &&
      this.slots.length === 0
    ) {
      this.disposeFailed = false
      this.disposed = true
    }
    else {
      this.disposeFailed = true
    }
    if (
      cleanupError !== undefined &&
      syncError !== undefined
    ) {
      const failure = new AggregateError(
        [cleanupError, syncError],
        'Children disposal and native synchronization failed.',
      )
      this.recordFailure(failure)
      throw failure
    }
    if (cleanupError !== undefined) {
      this.recordFailure(cleanupError)
      throw cleanupError
    }
    if (syncError !== undefined) {
      this.recordFailure(syncError)
      throw syncError
    }
  }

  private disposeSlots(slots: ChildSlot[]): unknown {
    let firstError: unknown
    const retained: ChildSlot[] = []
    for (const slot of [...slots].reverse()) {
      try {
        slot.record.dispose()
      }
      catch (error) {
        firstError ??= error
      }
      if (!slot.record.disposed) {
        retained.unshift(slot)
      }
    }
    slots.splice(0, slots.length, ...retained)
    return firstError
  }

  private synchronize(handleErrors = true): void {
    this.synchronizeTo(this.desiredNodes, handleErrors)
  }

  private synchronizeTo(
    desired: readonly unknown[],
    handleErrors = true,
    allowCachedCollectionFallback = false,
  ): void {
    if (this.suspended || this.disposed) {
      return
    }

    try {
      this.inspector.record('children.sync', {
        scopeId: getReactiveScopeInspectionId(this.scope),
        target: this.adapter.constructor.name,
        count: desired.length,
      })
      this.current = this.adapter.sync(
        this.current,
        desired,
        allowCachedCollectionFallback,
      )
    } catch (error) {
      const failure =
        error instanceof ChildSyncHookError
          ? error
          : undefined
      if (failure) {
        this.current = failure.synchronized
        error = failure.originalError
      }
      if (!handleErrors) {
        this.recordFailure(error)
        throw error
      }
      this.renderer.handleError(
        error,
        { phase: 'children' },
        this.scope,
      )
    }
  }

  private recordFailure(error: unknown): void {
    this.inspector.record('error', {
      scopeId: getReactiveScopeInspectionId(this.scope),
      target: this.adapter.constructor.name,
      name: 'children',
      errorName: describeInspectionError(error),
    })
  }
}

function flattenChildren(child: Child): Child[] {
  if (Array.isArray(child)) {
    return child.flatMap((entry) => flattenChildren(entry))
  }

  if (child == null || typeof child === 'boolean') {
    return []
  }

  return [child]
}

export class Renderer {
  private readonly counters: MutableRendererDiagnostics = {
    nativeCreated: 0,
    nativeDisposed: 0,
    activeNative: 0,
    componentsMounted: 0,
    componentsDisposed: 0,
    activeComponents: 0,
    listEntriesCreated: 0,
    listEntriesReused: 0,
  }
  private readonly propertyService: RendererPropertyService
  private readonly boundaryService: RendererBoundaryService
  private readonly controlFlowService: RendererControlFlowService
  private readonly itemsRepeaterService:
    RendererItemsRepeaterService
  private readonly inspection: RendererInspectorRuntime
  private readonly rootScopes = new Set<ReactiveScope>()
  readonly inspector: RendererInspector

  constructor(readonly options: RendererOptions = {}) {
    this.inspection =
      new RendererInspectorRuntime(options.inspector)
    this.inspector = Object.freeze({
      snapshot: () =>
        this.inspection.snapshot(
          this.diagnostics,
          [...this.rootScopes],
        ),
      getOperations: () =>
        this.inspection.getOperations(),
      clearOperations: () => {
        this.inspection.clearOperations()
      },
    })
    this.propertyService = new RendererPropertyService(
      options,
      (error, context, scope) => {
        this.handleError(error, context, scope)
      },
      this.inspection,
    )
    this.boundaryService = new RendererBoundaryService({
      mount: (child, onNodesChanged, parentScope) =>
        this.mount(child, onNodesChanged, parentScope),
      mountOwned: (read, onNodesChanged, parentScope) =>
        this.mountOwned(read, onNodesChanged, parentScope),
      mountEmpty: (onNodesChanged) =>
        this.mountEmpty(onNodesChanged),
      handleError: (error, context, scope) => {
        this.handleError(error, context, scope)
      },
    })
    this.controlFlowService = new RendererControlFlowService(
      options,
      {
        mount: (child, onNodesChanged, parentScope) =>
          this.mount(child, onNodesChanged, parentScope),
        mountOwned: (read, onNodesChanged, parentScope) =>
          this.mountOwned(read, onNodesChanged, parentScope),
        createChildrenController: (
          adapter,
          scope,
          children,
        ) => new ChildrenController(
          this,
          adapter,
          scope,
          this.inspection,
          children,
        ),
        handleError: (error, context, scope) => {
          this.handleError(error, context, scope)
        },
        markListEntryCreated: (scope) => {
          this.counters.listEntriesCreated += 1
          this.inspection.record('list.create', {
            scopeId:
              getReactiveScopeInspectionId(scope),
          })
        },
        markListEntryReused: (scope) => {
          this.counters.listEntriesReused += 1
          this.inspection.record('list.reuse', {
            scopeId:
              getReactiveScopeInspectionId(scope),
          })
        },
      },
    )
    this.itemsRepeaterService =
      new RendererItemsRepeaterService({
        createItemController: (
          host,
          scope,
          child,
        ) => {
          const childAdapter = resolveChildAdapter(
            this.options,
            host,
          )
          if (!childAdapter) {
            throw new Error(
              `${host.constructor.name} cannot host an ItemsRepeater item.`,
            )
          }
          return new ChildrenController(
            this,
            childAdapter,
            scope,
            this.inspection,
            child,
          )
        },
        handleError: (error, context, scope) => {
          this.handleError(error, context, scope)
        },
        registerNative: (host, scope) => {
          this.counters.nativeCreated += 1
          this.counters.activeNative += 1
          return this.inspection.registerNode(
            'itemsRepeaterHost',
            describeInspectionTarget(host),
            scope,
          )
        },
        releaseNative: (value, id, owned) => {
          if (owned) {
            this.options.releaseNative?.(value)
          }
          this.counters.nativeDisposed += 1
          this.counters.activeNative -= 1
          this.inspection.releaseNode(id)
        },
      })
  }

  get diagnostics(): RendererDiagnostics {
    return { ...this.counters }
  }

  resetDiagnostics(): void {
    for (const key of Object.keys(this.counters) as Array<
      keyof MutableRendererDiagnostics
    >) {
      this.counters[key] = 0
    }
  }

  render(child: Child, container: object): RenderHandle {
    const adapter = resolveChildAdapter(
      this.options,
      container,
    )
    if (!adapter) {
      throw new Error(
        `${container.constructor.name} cannot host JSX children.`,
      )
    }

    const scope = createScope()
    const containerLabel = describeInspectionTarget(container)
    setReactiveScopeInspection(scope, {
      kind: 'root',
      label: containerLabel,
    })
    this.rootScopes.add(scope)
    const inspectionNode = this.inspection.registerNode(
      'root',
      containerLabel,
      scope,
    )
    this.inspection.record('render.mount', {
      scopeId: getReactiveScopeInspectionId(scope),
      target: containerLabel,
    })
    let controller: ChildrenController
    try {
      controller = new ChildrenController(
        this,
        adapter,
        scope,
        this.inspection,
        child,
      )
    }
    catch (error) {
      this.inspection.releaseNode(inspectionNode)
      this.rootScopes.delete(scope)
      scope.dispose()
      throw error
    }
    let disposed = false
    let disposeFailed = false

    return {
      container,
      get roots() {
        return controller.desiredNodes
      },
      get disposed() {
        return disposed
      },
      update: (nextChild) => {
        if (disposed) {
          throw new Error('Cannot update a disposed render handle.')
        }
        if (disposeFailed) {
          throw new Error(
            'Cannot update a render handle whose disposal failed; retry dispose().',
          )
        }
        this.inspection.record('render.update', {
          scopeId: getReactiveScopeInspectionId(scope),
          target: containerLabel,
        })
        try {
          controller.replace(nextChild)
        }
        catch (error) {
          if (controller.requiresDisposeRetry) {
            disposeFailed = true
          }
          throw error
        }
      },
      dispose: () => {
        if (disposed) {
          return
        }

        let firstError: unknown
        try {
          controller.dispose()
        }
        catch (error) {
          firstError = error
        }
        if (!controller.isDisposed) {
          disposeFailed = true
          if (firstError !== undefined) {
            throw firstError
          }
          throw new Error(
            'Render disposal did not detach the native tree.',
          )
        }
        disposed = true
        disposeFailed = false
        try {
          scope.dispose()
        }
        catch (error) {
          firstError ??= error
        }
        finally {
          this.inspection.releaseNode(inspectionNode)
          this.rootScopes.delete(scope)
          this.inspection.record('render.dispose', {
            scopeId:
              getReactiveScopeInspectionId(scope),
            target: containerLabel,
          })
        }
        if (firstError !== undefined) {
          throw firstError
        }
      },
    }
  }

  mount(
    child: Child,
    onNodesChanged: (nodes: readonly unknown[]) => void,
    parentScope: ReactiveScope,
  ): MountedRecord {
    if (isSignal<Child>(child)) {
      return this.controlFlowService.mountDynamic(
        () => child.value,
        onNodesChanged,
        parentScope,
      )
    }

    if (Array.isArray(child)) {
      return this.mountFragment(
        child,
        onNodesChanged,
        parentScope,
      )
    }

    if (child == null || typeof child === 'boolean') {
      return this.mountEmpty(onNodesChanged)
    }

    if (
      typeof child === 'string' ||
      typeof child === 'number' ||
      typeof child === 'bigint'
    ) {
      return this.mountPrimitive(
        String(child),
        onNodesChanged,
      )
    }

    if (isDynamicNode(child)) {
      return this.controlFlowService.mountDynamic(
        child.read,
        onNodesChanged,
        parentScope,
        child.beforeDispose,
      )
    }

    if (isListNode(child)) {
      return this.controlFlowService.mountList(
        child,
        onNodesChanged,
        parentScope,
      )
    }

    if (isErrorBoundaryNode(child)) {
      return this.boundaryService.mount(
        child,
        onNodesChanged,
        parentScope,
      )
    }

    if (isPortalNode(child)) {
      return this.controlFlowService.mountPortal(
        child,
        onNodesChanged,
        parentScope,
      )
    }

    if (isVNode(child)) {
      if (child.type === Fragment) {
        return this.mountFragment(
          child.props.children,
          onNodesChanged,
          parentScope,
        )
      }

      if (isNativeComponent(child.type)) {
        return this.mountNative(
          child,
          child.type,
          onNodesChanged,
          parentScope,
        )
      }

      if (typeof child.type === 'function') {
        return this.mountComponent(
          child,
          onNodesChanged,
          parentScope,
        )
      }
    }

    throw new TypeError(`Unsupported JSX child: ${String(child)}`)
  }

  handleError(
    error: unknown,
    context: RendererErrorContext,
    scope?: ReactiveScope,
  ): void {
    this.inspection.record('error', {
      ...(scope
        ? {
            scopeId:
              getReactiveScopeInspectionId(scope),
          }
        : {}),
      ...(context.target !== undefined
        ? {
            target:
              describeInspectionTarget(context.target),
          }
        : {}),
      ...(context.property
        ? { property: context.property }
        : {}),
      name: context.phase,
      errorName: describeInspectionError(error),
    })
    if (scope && captureScopeError(scope, error, context)) {
      return
    }

    if (this.options.onError) {
      this.options.onError(error, context)
      return
    }

    throw error
  }

  private mountEmpty(
    onNodesChanged: (nodes: readonly unknown[]) => void,
  ): MountedRecord {
    const record = new RecordState(onNodesChanged, () => {})
    record.setNodes([])
    return record
  }

  private mountPrimitive(
    value: string,
    onNodesChanged: (nodes: readonly unknown[]) => void,
  ): MountedRecord {
    const nativeValue = this.options.createText
      ? this.options.createText(value)
      : value
    const record = new RecordState(onNodesChanged, () => {})
    record.setNodes([nativeValue])
    return record
  }

  private mountFragment(
    children: Child,
    onNodesChanged: (nodes: readonly unknown[]) => void,
    parentScope: ReactiveScope,
  ): MountedRecord {
    const scope = createScope(parentScope)
    setReactiveScopeInspection(scope, {
      kind: 'fragment',
    })
    const slots: ChildSlot[] = []
    let disposed = false
    let suspended = true

    const record = new RecordState(
      onNodesChanged,
      () => {
        disposed = true
        let firstError: unknown
        for (const slot of [...slots].reverse()) {
          try {
            slot.record.dispose()
          }
          catch (error) {
            firstError ??= error
          }
        }
        slots.length = 0
        try {
          scope.dispose()
        }
        catch (error) {
          firstError ??= error
        }
        if (firstError !== undefined) {
          throw firstError
        }
      },
    )

    const update = () => {
      if (!suspended && !disposed) {
        record.setNodes(slots.flatMap((slot) => [...slot.nodes]))
      }
    }

    try {
      for (const child of flattenChildren(children)) {
        const slot: ChildSlot = {
          nodes: [],
          record: undefined as unknown as MountedRecord,
        }
        slot.record = this.mount(
          child,
          (nodes) => {
            slot.nodes = nodes
            update()
          },
          scope,
        )
        slots.push(slot)
      }
    }
    catch (error) {
      let cleanupError: unknown
      for (const slot of slots.reverse()) {
        try {
          slot.record.dispose()
        }
        catch (failure) {
          cleanupError ??= failure
        }
      }
      slots.length = 0
      try {
        scope.dispose()
      }
      catch (failure) {
        cleanupError ??= failure
      }
      if (cleanupError !== undefined) {
        throw new AggregateError(
          [error, cleanupError],
          'Fragment mount and rollback failed.',
        )
      }
      throw error
    }

    suspended = false
    update()
    return record
  }

  private mountOwned(
    createChild: () => Child,
    onNodesChanged: (nodes: readonly unknown[]) => void,
    parentScope: ReactiveScope,
  ): MountedRecord {
    const scope = createScope(parentScope)
    setReactiveScopeInspection(scope, {
      kind: 'owned',
    })
    let child: MountedRecord | undefined

    const record = new RecordState(
      onNodesChanged,
      () => {
        let firstError: unknown
        try {
          child?.dispose()
          child = undefined
        }
        catch (error) {
          firstError = error
        }
        try {
          scope.dispose()
        }
        catch (error) {
          firstError ??= error
        }
        if (firstError !== undefined) {
          throw firstError
        }
      },
      true,
    )

    try {
      const rendered = runInScope(scope, createChild)
      child = this.mount(
        rendered,
        (nodes) => record.setNodes(nodes),
        scope,
      )
      flushScopeMounts(scope)
    } catch (error) {
      let cleanupError: unknown
      try {
        child?.dispose()
        child = undefined
      }
      catch (failure) {
        cleanupError = failure
      }
      try {
        scope.dispose()
      }
      catch (failure) {
        cleanupError ??= failure
      }
      this.handleError(
        cleanupError === undefined
          ? error
          : new AggregateError(
              [error, cleanupError],
              'Owned mount and cleanup failed.',
            ),
        { phase: 'component' },
        parentScope,
      )
    }

    return record
  }

  private mountComponent(
    vnode: VNode,
    onNodesChanged: (nodes: readonly unknown[]) => void,
    parentScope: ReactiveScope,
  ): MountedRecord {
    const scope = createScope(parentScope)
    const componentName =
      (vnode.type as { readonly name?: string }).name ||
      'AnonymousComponent'
    setReactiveScopeInspection(scope, {
      kind: 'component',
      label: componentName,
    })
    const inspectionNode = this.inspection.registerNode(
      'component',
      componentName,
      scope,
    )
    let child: MountedRecord | undefined
    let componentActive = true
    this.counters.componentsMounted += 1
    this.counters.activeComponents += 1

    const markDisposed = () => {
      if (!componentActive) {
        return
      }
      componentActive = false
      this.counters.componentsDisposed += 1
      this.counters.activeComponents -= 1
      this.inspection.releaseNode(inspectionNode)
    }

    const record = new RecordState(
      onNodesChanged,
      () => {
        let firstError: unknown
        try {
          child?.dispose()
          child = undefined
        }
        catch (error) {
          firstError = error
        }
        try {
          scope.dispose()
        }
        catch (error) {
          firstError ??= error
        }
        finally {
          markDisposed()
        }
        if (firstError !== undefined) {
          throw firstError
        }
      },
      true,
    )

    try {
      const rendered = runInScope(
        scope,
        () => (vnode.type as (props: VNode['props']) => Child)(vnode.props),
      )
      child = this.mount(
        rendered,
        (nodes) => record.setNodes(nodes),
        scope,
      )
      flushScopeMounts(scope)
    } catch (error) {
      let cleanupError: unknown
      try {
        child?.dispose()
        child = undefined
      }
      catch (failure) {
        cleanupError = failure
      }
      try {
        scope.dispose()
      }
      catch (failure) {
        cleanupError ??= failure
      }
      finally {
        markDisposed()
      }
      this.handleError(
        cleanupError === undefined
          ? error
          : new AggregateError(
              [error, cleanupError],
              `${componentName} mount and cleanup failed.`,
            ),
        { phase: 'component' },
        parentScope,
      )
    }

    return record
  }

  private mountNative(
    vnode: VNode,
    component: NativeComponent<object, object>,
    onNodesChanged: (nodes: readonly unknown[]) => void,
    parentScope: ReactiveScope,
  ): MountedRecord {
    const scope = createScope(parentScope)
    setReactiveScopeInspection(scope, {
      kind: 'native',
      label: component.displayName,
    })
    const metadata = getNativeComponentMetadata(component)
    const adapters = metadata.options.adapters as
      | Record<string, NativeAdapter<object> | undefined>
      | undefined
    let instance: object

    try {
      instance = metadata.options.create
        ? metadata.options.create()
        : new metadata.constructorType()
      this.counters.nativeCreated += 1
      this.counters.activeNative += 1
    } catch (error) {
      let disposeError: unknown
      try {
        scope.dispose()
      }
      catch (failure) {
        disposeError = failure
      }
      this.handleError(
        disposeError === undefined
          ? error
          : new AggregateError(
              [error, disposeError],
              `${component.displayName} creation and cleanup failed.`,
            ),
        {
        phase: 'create',
        target: component,
        },
        parentScope,
      )
      return this.mountEmpty(onNodesChanged)
    }
    const inspectionNode = this.inspection.registerNode(
      'native',
      component.displayName,
      scope,
    )

    const childControllers: Array<
      ChildrenController | RendererItemsRepeaterController
    > = []
    const ref = vnode.props.ref as Ref<object> | undefined
    let nativeActive = true
    let nativeReleased = false

    const markDisposed = () => {
      if (!nativeActive) {
        return
      }
      nativeActive = false
      this.counters.nativeDisposed += 1
      this.counters.activeNative -= 1
      this.inspection.releaseNode(inspectionNode)
    }

    const record = new RecordState(
      onNodesChanged,
      () => {
        let firstError: unknown
        try {
          scope.dispose()
        }
        catch (error) {
          firstError = error
        }
        const retainedControllers: Array<
          ChildrenController | RendererItemsRepeaterController
        > = []
        for (const controller of childControllers.splice(0)) {
          try {
            controller.dispose()
          }
          catch (error) {
            firstError ??= error
            if (
              controller instanceof ChildrenController &&
              !controller.isDisposed
            ) {
              retainedControllers.push(controller)
            }
          }
        }
        childControllers.push(...retainedControllers)
        if (retainedControllers.length > 0) {
          throw firstError
        }
        try {
          setRef(ref, null)
        }
        catch (error) {
          firstError ??= error
        }
        if (!nativeReleased) {
          try {
            this.options.releaseNative?.(instance)
            nativeReleased = true
          }
          catch (error) {
            firstError ??= error
          }
        }
        if (firstError !== undefined) {
          throw firstError
        }
        markDisposed()
      },
      true,
    )

    try {
      runInScope(scope, () => {
        this.propertyService.applyProperties(
          instance,
          vnode.props,
          metadata.options.setProperty,
          adapters,
          scope,
          'beforeChildren',
        )
        if (scope.disposed) {
          return
        }
        setRef(ref, instance)

        for (
          const [property, descriptor] of
          Object.entries(adapters ?? {})
        ) {
          if (vnode.props[property] == null) {
            continue
          }
          if (descriptor?.kind === 'itemsRepeater') {
            const data = vnode.props[property]
            if (!isNativeItemsRepeaterData(data)) {
              throw new TypeError(
                `${component.displayName}.${property} must be an ItemsRepeater data descriptor.`,
              )
            }
            childControllers.push(
              this.itemsRepeaterService.bind(
                instance,
                data,
                descriptor,
                scope,
              ),
            )
            continue
          }
          if (descriptor?.kind !== 'slot') {
            continue
          }
          const slotAdapter = resolveSlotAdapter(
            this.options,
            instance,
            descriptor,
          )
          if (!slotAdapter) {
            throw new Error(
              `${component.displayName}.${property} cannot host JSX children.`,
            )
          }
          childControllers.push(new ChildrenController(
            this,
            slotAdapter,
            scope,
            this.inspection,
            vnode.props[property] as Child,
          ))
        }

        if (vnode.props.children != null) {
          const childAdapter = metadata.options.children
            ? resolveSlotAdapter(
                this.options,
                instance,
                metadata.options.children,
              )
            : resolveChildAdapter(this.options, instance)
          if (!childAdapter) {
            throw new Error(
              `${component.displayName} does not support JSX children.`,
            )
          }
          childControllers.push(new ChildrenController(
            this,
            childAdapter,
            scope,
            this.inspection,
            vnode.props.children,
          ))
        }

        this.propertyService.applyProperties(
          instance,
          vnode.props,
          metadata.options.setProperty,
          adapters,
          scope,
          'afterChildren',
        )
        if (scope.disposed) {
          return
        }
        this.propertyService.applyEvents(
          instance,
          vnode.props,
          adapters,
          scope,
        )
      })
      if (scope.disposed) {
        record.dispose()
        return record
      }
      record.setNodes([instance])
      if (scope.disposed) {
        record.dispose()
        return record
      }
      runInScope(scope, () => {
        this.propertyService.applyProperties(
          instance,
          vnode.props,
          metadata.options.setProperty,
          adapters,
          scope,
          'afterMount',
        )
      })
      if (scope.disposed) {
        record.dispose()
        return record
      }
    } catch (error) {
      record.dispose()
      this.handleError(error, {
        phase: 'render',
        target: instance,
      }, parentScope)
    }

    return record
  }

}

export function createRenderer(options: RendererOptions = {}): Renderer {
  return new Renderer(options)
}
