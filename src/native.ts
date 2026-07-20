import type { MaybeSignal } from './reactive'
import type { ResourceReference } from './resource'
import type { WinUIResourceOverrides } from './winui-resources'
import { createVNode, type Child, type Key, type VNode } from './vnode'
import type {
  NativeAdapter,
  NativeSlotAdapter,
} from './adapters'

export type NativeConstructor<Instance = object> = new (...args: never[]) => Instance

type IfEqual<Left, Right, Equal, NotEqual = never> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? Equal
    : NotEqual

type WritableKeys<Value> = {
  [Key in keyof Value]-?: IfEqual<
    { [Current in Key]: Value[Current] },
    { -readonly [Current in Key]: Value[Current] },
    Key
  >
}[keyof Value]

type WritablePropertyKeys<Value> = {
  [Key in Extract<WritableKeys<Value>, string>]:
    Value[Key] extends (...args: never[]) => unknown ? never : Key
}[Extract<WritableKeys<Value>, string>]

type EventCallback<Value> =
  Value extends (
    callback: infer Callback,
    ...args: never[]
  ) => unknown
    ? Callback extends (...args: never[]) => unknown
      ? Callback
      : never
    : never

type EventKeys<Value> = {
  [Key in Extract<keyof Value, string>]:
    Key extends `on${string}`
      ? EventCallback<Value[Key]> extends never
        ? never
        : Key
      : never
}[Extract<keyof Value, string>]

export interface RefObject<Value> {
  current: Value | null
}

export type Ref<Value> = RefObject<Value> | ((value: Value | null) => void)

export type NativeValue<Value> = Value | ResourceReference

export type NativeValueForProperty<
  Key extends string,
  Value,
> = Key extends 'isChecked'
  ? NativeValue<Value> | boolean | null
  : NativeValue<Value>

export type NativePropertyProps<Value> = {
  [Key in WritablePropertyKeys<Value>]?: MaybeSignal<
    NativeValueForProperty<Key, Value[Key]>
  >
}

export type NativeEventProps<Value> = {
  [Key in EventKeys<Value>]?: MaybeSignal<EventCallback<Value[Key]>>
}

export interface NativeCommonProps<Value> {
  children?: Child
  key?: Key
  ref?: Ref<Value>
  gridRow?: MaybeSignal<number>
  gridColumn?: MaybeSignal<number>
  gridRowSpan?: MaybeSignal<number>
  gridColumnSpan?: MaybeSignal<number>
  canvasLeft?: MaybeSignal<number>
  canvasTop?: MaybeSignal<number>
  automationId?: MaybeSignal<string>
  automationName?: MaybeSignal<string>
  automationHelpText?: MaybeSignal<string>
  automationLabeledBy?: MaybeSignal<object | null>
  automationHeadingLevel?: MaybeSignal<number>
  automationPositionInSet?: MaybeSignal<number>
  automationSizeOfSet?: MaybeSignal<number>
  automationLiveSetting?: MaybeSignal<number>
  automationIsDialog?: MaybeSignal<boolean>
  automationControlType?: MaybeSignal<number>
  resourceOverrides?: MaybeSignal<WinUIResourceOverrides>
}

export type NativeProps<Value> =
  & NativePropertyProps<Value>
  & NativeEventProps<Value>
  & NativeCommonProps<Value>

export type NativeComponentProps<
  Value,
  ExtraProps extends object = {},
> = NativeProps<Value> & ExtraProps

export interface NativeComponentOptions<Instance> {
  displayName?: string
  create?: () => Instance
  adapters?: Record<string, NativeAdapter<Instance> | undefined>
  children?: NativeSlotAdapter<Instance>
  setProperty?: (
    instance: Instance,
    property: string,
    value: unknown,
  ) => boolean
}

interface NativeComponentMetadata<Instance> {
  readonly constructorType: NativeConstructor<Instance>
  readonly options: NativeComponentOptions<Instance>
}

const nativeComponentBrand = Symbol.for('dynwinrt-jsx.native-component')

export interface NativeComponent<
  Instance extends object,
  ExtraProps extends object = {},
> {
  (props: NativeComponentProps<Instance, ExtraProps>): VNode
  readonly [nativeComponentBrand]: NativeComponentMetadata<Instance>
  readonly displayName: string
}

export type NativeComponents<
  Constructors extends Record<string, NativeConstructor>,
> = {
  [Name in keyof Constructors]: NativeComponent<
    InstanceType<Constructors[Name]>
  >
}

export function native<
  Instance extends object,
  ExtraProps extends object = {},
>(
  constructorType: NativeConstructor<Instance>,
  options: NativeComponentOptions<Instance> = {},
): NativeComponent<Instance, ExtraProps> {
  const component = ((props: NativeComponentProps<Instance, ExtraProps>) =>
    createVNode(
      component,
      props as NativeComponentProps<Instance, ExtraProps> &
        Record<string, unknown>,
      props.key ?? null,
    )) as unknown as NativeComponent<Instance, ExtraProps>

  Object.defineProperty(component, nativeComponentBrand, {
    value: {
      constructorType,
      options,
    } satisfies NativeComponentMetadata<Instance>,
  })
  Object.defineProperty(component, 'displayName', {
    value: options.displayName ?? constructorType.name,
  })

  return component
}

export function createControls<
  const Constructors extends Record<string, NativeConstructor>,
>(constructors: Constructors): NativeComponents<Constructors> {
  const components = {} as NativeComponents<Constructors>

  for (const [name, constructorType] of Object.entries(constructors)) {
    Object.defineProperty(components, name, {
      enumerable: true,
      value: native(constructorType, { displayName: name }),
    })
  }

  return components
}

export function isNativeComponent(
  value: unknown,
): value is NativeComponent<object, object> {
  return (
    typeof value === 'function' &&
    nativeComponentBrand in value
  )
}

export function getNativeComponentMetadata(
  component: NativeComponent<object, object>,
): NativeComponentMetadata<object> {
  return component[nativeComponentBrand]
}

export function setRef<Value>(ref: Ref<Value> | undefined, value: Value | null): void {
  if (!ref) {
    return
  }

  if (typeof ref === 'function') {
    ref(value)
  } else {
    ref.current = value
  }
}
