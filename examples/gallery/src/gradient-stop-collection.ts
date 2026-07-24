import {
  GradientStopCollection,
  type IObservableVector_GradientStop,
} from '#winapp/bindings'

export function gradientStopCollection(
  value: IObservableVector_GradientStop,
): GradientStopCollection {
  const project = Reflect.get(
    GradientStopCollection,
    '_fromNative',
  )
  if (typeof project !== 'function') {
    throw new Error(
      'GradientStopCollection native projection is unavailable.',
    )
  }
  const collection = Reflect.apply(
    project,
    GradientStopCollection,
    [Reflect.get(value, '_obj')],
  )
  if (!(collection instanceof GradientStopCollection)) {
    throw new TypeError(
      'Gradient stops could not be projected as a mutable collection.',
    )
  }
  return collection
}
