export type Cleanup = () => void

export interface SubscribeOptions {
  immediate?: boolean
}

export interface EffectOptions {
  onError?: (error: unknown) => void
}

export interface ReadonlySignal<T> {
  readonly __dynwinrtSignal: true
  readonly value: T
  peek(): T
  subscribe(listener: (value: T, previous: T) => void, options?: SubscribeOptions): Cleanup
}

export interface Signal<T> extends ReadonlySignal<T> {
  value: T
  set(value: T | ((previous: T) => T)): T
  update(updater: (previous: T) => T): T
}

export type MaybeSignal<T> = T | ReadonlySignal<T>

interface Dependency {
  readonly inspectionId: number
  readonly inspectionListenerCount?: number
  observers: Set<Observer> | undefined
  producer?: Observer
}

type ObserverKind = 'computed' | 'effect'
type ScopeErrorHandler = (
  error: unknown,
  context?: unknown,
) => boolean
type MountCallback = () => void | Cleanup

export interface ReactiveScopeInspectionMetadata {
  readonly kind: string
  readonly label?: string
}

export interface ReactiveScopeInspection {
  readonly id: number
  readonly parentId?: number
  readonly kind: string
  readonly label?: string
  readonly disposed: boolean
  readonly childIds: readonly number[]
  readonly observerIds: readonly number[]
  readonly dependencyIds: readonly number[]
  readonly cleanupCount: number
  readonly pendingMountCount: number
  readonly handlesErrors: boolean
}

export interface ReactiveObserverInspection {
  readonly id: number
  readonly scopeId?: number
  readonly kind: ObserverKind
  readonly dependencyIds: readonly number[]
  readonly outputDependencyId?: number
  readonly running: boolean
  readonly scheduled: boolean
  readonly hasCleanup: boolean
}

export interface ReactiveDependencyInspection {
  readonly id: number
  readonly producerObserverId?: number
  readonly observerIds: readonly number[]
  readonly listenerCount: number
}

export interface ReactiveGraphInspection {
  readonly rootScopeIds: readonly number[]
  readonly scopes: readonly ReactiveScopeInspection[]
  readonly observers: readonly ReactiveObserverInspection[]
  readonly dependencies: readonly ReactiveDependencyInspection[]
}

let nextScopeInspectionId = 1
let nextObserverInspectionId = 1
let nextDependencyInspectionId = 1

class ScopeImpl {
  readonly inspectionId = nextScopeInspectionId++
  children: Set<ScopeImpl> | undefined
  cleanups: Set<Cleanup> | undefined
  values: Map<symbol, unknown> | undefined
  mounts: MountCallback[] | undefined
  observers: Set<Observer> | undefined
  subscribedDependencies:
    Map<Dependency, number> | undefined
  inspectionKind = 'scope'
  inspectionLabel: string | undefined
  errorHandler: ScopeErrorHandler | undefined
  mountsFlushed = false
  disposed = false

  constructor(readonly parent: ScopeImpl | null) {
    parent?.addChild(this)
  }

  addChild(child: ScopeImpl): void {
    ;(this.children ??= new Set()).add(child)
  }

  removeChild(child: ScopeImpl): void {
    this.children?.delete(child)
    if (this.children?.size === 0) {
      this.children = undefined
    }
  }

  addObserver(observer: Observer): void {
    ;(this.observers ??= new Set()).add(observer)
  }

  removeObserver(observer: Observer): void {
    this.observers?.delete(observer)
    if (this.observers?.size === 0) {
      this.observers = undefined
    }
  }

  add(cleanup: Cleanup): Cleanup {
    if (this.disposed) {
      cleanup()
      return () => {}
    }

    let active = true
    const dispose = () => {
      if (!active) {
        return
      }

      active = false
      this.cleanups?.delete(dispose)
      if (this.cleanups?.size === 0) {
        this.cleanups = undefined
      }
      cleanup()
    }

    ;(this.cleanups ??= new Set()).add(dispose)
    return dispose
  }

  addMount(callback: MountCallback): void {
    if (this.disposed) {
      return
    }

    if (this.mountsFlushed) {
      const cleanup = callback()
      if (typeof cleanup === 'function') {
        this.add(cleanup)
      }
      return
    }

    ;(this.mounts ??= []).push(callback)
  }

