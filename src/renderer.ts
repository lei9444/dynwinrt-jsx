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
  effect,
  flushScopeMounts,
  isSignal,
  onCleanup,
  runInScope,
  setScopeErrorHandler,
  signal,
  type ReactiveScope,
  type Signal,
} from './reactive'
import {
  isResourceReference,
  type ResourceReference,
} from './resource'
import {
  Fragment,
  isDynamicNode,
  isErrorBoundaryNode,
  isListNode,
  isPortalNode,
  isVNode,
  type BoundaryErrorContext,
  type Child,
  type ErrorBoundaryNode,
  type Key,
  type ListNode,
  type PortalNode,
  type VNode,
} from './vnode'

export interface NativeCollection {
  readonly length?: number
  readonly size?: number
  getAt?(index: number): unknown
  toArray?(): unknown[]
  insertAt(index: number, value: unknown): void
  removeAt(index: number): void
  append(value: unknown): void
  clear(): void
}

export interface RendererErrorContext {
  phase:
    | 'create'
    | 'property'
    | 'event'
    | 'children'
    | 'component'
    | 'render'
    | 'portal'
    | 'reactive'
  target?: unknown
  property?: string
}

export type NativePropertySetter = (
  target: object,
  value: unknown,
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
  ) => unknown
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

interface MountedRecord {
  readonly nodes: readonly unknown[]
  dispose(): void
}

interface MutableMountedRecord extends MountedRecord {
  setNodes(nodes: readonly unknown[]): void
}

interface ChildAdapter {
  snapshot(): unknown[]
  sync(current: unknown[], desired: readonly unknown[]): unknown[]
}

interface ChildSlot {
  nodes: readonly unknown[]
  record: MountedRecord
}

interface ListEntry<Item> {
  readonly key: Key
  readonly item: Item
  readonly index: Signal<number>
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

const reservedProperties = new Set([
  'children',
  'key',
  'ref',
])

class RecordState implements MutableMountedRecord {
  private currentNodes: readonly unknown[] = []
  private disposed = false

  constructor(
    private readonly onNodesChanged: (nodes: readonly unknown[]) => void,
    private readonly disposeCallback: () => void,
  ) {}

  get nodes(): readonly unknown[] {
    return this.currentNodes
  }

  setNodes(nodes: readonly unknown[]): void {
    if (this.disposed) {
      return
    }

    if (
      this.currentNodes.length === nodes.length &&
      this.currentNodes.every((node, index) => node === nodes[index])
    ) {
      return
    }

    this.currentNodes = [...nodes]
    this.onNodesChanged(this.currentNodes)
  }

  dispose(): void {
    if (this.disposed) {
      return
    }

    this.disposed = true
    try {
      this.disposeCallback()
    } finally {
      this.currentNodes = []
      this.onNodesChanged(this.currentNodes)
    }
  }
}

class CollectionAdapter implements ChildAdapter {
  constructor(readonly collection: NativeCollection) {}

  snapshot(): unknown[] {
    if (typeof this.collection.toArray === 'function') {
      return [...this.collection.toArray()]
    }

    const length = this.collection.length ?? this.collection.size ?? 0
    if (length === 0 || typeof this.collection.getAt !== 'function') {
      return []
    }

    return Array.from(
      { length },
      (_, index) => this.collection.getAt?.(index),
    )
  }

  sync(current: unknown[], desired: readonly unknown[]): unknown[] {
    for (let index = 0; index < desired.length; index += 1) {
      const desiredNode = desired[index]
      if (current[index] === desiredNode) {
        continue
      }

      const existingIndex = current.indexOf(desiredNode, index + 1)
      if (existingIndex >= 0) {
        this.collection.removeAt(existingIndex)
        current.splice(existingIndex, 1)
      }

      if (index === current.length) {
        this.collection.append(desiredNode)
      } else {
        this.collection.insertAt(index, desiredNode)
      }
      current.splice(index, 0, desiredNode)
    }

    while (current.length > desired.length) {
      const index = current.length - 1
      this.collection.removeAt(index)
      current.pop()
    }

    return current
  }
}

class SinglePropertyAdapter implements ChildAdapter {
  constructor(
    readonly owner: Record<string, unknown>,
    readonly property: string,
  ) {}

  snapshot(): unknown[] {
    const value = this.owner[this.property]
    return value == null ? [] : [value]
  }

