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
  observers: Set<Observer>
  producer?: Observer
}

type ObserverKind = 'computed' | 'effect'
type ScopeErrorHandler = (
  error: unknown,
  context?: unknown,
) => boolean
type MountCallback = () => void | Cleanup

class ScopeImpl {
  readonly children = new Set<ScopeImpl>()
  readonly cleanups = new Set<Cleanup>()
  readonly values = new Map<symbol, unknown>()
  readonly mounts: MountCallback[] = []
  errorHandler: ScopeErrorHandler | undefined
  mountsFlushed = false
  disposed = false

  constructor(readonly parent: ScopeImpl | null) {
    parent?.children.add(this)
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
      this.cleanups.delete(dispose)
      cleanup()
    }

    this.cleanups.add(dispose)
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

    this.mounts.push(callback)
  }

  flushMounts(): void {
    if (this.disposed || this.mountsFlushed) {
      return
    }

    this.mountsFlushed = true
    const callbacks = this.mounts.splice(0)
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

    for (const child of [...this.children]) {
      try {
        child.dispose()
      } catch (error) {
        firstError ??= error
      }
    }
    this.children.clear()
    this.mounts.length = 0

    for (const cleanup of [...this.cleanups].reverse()) {
      try {
        cleanup()
      } catch (error) {
        firstError ??= error
      }
    }
    this.cleanups.clear()
    this.parent?.children.delete(this)

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

class Observer {
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
  ) {}

  track(dependency: Dependency): void {
    if (this.dependencies.has(dependency)) {
      return
    }

    this.dependencies.add(dependency)
    dependency.observers.add(this)
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
      for (const observer of [...this.output.observers]) {
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
        dependency.observers.delete(this)
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
  }

  dispose(): void {
    if (this.disposed) {
      return
    }

    this.disposed = true
    pendingComputed.delete(this)
    pendingEffects.delete(this)
    try {
      this.cleanup?.()
    } catch (error) {
      if (!this.reportError(error)) {
        throw error
      }
    }
    this.cleanup = undefined

    for (const dependency of this.dependencies) {
      dependency.observers.delete(this)
    }
    this.dependencies.clear()
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
  readonly __dynwinrtSignal = true as const
  readonly observers = new Set<Observer>()
  readonly listeners = new Set<(value: T, previous: T) => void>()
  producer: Observer | undefined

  protected constructor(protected currentValue: T) {}

  get value(): T {
    currentObserver?.track(this)
    return this.currentValue
  }

  peek(): T {
    return this.currentValue
  }

  subscribe(listener: (value: T, previous: T) => void, options?: SubscribeOptions): Cleanup {
    this.listeners.add(listener)
    try {
      if (options?.immediate) {
        listener(this.currentValue, this.currentValue)
      }
    } catch (error) {
      this.listeners.delete(listener)
      throw error
    }

    const unsubscribe = () => {
      this.listeners.delete(listener)
    }
    return currentScope?.add(unsubscribe) ?? unsubscribe
  }

  protected publish(next: T, previous: T): void {
    notificationDepth += 1
    let firstError: unknown

    try {
      for (const observer of [...this.observers]) {
        observer.schedule()
      }

      for (const listener of [...this.listeners]) {
        try {
          listener(next, previous)
        } catch (error) {
          firstError ??= error
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
    this.listeners.clear()
    this.observers.clear()
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
    while (pendingComputed.size > 0 || pendingEffects.size > 0) {
      while (pendingComputed.size > 0) {
        firstError ??= runQueuedObserver(pendingComputed, true)
      }

      if (pendingEffects.size > 0) {
        firstError ??= runQueuedObserver(pendingEffects)
      }
    }
  } finally {
    flushing = false
  }

  if (firstError !== undefined) {
    throw firstError
  }
}

function asScope(scope: ReactiveScope): ScopeImpl {
  return scope as ScopeImpl
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

  currentScope.values.set(key, value)
}

export function readScopeValue<T>(
  key: symbol,
  fallback: T,
): T {
  let scope = currentScope
  while (scope) {
    if (scope.values.has(key)) {
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