  addSubscribedDependency(
    dependency: Dependency,
  ): void {
    const dependencies =
      this.subscribedDependencies ??= new Map()
    dependencies.set(
      dependency,
      (dependencies.get(dependency) ?? 0) + 1,
    )
  }

  removeSubscribedDependency(
    dependency: Dependency,
  ): void {
    const count =
      this.subscribedDependencies?.get(dependency) ?? 0
    if (count <= 1) {
      this.subscribedDependencies?.delete(dependency)
      if (this.subscribedDependencies?.size === 0) {
        this.subscribedDependencies = undefined
      }
      return
    }
    this.subscribedDependencies?.set(
      dependency,
      count - 1,
    )
  }

  flushMounts(): void {
    if (this.disposed || this.mountsFlushed) {
      return
    }

    this.mountsFlushed = true
    const callbacks = this.mounts ?? []
    this.mounts = undefined
    for (const callback of callbacks) {
      try {
        const cleanup = callback()
        if (typeof cleanup === 'function') {
          this.add(cleanup)
        }
      } catch (error) {
        if (!reportScopeError(this, error)) {
          throw error
        }
      }
    }
  }

  dispose(): void {
    if (this.disposed) {
      return
    }

    this.disposed = true

    let firstError: unknown

    for (const child of [...(this.children ?? [])]) {
      try {
        child.dispose()
      } catch (error) {
        firstError ??= error
      }
    }
    this.children = undefined
    this.mounts = undefined

    for (
      const cleanup of
        [...(this.cleanups ?? [])].reverse()
    ) {
      try {
        cleanup()
      } catch (error) {
        firstError ??= error
      }
    }
    this.cleanups = undefined
    this.observers = undefined
    this.subscribedDependencies = undefined
    this.values = undefined
    this.parent?.removeChild(this)

    if (firstError !== undefined && !reportScopeError(this.parent, firstError)) {
      throw firstError
    }
  }
}

export interface ReactiveScope {
  readonly disposed: boolean
  dispose(): void
}

let currentScope: ScopeImpl | null = null
let currentObserver: Observer | null = null
const activeObservers: Observer[] = []
let batchDepth = 0
let notificationDepth = 0
let flushing = false
const pendingComputed = new Set<Observer>()
const pendingEffects = new Set<Observer>()
const pendingAfterFlush: Array<() => void> = []

function addDependencyObserver(
  dependency: Dependency,
  observer: Observer,
): void {
  ;(dependency.observers ??= new Set()).add(observer)
}

function removeDependencyObserver(
  dependency: Dependency,
  observer: Observer,
): void {
  dependency.observers?.delete(observer)
  if (dependency.observers?.size === 0) {
    dependency.observers = undefined
  }
}

class Observer {
  readonly inspectionId = nextObserverInspectionId++
  readonly dependencies = new Set<Dependency>()
  cleanup: Cleanup | undefined
  disposed = false
  running = false
  rerunRequested = false
  output: Dependency | undefined
  depth = 1

  constructor(
    readonly callback: () => void | Cleanup,
    readonly scope: ScopeImpl | null,
    readonly kind: ObserverKind,
    readonly onError?: (error: unknown) => void,
  ) {
    scope?.addObserver(this)
  }

  track(dependency: Dependency): void {
    if (this.dependencies.has(dependency)) {
      return
    }

    this.dependencies.add(dependency)
    addDependencyObserver(dependency, this)
  }

  schedule(): void {
    if (this.disposed) {
      return
    }

    if (this.running) {
      const activeIndex = activeObservers.lastIndexOf(this)
      if (
        activeIndex >= 0 &&
        activeIndex < activeObservers.length - 1
      ) {
        return
      }
      this.rerunRequested = true
      return
    }

    const queue = this.kind === 'computed'
      ? pendingComputed
      : pendingEffects
    const added = !queue.has(this)
    queue.add(this)
    if (added && this.kind === 'computed' && this.output) {
      for (
        const observer of
          [...(this.output.observers ?? [])]
      ) {
        observer.schedule()
      }
    }
    flushIfReady()
  }

