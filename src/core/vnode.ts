import type { ReadonlySignal } from './reactive'

export type Key = string | number | symbol | object
export type PrimitiveChild = string | number | bigint

export const Fragment = Symbol.for('dynwinrt-jsx.fragment')
const vnodeBrand = Symbol.for('dynwinrt-jsx.vnode')
const dynamicBrand = Symbol.for('dynwinrt-jsx.dynamic')
const listBrand = Symbol.for('dynwinrt-jsx.list')
const boundaryBrand = Symbol.for('dynwinrt-jsx.error-boundary')
const portalBrand = Symbol.for('dynwinrt-jsx.portal')

export type Component<Props = Record<string, unknown>> = (props: Props) => Child

export interface VNode<Props = Record<string, unknown>> {
  readonly brand: typeof vnodeBrand
  readonly type: Component<Props> | object | typeof Fragment
  readonly props: Props & {
    children?: Child
  }
  readonly key: Key | null
}

export interface DynamicNode {
  readonly brand: typeof dynamicBrand
  readonly read: () => Child
}

export interface ListNode<Item = unknown> {
  readonly brand: typeof listBrand
  readonly readItems: () => readonly Item[]
  renderItem(item: Item, index: ReadonlySignal<number>): Child
  getKey(item: Item, index: number): Key
  getSourceIndex(item: Item, visibleIndex: number): number
  readonly fallback?: Child
}

export interface BoundaryErrorContext {
  readonly phase: string
  readonly target?: unknown
  readonly property?: string
}

export interface ErrorBoundaryNode {
  readonly brand: typeof boundaryBrand
  readonly children: Child
  readonly fallback: (
    error: unknown,
    context: BoundaryErrorContext,
  ) => Child
  readonly readReset?: () => unknown
}

export interface PortalNode {
  readonly brand: typeof portalBrand
  readonly children: Child
  readonly readTarget: () => object | null | undefined
}

export type Child =
  | VNode
  | DynamicNode
  | ListNode
  | ErrorBoundaryNode
  | PortalNode
  | ReadonlySignal<Child>
  | PrimitiveChild
  | boolean
  | null
  | undefined
  | readonly Child[]

export function createVNode<Props extends Record<string, unknown>>(
  type: VNode<Props>['type'],
  props: Props & {
    children?: Child
  },
  key: Key | null = null,
): VNode<Props> {
  return {
    brand: vnodeBrand,
    type,
    props,
    key,
  }
}

export function createDynamicNode(read: () => Child): DynamicNode {
  return {
    brand: dynamicBrand,
    read,
  }
}

export function createListNode<Item>(
  readItems: () => readonly Item[],
  renderItem: (item: Item, index: ReadonlySignal<number>) => Child,
  getKey: (item: Item, index: number) => Key,
  fallback?: Child,
  getSourceIndex: (
    item: Item,
    visibleIndex: number,
  ) => number = (_item, visibleIndex) => visibleIndex,
): ListNode<Item> {
  return {
    brand: listBrand,
    readItems,
    renderItem,
    getKey,
    getSourceIndex,
    fallback,
  }
}

export function createErrorBoundaryNode(
  children: Child,
  fallback: ErrorBoundaryNode['fallback'],
  readReset?: () => unknown,
): ErrorBoundaryNode {
  return {
    brand: boundaryBrand,
    children,
    fallback,
    readReset,
  }
}

export function createPortalNode(
  children: Child,
  readTarget: PortalNode['readTarget'],
): PortalNode {
  return {
    brand: portalBrand,
    children,
    readTarget,
  }
}

export function isVNode(value: unknown): value is VNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Partial<VNode>).brand === vnodeBrand
  )
}

export function isDynamicNode(value: unknown): value is DynamicNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Partial<DynamicNode>).brand === dynamicBrand
  )
}

export function isListNode(value: unknown): value is ListNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Partial<ListNode>).brand === listBrand
  )
}

export function isErrorBoundaryNode(
  value: unknown,
): value is ErrorBoundaryNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Partial<ErrorBoundaryNode>).brand === boundaryBrand
  )
}

export function isPortalNode(value: unknown): value is PortalNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Partial<PortalNode>).brand === portalBrand
  )
}
