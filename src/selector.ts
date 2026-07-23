import {
  adapter,
  type NativePropertyAdapter,
} from './adapters'

export interface SelectorInstance {
  selectedIndex: number
  registerPropertyChangedCallback?(
    property: unknown,
    callback: (sender: unknown, property: unknown) => void,
  ): bigint
  unregisterPropertyChangedCallback?(
    property: unknown,
    token: bigint,
  ): void
}

export interface SelectedIndexAdapterOptions {
  readonly property: unknown
  readonly label: string
  readonly maxPendingWrites?: number
}

export function coerceSelectedIndex(
  value: unknown,
  label: string,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < -1
  ) {
    throw new RangeError(
      `${label} selectedIndex must be an integer greater than or equal to -1.`,
    )
  }
  return value
}

export function createSelectedIndexAdapter<
  Instance extends SelectorInstance,
>(
  options: SelectedIndexAdapterOptions,
): NativePropertyAdapter<Instance> {
  return adapter.withPhase(
    adapter.controlled<Instance>(
      {
        changeProperty: 'onSelectedIndexChange',
        read: (instance) => instance.selectedIndex,
        write: (instance, value) => {
          instance.selectedIndex = value as number
        },
        subscribe: (instance, callback) => {
          if (
            !instance.registerPropertyChangedCallback ||
            !instance.unregisterPropertyChangedCallback
          ) {
            throw new Error(
              `${options.label} selectedIndexProperty requires property-changed callback support.`,
            )
          }
          const token =
            instance.registerPropertyChangedCallback(
              options.property,
              callback,
            )
          return () => {
            instance.unregisterPropertyChangedCallback?.(
              options.property,
              token,
            )
          }
        },
        echo: 'setterScope',
        maxPendingWrites: options.maxPendingWrites,
      },
      (value) => coerceSelectedIndex(
        value,
        options.label,
      ),
    ),
    'afterChildren',
  )
}