  run(): void {
    if (this.disposed) {
      return
    }

    do {
      this.rerunRequested = false
      this.running = true
      try {
        this.cleanup?.()
      } catch (error) {
        if (!this.reportError(error)) {
          throw error
        }
      }
      this.cleanup = undefined

      for (const dependency of this.dependencies) {
        removeDependencyObserver(dependency, this)
      }
      this.dependencies.clear()

      const previousObserver = currentObserver
      const previousScope = currentScope
      currentObserver = this
      currentScope = this.scope
      activeObservers.push(this)

      try {
        const cleanup = this.callback()
        if (typeof cleanup === 'function') {
          this.cleanup = cleanup
        }
      } catch (error) {
        if (!this.reportError(error)) {
          throw error
        }
      } finally {
        activeObservers.pop()
        currentObserver = previousObserver
        currentScope = previousScope
        this.running = false
      }
      if (this.kind === 'computed') {
        this.depth = 1 + Math.max(
          0,
          ...[...this.dependencies].map(
            (dependency) => dependency.producer?.depth ?? 0,
          ),
        )
      }
    } while (this.rerunRequested && !this.disposed)

    if (pendingAfterFlush.length > 0) {
      flushIfReady()
    }
  }

  dispose(): void {
    if (this.disposed) {
      return
    }

    this.disposed = true
    pendingComputed.delete(this)
    pendingEffects.delete(this)
    let cleanupError: unknown
    try {
      this.cleanup?.()
    }
    catch (error) {
      cleanupError = error
    }
    finally {
      this.cleanup = undefined
      for (const dependency of this.dependencies) {
        removeDependencyObserver(dependency, this)
      }
      this.dependencies.clear()
      this.scope?.removeObserver(this)
    }
    if (
      cleanupError !== undefined &&
      !this.reportError(cleanupError)
    ) {
      throw cleanupError
    }
  }

  private reportError(error: unknown): boolean {
    if (this.onError) {
      this.onError(error)
      return true
    }

    return reportScopeError(this.scope, error)
  }
}

abstract class ReactiveCell<T> implements Dependency, ReadonlySignal<T> {
  readonly inspectionId = nextDependencyInspectionId++
  readonly __dynwinrtSignal = true as const
  observers: Set<Observer> | undefined
  listeners:
    Set<(value: T, previous: T) => void> | undefined
  producer: Observer | undefined

  protected constructor(protected currentValue: T) {}

  get inspectionListenerCount(): number {
    return this.listeners?.size ?? 0
  }

  get value(): T {
    currentObserver?.track(this)
    return this.currentValue
  }

  peek(): T {
    return this.currentValue
  }

  subscribe(listener: (value: T, previous: T) => void, options?: SubscribeOptions): Cleanup {
    ;(this.listeners ??= new Set()).add(listener)
    try {
      if (options?.immediate) {
        listener(this.currentValue, this.currentValue)
      }
    } catch (error) {
      this.removeListener(listener)
      throw error
    }

    const scope = currentScope
    scope?.addSubscribedDependency(this)
    const unsubscribe = () => {
      this.removeListener(listener)
      scope?.removeSubscribedDependency(this)
    }
    return scope?.add(unsubscribe) ?? unsubscribe
  }

  protected publish(next: T, previous: T): void {
    notificationDepth += 1
    let firstError: unknown

    try {
      if (this.observers) {
        // Scheduling cannot rebind dependencies until this publish completes.
        for (const observer of this.observers) {
          observer.schedule()
        }
      }

      if (this.listeners) {
        for (const listener of [...this.listeners]) {
          try {
            listener(next, previous)
          } catch (error) {
            firstError ??= error
          }
        }
      }
    } finally {
      notificationDepth -= 1
      try {
        flushIfReady()
      } catch (error) {
        firstError ??= error
      }
    }

    if (firstError !== undefined) {
      throw firstError
    }
  }

  private removeListener(
    listener: (value: T, previous: T) => void,
  ): void {
    this.listeners?.delete(listener)
    if (this.listeners?.size === 0) {
      this.listeners = undefined
    }
  }
}

