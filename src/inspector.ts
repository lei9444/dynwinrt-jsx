import {
  getReactiveScopeInspectionId,
  inspectReactiveScopes,
  type ReactiveGraphInspection,
  type ReactiveScope,
} from './reactive'
import type { RendererDiagnostics } from './renderer'

export type {
  ReactiveDependencyInspection,
  ReactiveGraphInspection,
  ReactiveObserverInspection,
  ReactiveScopeInspection,
} from './reactive'

export interface RendererInspectorOptions {
  readonly maxOperations?: number
  readonly now?: () => number
}

export type RendererOperationKind =
  | 'render.mount'
  | 'render.update'
  | 'render.dispose'
  | 'native.create'
  | 'native.dispose'
  | 'component.mount'
  | 'component.dispose'
  | 'items-repeater.create'
  | 'items-repeater.dispose'
  | 'property.apply'
  | 'event.subscribe'
  | 'event.unsubscribe'
  | 'event.invoke'
  | 'children.sync'
  | 'resource.resolve'
  | 'resource.observe'
  | 'resource.unobserve'
  | 'list.create'
  | 'list.reuse'
  | 'error'

export interface RendererOperationRecord {
  readonly sequence: number
  readonly timestamp: number
  readonly kind: RendererOperationKind
  readonly scopeId?: number
  readonly target?: string
  readonly property?: string
  readonly name?: string
  readonly count?: number
  readonly errorName?: string
}

export type RendererInspectionNodeKind =
  | 'root'
  | 'component'
  | 'native'
  | 'itemsRepeaterHost'

export interface RendererInspectionNode {
  readonly id: number
  readonly kind: RendererInspectionNodeKind
  readonly label: string
  readonly scopeId: number
}

export type RendererInspectionSubscriptionKind =
  | 'event'
  | 'resource'

export interface RendererInspectionSubscription {
  readonly id: number
  readonly kind: RendererInspectionSubscriptionKind
  readonly scopeId: number
  readonly target: string
  readonly name: string
  readonly status: 'active' | 'cleanupFailed'
}

export interface RendererInspectionSnapshot {
  readonly timestamp: number
  readonly diagnostics: RendererDiagnostics
  readonly nodes: readonly RendererInspectionNode[]
  readonly reactive: ReactiveGraphInspection
  readonly subscriptions:
    readonly RendererInspectionSubscription[]
  readonly operations: readonly RendererOperationRecord[]
}

export interface RendererInspector {
  snapshot(): RendererInspectionSnapshot
  getOperations(): readonly RendererOperationRecord[]
  clearOperations(): void
}

type OperationFields = Omit<
  RendererOperationRecord,
  'sequence' | 'timestamp' | 'kind'
>

function requireOperationLimit(value: number): number {
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > 10_000
  ) {
    throw new RangeError(
      'Renderer inspector maxOperations must be an integer between 0 and 10000.',
    )
  }
  return value
}

export function describeInspectionTarget(
  target: unknown,
): string {
  if (
    typeof target === 'object' &&
    target !== null &&
    typeof target.constructor?.name === 'string' &&
    target.constructor.name.length > 0
  ) {
    return target.constructor.name
  }
  if (
    typeof target === 'function' &&
    target.name.length > 0
  ) {
    return target.name
  }
  return typeof target
}

export function describeInspectionError(
  error: unknown,
): string {
  if (error instanceof AggregateError) {
    return 'AggregateError'
  }
  if (error instanceof TypeError) {
    return 'TypeError'
  }
  if (error instanceof RangeError) {
    return 'RangeError'
  }
  if (error instanceof ReferenceError) {
    return 'ReferenceError'
  }
  if (error instanceof SyntaxError) {
    return 'SyntaxError'
  }
  if (error instanceof Error) {
    return 'Error'
  }
  return typeof error
}

function operationForNode(
  kind: RendererInspectionNodeKind,
  disposed: boolean,
): RendererOperationKind | undefined {
  if (kind === 'native') {
    return disposed ? 'native.dispose' : 'native.create'
  }
  if (kind === 'component') {
    return disposed
      ? 'component.dispose'
      : 'component.mount'
  }
  if (kind === 'itemsRepeaterHost') {
    return disposed
      ? 'items-repeater.dispose'
      : 'items-repeater.create'
  }
  return undefined
}