  sync(current: unknown[], desired: readonly unknown[]): unknown[] {
    if (desired.length > 1) {
      throw new Error(
        `${this.owner.constructor.name}.${this.property} accepts only one JSX child.`,
      )
    }

    const next = desired[0] ?? null
    if (current[0] !== next || current.length !== desired.length) {
      this.owner[this.property] = next
    }

    return next == null ? [] : [next]
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNativeCollection(value: unknown): value is NativeCollection {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.insertAt === 'function' &&
    typeof value.removeAt === 'function' &&
    typeof value.append === 'function' &&
    typeof value.clear === 'function'
  )
}

function isEventProperty(
  target: Record<string, unknown>,
  property: string,
  value: unknown,
): boolean {
  const callback = isSignal(value) ? value.peek() : value
  return (
    property.startsWith('on') &&
    typeof callback === 'function' &&
    typeof target[property] === 'function'
  )
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

  constructor(readonly options: RendererOptions = {}) {}

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
    const adapter = this.resolveChildAdapter(container)

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
      return this.mountDynamic(
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
      return this.mountDynamic(
        child.read,
        onNodesChanged,
        parentScope,
      )
    }

    if (isListNode(child)) {
      return this.mountList(
        child,
        onNodesChanged,
        parentScope,
      )
    }

    if (isErrorBoundaryNode(child)) {
      return this.mountErrorBoundary(
        child,
        onNodesChanged,
        parentScope,
      )
    }

    if (isPortalNode(child)) {
      return this.mountPortal(
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

  private mountDynamic(
    read: () => Child,
    onNodesChanged: (nodes: readonly unknown[]) => void,
    parentScope: ReactiveScope,
  ): MountedRecord {
    const scope = createScope(parentScope)
    let current: MountedRecord | undefined

    const record = new RecordState(
      onNodesChanged,
      () => {
        current?.dispose()
        current = undefined
        scope.dispose()
      },
    )

    runInScope(scope, () => {
      effect(() => {
        current?.dispose()
        current = this.mountOwned(
          read,
          (nodes) => record.setNodes(nodes),
          scope,
        )
      })
    })

    return record
  }

  private mountList<Item>(
    list: ListNode<Item>,
    onNodesChanged: (nodes: readonly unknown[]) => void,
    parentScope: ReactiveScope,
  ): MountedRecord {
    const scope = createScope(parentScope)
    let entries: ListEntry<Item>[] = []
    let fallback: MountedRecord | undefined

    const record = new RecordState(
      onNodesChanged,
      () => {
        fallback?.dispose()
        fallback = undefined
        for (const entry of entries) {
          entry.record.dispose()
        }
        entries = []
        scope.dispose()
      },
    )

    const updateNodes = () => {
      if (fallback) {
        record.setNodes(fallback.nodes)
      } else {
        record.setNodes(entries.flatMap((entry) => [...entry.nodes]))
      }
    }

    runInScope(scope, () => {
      effect(() => {
        const items = list.readItems()
        if (items.length === 0) {
          for (const entry of entries) {
            entry.record.dispose()
          }
          entries = []

          if (!fallback && list.fallback != null) {
            fallback = this.mount(
              list.fallback,
              () => updateNodes(),
              scope,
            )
          }

          updateNodes()
          return
        }

        fallback?.dispose()
        fallback = undefined

        const seenKeys = new Set<Key>()
        const keyedItems = items.map((item, visibleIndex) => {
          const index = list.getSourceIndex(item, visibleIndex)
          const key = list.getKey(item, index)
          if (seenKeys.has(key)) {
            throw new Error(`Duplicate For key: ${String(key)}`)
          }
          seenKeys.add(key)
          return { item, index, key }
        })

        const oldEntries = new Map<Key, ListEntry<Item>>()
        for (const entry of entries) {
          if (oldEntries.has(entry.key)) {
            throw new Error(`Duplicate existing For key: ${String(entry.key)}`)
          }
          oldEntries.set(entry.key, entry)
        }

        const nextEntries: ListEntry<Item>[] = []

        keyedItems.forEach(({ item, index, key }) => {
          const previous = oldEntries.get(key)
          if (
            previous &&
            Object.is(previous.item, item)
          ) {
            oldEntries.delete(key)
            previous.index.value = index
            this.counters.listEntriesReused += 1
            nextEntries.push(previous)
            return
          }

          previous?.record.dispose()
          oldEntries.delete(key)

          const entry: ListEntry<Item> = {
            key,
            item,
            index: signal(index),
            nodes: [],
            record: undefined as unknown as MountedRecord,
          }
          this.counters.listEntriesCreated += 1
          entry.record = this.mountOwned(
            () => list.renderItem(item, entry.index),
            (nodes) => {
              entry.nodes = nodes
              updateNodes()
            },
            scope,
          )
          nextEntries.push(entry)
        })

        for (const entry of oldEntries.values()) {
          entry.record.dispose()
        }

        entries = nextEntries
        updateNodes()
      })
    })

    return record
  }

  private mountErrorBoundary(
    boundary: ErrorBoundaryNode,
    onNodesChanged: (nodes: readonly unknown[]) => void,
    parentScope: ReactiveScope,
  ): MountedRecord {
    const scope = createScope(parentScope)
    let current: MountedRecord | undefined
    let disposed = false
    let mountingPrimary = false
    let transitioning = false
    let showingFallback = false
    let pendingError:
      | {
          error: unknown
          context: BoundaryErrorContext
        }
      | undefined

    const record = new RecordState(
      onNodesChanged,
      () => {
        disposed = true
        transitioning = true
        try {
          setScopeErrorHandler(scope, undefined)
          current?.dispose()
          current = undefined
          scope.dispose()
        } finally {
          transitioning = false
        }
      },
    )

    const normalizeContext = (
      context: unknown,
    ): BoundaryErrorContext => {
      if (
        typeof context === 'object' &&
        context !== null &&
        'phase' in context &&
        typeof (context as { phase?: unknown }).phase === 'string'
      ) {
        return context as BoundaryErrorContext
      }

      return { phase: 'reactive' }
    }

    const mountFallback = (
      error: unknown,
      context: BoundaryErrorContext,
    ) => {
      showingFallback = true
      transitioning = true
      try {
        current = this.mountOwned(
          () => boundary.fallback(error, context),
          (nodes) => record.setNodes(nodes),
          scope,
        )
      } catch (fallbackError) {
        current = this.mountEmpty((nodes) => record.setNodes(nodes))
        this.handleError(
          fallbackError,
          { phase: 'component' },
          parentScope,
        )
      } finally {
        transitioning = false
      }
    }

    const mountPrimary = () => {
      transitioning = true
      current?.dispose()
      current = undefined
      showingFallback = false
      pendingError = undefined
      transitioning = false

      mountingPrimary = true
      const candidate = this.mount(
        boundary.children,
        (nodes) => record.setNodes(nodes),
        scope,
      )
      mountingPrimary = false

      const captured = takePendingError()
      if (captured) {
        candidate.dispose()
        mountFallback(captured.error, captured.context)
      } else {
        current = candidate
      }
    }

    const takePendingError = () => {
      const captured:
        | {
            error: unknown
            context: BoundaryErrorContext
          }
        | undefined = pendingError
      pendingError = undefined
      return captured
    }

    setScopeErrorHandler(scope, (error, rawContext) => {
      if (disposed || transitioning) {
        return false
      }

      const captured = {
        error,
        context: normalizeContext(rawContext),
      }

      if (mountingPrimary) {
        pendingError = captured
        return true
      }

      transitioning = true
      try {
        current?.dispose()
        current = undefined
      } finally {
        transitioning = false
      }
      mountFallback(captured.error, captured.context)
      return true
    })

    mountPrimary()

    if (boundary.readReset) {
      let initialized = false
      let previous: unknown
      runInScope(scope, () => {
        effect(() => {
          const next = boundary.readReset?.()
          if (
            initialized &&
            showingFallback &&
            !Object.is(previous, next)
          ) {
            mountPrimary()
          }
          previous = next
          initialized = true
        })
      })
    }

    return record
  }

  private mountPortal(
    portal: PortalNode,
    onNodesChanged: (nodes: readonly unknown[]) => void,
    parentScope: ReactiveScope,
  ): MountedRecord {
    const scope = createScope(parentScope)
    let controller: ChildrenController | undefined
    let target: object | null | undefined

    const record = new RecordState(
      onNodesChanged,
      () => {
        controller?.dispose()
        controller = undefined
        target = undefined
        scope.dispose()
      },
    )
    record.setNodes([])

    runInScope(scope, () => {
      effect(() => {
        const nextTarget = portal.readTarget()
        if (nextTarget === target) {
          return
        }

        controller?.dispose()
        controller = undefined
        target = nextTarget

        if (!nextTarget) {
          return
        }

        const adapter = this.resolveChildAdapter(nextTarget)
        if (!adapter) {
          throw new Error(
            `${nextTarget.constructor.name} cannot host portal children.`,
          )
        }

        controller = new ChildrenController(
          this,
          adapter,
          scope,
          portal.children,
        )
      }, {
        onError: (error) => {
          this.handleError(
            error,
            { phase: 'portal', target },
            scope,
          )
        },
      })
    })

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

    let childrenController: ChildrenController | undefined
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
          childrenController?.dispose()
          childrenController = undefined
          setRef(ref, null)
          scope.dispose()
        } finally {
          markDisposed()
        }
      },
    )

    try {
      runInScope(scope, () => {
        this.applyProperties(
          instance,
          vnode.props,
          metadata.options.setProperty,
          scope,
        )
        this.applyEvents(instance, vnode.props, scope)
        setRef(ref, instance)

        if (vnode.props.children != null) {
          const adapter = this.resolveChildAdapter(instance)
          if (!adapter) {
            throw new Error(
              `${component.displayName} does not support JSX children.`,
            )
          }

          childrenController = new ChildrenController(
            this,
            adapter,
            scope,
            vnode.props.children,
          )
        }
      })
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

  private applyProperties(
    target: object,
    props: Record<string, unknown>,
    componentSetter:
      | ((
          instance: object,
          property: string,
          value: unknown,
        ) => boolean)
      | undefined,
    scope: ReactiveScope,
  ): void {
    for (const [property, sourceValue] of Object.entries(props)) {
      if (
        reservedProperties.has(property) ||
        isEventProperty(
          target as Record<string, unknown>,
          property,
          sourceValue,
        )
      ) {
        continue
      }

      if (isSignal(sourceValue)) {
        runInScope(scope, () => {
          effect(() => {
            this.assignProperty(
              target,
              property,
              this.resolvePropertyValue(
                target,
                property,
                sourceValue.value,
              ),
              componentSetter,
              scope,
            )
          })
        })
      } else {
        this.assignProperty(
          target,
          property,
          this.resolvePropertyValue(
            target,
            property,
            sourceValue,
          ),
          componentSetter,
          scope,
        )
      }
    }
  }

  private applyEvents(
    target: object,
    props: Record<string, unknown>,
    scope: ReactiveScope,
  ): void {
    const record = target as Record<string, unknown>

    for (const [property, callbackSource] of Object.entries(props)) {
      if (!isEventProperty(record, property, callbackSource)) {
        continue
      }

      try {
        const callback = (...args: unknown[]) => {
          const current = isSignal(callbackSource)
            ? callbackSource.peek()
            : callbackSource
          return (current as (...values: unknown[]) => unknown)(...args)
        }
        const unsubscribe = (
          record[property] as (handler: unknown) => unknown
        ).call(target, callback)

        if (typeof unsubscribe === 'function') {
          runInScope(scope, () => {
            onCleanup(unsubscribe as () => void)
          })
        }
      } catch (error) {
        this.handleError(error, {
          phase: 'event',
          target,
          property,
        }, scope)
      }
    }
  }

  private assignProperty(
    target: object,
    property: string,
    value: unknown,
    componentSetter:
      | ((
          instance: object,
          property: string,
          value: unknown,
        ) => boolean)
      | undefined,
    scope: ReactiveScope,
  ): void {
    try {
      if (componentSetter?.(target, property, value)) {
        return
      }

      const namedSetter = this.options.propertySetters?.[property]
      if (namedSetter) {
        namedSetter(target, value)
        return
      }

      if (this.options.setProperty?.(target, property, value)) {
        return
      }

      if (property in target) {
        ;(target as Record<string, unknown>)[property] = value
        return
      }

      if (this.options.onUnknownProperty) {
        this.options.onUnknownProperty(target, property, value)
        return
      }

      throw new Error(
        `Unknown JSX property ${target.constructor.name}.${property}.`,
      )
    } catch (error) {
      this.handleError(error, {
        phase: 'property',
        target,
        property,
      }, scope)
    }
  }

  private resolvePropertyValue(
    target: object,
    property: string,
    source: unknown,
  ): unknown {
    let value = source

    if (isResourceReference(value)) {
      if (!this.options.resolveResource) {
        if (value.fallback !== undefined) {
          value = value.fallback
        } else {
          throw new Error(
            `No resource resolver is configured for "${value.key}".`,
          )
        }
      } else {
        value = this.options.resolveResource(
          value.key,
          (value as ResourceReference).fallback,
        )
      }
    }

    const namedConverter = this.options.propertyConverters?.[property]
    if (namedConverter) {
      value = namedConverter(target, value, property)
    }

    if (this.options.convertProperty) {
      value = this.options.convertProperty(target, value, property)
    }

    return value
  }

  private resolveChildAdapter(owner: object): ChildAdapter | null {
    const record = owner as Record<string, unknown>

    if ('children' in owner) {
      const adapter = this.collectionAdapter(record.children, owner)
      if (adapter) {
        return adapter
      }
    }

    if ('child' in owner) {
      return new SinglePropertyAdapter(record, 'child')
    }

    if ('content' in owner) {
      return new SinglePropertyAdapter(record, 'content')
    }

    if ('items' in owner) {
      const adapter = this.collectionAdapter(record.items, owner)
      if (adapter) {
        return adapter
      }
    }

    return null
  }

  private collectionAdapter(
    value: unknown,
    owner: object,
  ): CollectionAdapter | null {
    const projected =
      this.options.asCollection?.(value, owner) ??
      (isNativeCollection(value) ? value : null)

    return projected ? new CollectionAdapter(projected) : null
  }
}

export function createRenderer(options: RendererOptions = {}): Renderer {
  return new Renderer(options)
}