class SignalImpl<T> extends ReactiveCell<T> implements Signal<T> {
  constructor(initialValue: T) {
    super(initialValue)
  }

  override set value(next: T) {
    this.write(next)
  }

  override get value(): T {
    return super.value
  }

  set(value: T | ((previous: T) => T)): T {
    const next =
      typeof value === 'function'
        ? (value as (previous: T) => T)(this.currentValue)
        : value

    this.write(next)
    return this.currentValue
  }

  update(updater: (previous: T) => T): T {
    return this.set(updater)
  }

  private write(next: T): void {
    const previous = this.currentValue
    if (Object.is(previous, next)) {
      return
    }

    this.currentValue = next
    this.publish(next, previous)
  }
}

class ComputedImpl<T> extends ReactiveCell<T> {
  readonly observer: Observer

  constructor(readonly compute: () => T, scope: ScopeImpl | null) {
    super(undefined as T)
    this.observer = new Observer(() => {
      const next = compute()
      const previous = this.currentValue
      if (!Object.is(previous, next)) {
        this.currentValue = next
        this.publish(next, previous)
      }
    }, scope, 'computed')
    this.producer = this.observer
    this.observer.output = this

    scope?.add(() => this.dispose())
    this.observer.run()
  }

  override get value(): T {
    currentObserver?.track(this)
    this.refreshIfPending()
    return this.currentValue
  }

  override peek(): T {
    this.refreshIfPending()
    return this.currentValue
  }

  dispose(): void {
    this.observer.dispose()
    this.listeners = undefined
    this.observers = undefined
  }

  private refreshIfPending(): void {
    if (
      !this.observer.running &&
      pendingComputed.delete(this.observer)
    ) {
      this.observer.run()
    }
  }
}

function reportScopeError(
  scope: ScopeImpl | null,
  error: unknown,
  context?: unknown,
): boolean {
  let current = scope
  while (current) {
    if (current.errorHandler?.(error, context)) {
      return true
    }
    current = current.parent
  }

  return false
}

function flushIfReady(): void {
  if (
    batchDepth === 0 &&
    notificationDepth === 0 &&
    !flushing
  ) {
    flushPendingObservers()
  }
}

function runQueuedObserver(
  queue: Set<Observer>,
  byDepth = false,
): unknown {
  let observer: Observer | undefined
  for (const candidate of queue) {
    if (
      !observer ||
      (byDepth && candidate.depth < observer.depth)
    ) {
      observer = candidate
    }
  }
  if (!observer) {
    return undefined
  }

  queue.delete(observer)
  try {
    observer.run()
    return undefined
  } catch (error) {
    return error
  }
}

function flushPendingObservers(): void {
  if (flushing) {
    return
  }

  flushing = true
  let firstError: unknown
  try {
    while (
      pendingComputed.size > 0 ||
      pendingEffects.size > 0 ||
      pendingAfterFlush.length > 0
    ) {
      while (pendingComputed.size > 0) {
        firstError ??= runQueuedObserver(pendingComputed, true)
      }

      if (pendingEffects.size > 0) {
        firstError ??= runQueuedObserver(pendingEffects)
      }

      while (
        pendingComputed.size === 0 &&
        pendingEffects.size === 0 &&
        pendingAfterFlush.length > 0
      ) {
        const callback = pendingAfterFlush.shift()
        try {
          callback?.()
        }
        catch (error) {
          firstError ??= error
        }
      }
    }
  } finally {
    flushing = false
  }

  if (firstError !== undefined) {
    throw firstError
  }
}

export function afterReactiveFlush(callback: () => void): void {
  if (
    batchDepth === 0 &&
    notificationDepth === 0 &&
    !flushing &&
    activeObservers.length === 0
  ) {
    callback()
    return
  }

  pendingAfterFlush.push(callback)
}

function asScope(scope: ReactiveScope): ScopeImpl {
  return scope as ScopeImpl
}

export function setReactiveScopeInspection(
  scope: ReactiveScope,
  metadata: ReactiveScopeInspectionMetadata,
): void {
  const target = asScope(scope)
  target.inspectionKind = metadata.kind
  target.inspectionLabel = metadata.label
}