export class RendererInspectorRuntime {
  readonly maxOperations: number
  private readonly now: () => number
  private readonly operations: RendererOperationRecord[] = []
  private readonly nodes =
    new Map<number, RendererInspectionNode>()
  private readonly subscriptions =
    new Map<number, RendererInspectionSubscription>()
  private nextOperationSequence = 1
  private nextNodeId = 1
  private nextSubscriptionId = 1
  private operationStart = 0

  constructor(options: RendererInspectorOptions = {}) {
    this.maxOperations = requireOperationLimit(
      options.maxOperations ?? 200,
    )
    this.now = options.now ?? Date.now
  }

  record(
    kind: RendererOperationKind,
    fields: OperationFields = {},
  ): void {
    if (this.maxOperations === 0) {
      return
    }
    const record = Object.freeze({
      sequence: this.nextOperationSequence,
      timestamp: this.now(),
      kind,
      ...fields,
    })
    this.nextOperationSequence += 1
    if (this.operations.length < this.maxOperations) {
      this.operations.push(record)
      return
    }
    this.operations[this.operationStart] = record
    this.operationStart =
      (this.operationStart + 1) % this.maxOperations
  }

  registerNode(
    kind: RendererInspectionNodeKind,
    label: string,
    scope: ReactiveScope,
  ): number {
    const id = this.nextNodeId
    this.nextNodeId += 1
    const node = Object.freeze({
      id,
      kind,
      label,
      scopeId: getReactiveScopeInspectionId(scope),
    })
    this.nodes.set(id, node)
    const operation = operationForNode(kind, false)
    if (operation) {
      this.record(operation, {
        scopeId: node.scopeId,
        target: label,
      })
    }
    return id
  }

  releaseNode(id: number): void {
    const node = this.nodes.get(id)
    if (!node) {
      return
    }
    this.nodes.delete(id)
    const operation = operationForNode(node.kind, true)
    if (operation) {
      this.record(operation, {
        scopeId: node.scopeId,
        target: node.label,
      })
    }
  }

  registerSubscription(
    kind: RendererInspectionSubscriptionKind,
    scope: ReactiveScope,
    target: unknown,
    name: string,
  ): number {
    const id = this.nextSubscriptionId
    this.nextSubscriptionId += 1
    const subscription = Object.freeze({
      id,
      kind,
      scopeId: getReactiveScopeInspectionId(scope),
      target: describeInspectionTarget(target),
      name,
      status: 'active' as const,
    })
    this.subscriptions.set(id, subscription)
    this.record(
      kind === 'event'
        ? 'event.subscribe'
        : 'resource.observe',
      {
        scopeId: subscription.scopeId,
        target: subscription.target,
        name,
      },
    )
    return id
  }

  releaseSubscription(id: number): void {
    const subscription = this.subscriptions.get(id)
    if (!subscription) {
      return
    }
    this.subscriptions.delete(id)
    this.record(
      subscription.kind === 'event'
        ? 'event.unsubscribe'
        : 'resource.unobserve',
      {
        scopeId: subscription.scopeId,
        target: subscription.target,
        name: subscription.name,
      },
    )
  }

  failSubscription(
    id: number,
    error: unknown,
  ): void {
    const subscription = this.subscriptions.get(id)
    if (!subscription) {
      return
    }
    this.subscriptions.set(id, Object.freeze({
      ...subscription,
      status: 'cleanupFailed' as const,
    }))
    this.record('error', {
      scopeId: subscription.scopeId,
      target: subscription.target,
      name: `${subscription.kind}.unsubscribe`,
      errorName: describeInspectionError(error),
    })
  }

  snapshot(
    diagnostics: RendererDiagnostics,
    rootScopes: readonly ReactiveScope[],
  ): RendererInspectionSnapshot {
    return {
      timestamp: this.now(),
      diagnostics: { ...diagnostics },
      nodes: [...this.nodes.values()].sort(
        (left, right) => left.id - right.id,
      ),
      reactive: inspectReactiveScopes(rootScopes),
      subscriptions: [...this.subscriptions.values()].sort(
        (left, right) => left.id - right.id,
      ),
      operations: this.getOperations(),
    }
  }

  getOperations(): readonly RendererOperationRecord[] {
    if (
      this.operations.length < this.maxOperations ||
      this.operationStart === 0
    ) {
      return [...this.operations]
    }
    return [
      ...this.operations.slice(this.operationStart),
      ...this.operations.slice(0, this.operationStart),
    ]
  }

  clearOperations(): void {
    this.operations.length = 0
    this.operationStart = 0
  }
}
