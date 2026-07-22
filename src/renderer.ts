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
  isSignal,
  runInScope,
  type ReactiveScope,
} from './reactive'
import {
  type ResourceReference,
} from './resource'
import {
  Fragment,
  isDynamicNode,
  isErrorBoundaryNode,
  isListNode,
  isPortalNode,
  isVNode,
  type Child,
  type VNode,
} from './vnode'
import {
  isNativeItemsRepeaterData,
  type NativeAdapter,
} from './adapters'
import { RendererPropertyService } from './renderer-properties'
import {
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
  private readonly slots: ChildSlot[] = []
  private current: unknown[]
  private suspended = true
  private disposed = false

  constructor(
    readonly renderer: Renderer,
    readonly adapter: ChildAdapter,
    readonly scope: ReactiveScope,
    children: Child,
  ) {
    this.current = adapter.snapshot()
    this.mountChildren(children)
    this.suspended = false
    this.synchronize()
  }

  get desiredNodes(): readonly unknown[] {
    return this.slots.flatMap((slot) => [...slot.nodes])
  }

  replace(children: Child): void {
    if (this.disposed) {
      throw new Error('Cannot update a disposed render tree.')
    }

    this.suspended = true
    const previous = this.slots.splice(0)
    for (const slot of previous.reverse()) {
      slot.record.dispose()
    }

    try {
      this.mountChildren(children)
    } finally {
      this.suspended = false
      this.synchronize()
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
    for (const slot of this.slots.reverse()) {
      slot.record.dispose()
    }
    this.slots.length = 0
    try {
      this.suspended = false
      this.synchronize()
    } finally {
      this.disposed = true
    }
  }

  private synchronize(): void {
    if (this.suspended || this.disposed) {
      return
    }

    try {
      this.current = this.adapter.sync(
        this.current,
        this.desiredNodes,
      )
    } catch (error) {
      this.renderer.handleError(
        error,
        { phase: 'children' },
        this.scope,
      )
    }
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

  constructor(readonly options: RendererOptions = {}) {
    this.propertyService = new RendererPropertyService(
      options,
      (error, context, scope) => {
        this.handleError(error, context, scope)
      },
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
          children,
        ),
        handleError: (error, context, scope) => {
          this.handleError(error, context, scope)
        },
        markListEntryCreated: () => {
          this.counters.listEntriesCreated += 1
        },
        markListEntryReused: () => {
          this.counters.listEntriesReused += 1
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
            child,
          )
        },
        handleError: (error, context, scope) => {
          this.handleError(error, context, scope)
        },
        markNativeCreated: () => {
          this.counters.nativeCreated += 1
          this.counters.activeNative += 1
        },
        markNativeDisposed: () => {
          this.counters.nativeDisposed += 1
          this.counters.activeNative -= 1
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
    const scope = createScope()
    const adapter = resolveChildAdapter(
      this.options,
      container,
    )

    if (!adapter) {
      scope.dispose()
      throw new Error(
        `${container.constructor.name} cannot host JSX children.`,
      )
    }

    const controller = new ChildrenController(
      this,
      adapter,
      scope,
      child,
    )
    let disposed = false

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
        controller.replace(nextChild)
      },
      dispose: () => {
        if (disposed) {
          return
        }

        disposed = true
        try {
          controller.dispose()
        } finally {
          scope.dispose()
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
    const slots: ChildSlot[] = []
    let disposed = false
    let suspended = true

    const record = new RecordState(
      onNodesChanged,
      () => {
        disposed = true
        for (const slot of slots.reverse()) {
          slot.record.dispose()
        }
        slots.length = 0
        scope.dispose()
      },
    )

    const update = () => {
      if (!suspended && !disposed) {
        record.setNodes(slots.flatMap((slot) => [...slot.nodes]))
      }
    }

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
    let child: MountedRecord | undefined

    const record = new RecordState(
      onNodesChanged,
      () => {
        try {
          child?.dispose()
          child = undefined
        } finally {
          scope.dispose()
        }
      },
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
      scope.dispose()
      this.handleError(
        error,
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
    }

    const record = new RecordState(
      onNodesChanged,
      () => {
        try {
          child?.dispose()
          child = undefined
          scope.dispose()
        } finally {
          markDisposed()
        }
      },
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
      scope.dispose()
      markDisposed()
      this.handleError(
        error,
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
      scope.dispose()
      this.handleError(error, {
        phase: 'create',
        target: component,
      }, parentScope)
      return this.mountEmpty(onNodesChanged)
    }

    const childControllers: Array<
      ChildrenController | RendererItemsRepeaterController
    > = []
    const ref = vnode.props.ref as Ref<object> | undefined
    let nativeActive = true

    const markDisposed = () => {
      if (!nativeActive) {
        return
      }
      nativeActive = false
      this.counters.nativeDisposed += 1
      this.counters.activeNative -= 1
    }

    const record = new RecordState(
      onNodesChanged,
      () => {
        try {
          let firstError: unknown
          for (const controller of childControllers.splice(0)) {
            try {
              controller.dispose()
            } catch (error) {
              firstError ??= error
            }
          }
          setRef(ref, null)
          scope.dispose()
          if (firstError !== undefined) {
            throw firstError
          }
        } finally {
          markDisposed()
        }
      },
    )

    try {
      runInScope(scope, () => {
        this.propertyService.applyProperties(
          instance,
          vnode.props,
          metadata.options.setProperty,
          adapters,
          scope,
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
            vnode.props.children,
          ))
        }
      })
      if (scope.disposed) {
        record.dispose()
        return record
      }
      record.setNodes([instance])
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