export function getReactiveScopeInspectionId(
  scope: ReactiveScope,
): number {
  return asScope(scope).inspectionId
}

export function inspectReactiveScopes(
  roots: readonly ReactiveScope[],
): ReactiveGraphInspection {
  const rootScopes = roots
    .map(asScope)
    .filter((scope) => !scope.disposed)
  const scopes = new Set<ScopeImpl>()
  const visitScope = (scope: ScopeImpl) => {
    if (scopes.has(scope)) {
      return
    }
    scopes.add(scope)
    for (const child of scope.children ?? []) {
      visitScope(child)
    }
  }
  for (const root of rootScopes) {
    visitScope(root)
  }

  const observers = new Set<Observer>()
  const dependencies = new Set<Dependency>()
  const visitObserver = (observer: Observer) => {
    if (observer.disposed || observers.has(observer)) {
      return
    }
    observers.add(observer)
    if (observer.output) {
      dependencies.add(observer.output)
    }
    for (const dependency of observer.dependencies) {
      dependencies.add(dependency)
      if (dependency.producer) {
        visitObserver(dependency.producer)
      }
    }
  }
  for (const scope of scopes) {
    for (const observer of scope.observers ?? []) {
      visitObserver(observer)
    }
    for (const dependency of
      scope.subscribedDependencies?.keys() ?? []) {
      dependencies.add(dependency)
      if (dependency.producer) {
        visitObserver(dependency.producer)
      }
    }
  }

  return {
    rootScopeIds: rootScopes
      .map((scope) => scope.inspectionId)
      .sort((left, right) => left - right),
    scopes: [...scopes]
      .sort(
        (left, right) =>
          left.inspectionId - right.inspectionId,
      )
      .map((scope) => ({
        id: scope.inspectionId,
        ...(scope.parent && scopes.has(scope.parent)
          ? { parentId: scope.parent.inspectionId }
          : {}),
        kind: scope.inspectionKind,
        ...(scope.inspectionLabel
          ? { label: scope.inspectionLabel }
          : {}),
        disposed: scope.disposed,
        childIds: [...(scope.children ?? [])]
          .filter((child) => scopes.has(child))
          .map((child) => child.inspectionId)
          .sort((left, right) => left - right),
        observerIds: [...(scope.observers ?? [])]
          .filter((observer) => observers.has(observer))
          .map((observer) => observer.inspectionId)
          .sort((left, right) => left - right),
        dependencyIds: [...(scope.observers ?? [])]
          .filter((observer) => observers.has(observer))
          .flatMap((observer) => [
            ...observer.dependencies,
            ...(observer.output
              ? [observer.output]
              : []),
          ])
          .filter(
            (dependency, index, values) =>
              dependencies.has(dependency) &&
              values.indexOf(dependency) === index,
          )
          .concat([
            ...(
              scope.subscribedDependencies?.keys() ??
              []
            ),
          ])
          .filter(
            (dependency, index, values) =>
              dependencies.has(dependency) &&
              values.indexOf(dependency) === index,
          )
          .map((dependency) => dependency.inspectionId)
          .sort((left, right) => left - right),
        cleanupCount: scope.cleanups?.size ?? 0,
        pendingMountCount:
          scope.mounts?.length ?? 0,
        handlesErrors: scope.errorHandler !== undefined,
      })),
    observers: [...observers]
      .sort(
        (left, right) =>
          left.inspectionId - right.inspectionId,
      )
      .map((observer) => ({
        id: observer.inspectionId,
        ...(observer.scope && scopes.has(observer.scope)
          ? { scopeId: observer.scope.inspectionId }
          : {}),
        kind: observer.kind,
        dependencyIds: [...observer.dependencies]
          .filter((dependency) =>
            dependencies.has(dependency),
          )
          .map((dependency) => dependency.inspectionId)
          .sort((left, right) => left - right),
        ...(observer.output
          ? {
              outputDependencyId:
                observer.output.inspectionId,
            }
          : {}),
        running: observer.running,
        scheduled:
          pendingComputed.has(observer) ||
          pendingEffects.has(observer),
        hasCleanup: observer.cleanup !== undefined,
      })),
    dependencies: [...dependencies]
      .sort(
        (left, right) =>
          left.inspectionId - right.inspectionId,
      )
      .map((dependency) => ({
        id: dependency.inspectionId,
        ...(dependency.producer &&
        observers.has(dependency.producer)
          ? {
              producerObserverId:
                dependency.producer.inspectionId,
            }
          : {}),
        observerIds: [...(dependency.observers ?? [])]
          .filter((observer) => observers.has(observer))
          .map((observer) => observer.inspectionId)
          .sort((left, right) => left - right),
        listenerCount:
          dependency.inspectionListenerCount ?? 0,
      })),
  }
}

export function createRoot<T>(
  callback: (dispose: Cleanup) => T,
): T {
  const scope = createScope(null)
  const dispose = () => scope.dispose()
  try {
    return runInScope(scope, () => callback(dispose))
  } catch (error) {
    dispose()
    throw error
  }
}

export function onMount(callback: MountCallback): void {
  if (!currentScope) {
    throw new Error('onMount() must be called while mounting a component.')
  }

  currentScope.addMount(callback)
}

export function flushScopeMounts(scope: ReactiveScope): void {
  asScope(scope).flushMounts()
}

export function provideScopeValue<T>(
  key: symbol,
  value: T,
): void {
  if (!currentScope) {
    throw new Error('A context provider must run while mounting a component.')
  }

  ;(currentScope.values ??= new Map()).set(
    key,
    value,
  )
}

export function readScopeValue<T>(
  key: symbol,
  fallback: T,
): T {
  let scope = currentScope
  while (scope) {
    if (scope.values?.has(key)) {
      return scope.values.get(key) as T
    }
    scope = scope.parent
  }

  return fallback
}

export function setScopeErrorHandler(
  scope: ReactiveScope,
  handler: ScopeErrorHandler | undefined,
): void {
  asScope(scope).errorHandler = handler
}

export function captureScopeError(
  scope: ReactiveScope,
  error: unknown,
  context?: unknown,
): boolean {
  return reportScopeError(asScope(scope), error, context)
}

export function signal<T>(initialValue: T): Signal<T> {
  return new SignalImpl(initialValue)
}

export function computed<T>(compute: () => T): ReadonlySignal<T> {
  return new ComputedImpl(compute, currentScope)
}

export function effect(
  callback: () => void | Cleanup,
  options?: EffectOptions,
): Cleanup {
  const observer = new Observer(
    callback,
    currentScope,
    'effect',
    options?.onError,
  )
  const dispose = () => observer.dispose()
  const registeredDispose = currentScope?.add(dispose) ?? dispose

  try {
    observer.run()
    return registeredDispose
  } catch (error) {
    registeredDispose()
    throw error
  }
}

export function batch<T>(callback: () => T): T {
  batchDepth += 1
  try {
    return callback()
  } finally {
    batchDepth -= 1
    if (batchDepth === 0) {
      flushPendingObservers()
    }
  }
}

export function untrack<T>(callback: () => T): T {
  const previous = currentObserver
  currentObserver = null
  try {
    return callback()
  } finally {
    currentObserver = previous
  }
}

export function isSignal<T = unknown>(value: unknown): value is ReadonlySignal<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Partial<ReadonlySignal<unknown>>).__dynwinrtSignal === true
  )
}

export function readSignal<T>(value: MaybeSignal<T>): T {
  return isSignal<T>(value) ? value.value : value
}

export function createScope(parent: ReactiveScope | null = currentScope): ReactiveScope {
  return new ScopeImpl(parent as ScopeImpl | null)
}

export function runInScope<T>(scope: ReactiveScope, callback: () => T): T {
  if (scope.disposed) {
    throw new Error('Cannot run work in a disposed reactive scope.')
  }

  const previous = currentScope
  currentScope = scope as ScopeImpl
  try {
    return callback()
  } finally {
    currentScope = previous
  }
}

export function onCleanup(cleanup: Cleanup): Cleanup {
  if (!currentScope) {
    throw new Error('onCleanup() must be called while mounting a component or running an effect.')
  }

  return currentScope.add(cleanup)
}
