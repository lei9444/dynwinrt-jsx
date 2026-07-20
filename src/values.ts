import type { NativeConstructor } from './native'
import type { WinUIColor } from './winui'

function assertNonEmptyString(value: string, label: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new RangeError(`${label} cannot be empty.`)
  }
}

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite, non-negative number.`)
  }
}

function assertColorChannel(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new RangeError(
      `Color channel "${label}" must be an integer between 0 and 255.`,
    )
  }
}

function assertNonNullObject(value: unknown, label: string): void {
  if (value === null || value === undefined) {
    throw new TypeError(`${label} cannot be null or undefined.`)
  }
}

export interface UriConstructor<Instance> {
  new (uri: string): Instance
}

export interface RelativeUriConstructor<Instance> {
  new (baseUri: string, relativeUri: string): Instance
}

export function createUri<Instance>(
  constructorType: UriConstructor<Instance>,
  uri: string,
): Instance {
  assertNonEmptyString(uri, 'Uri value')
  return new constructorType(uri)
}

export function createRelativeUri<Instance>(
  constructorType: RelativeUriConstructor<Instance>,
  baseUri: string,
  relativeUri: string,
): Instance {
  assertNonEmptyString(baseUri, 'Base URI')
  assertNonEmptyString(relativeUri, 'Relative URI')
  return new constructorType(baseUri, relativeUri)
}

interface BitmapImageInstance<UriValue> {
  uriSource: UriValue
  decodePixelWidth: number
  decodePixelHeight: number
}

export interface BitmapImageOptions {
  readonly decodePixelWidth?: number
  readonly decodePixelHeight?: number
}

// BitmapImage is the constructible ImageSource implementation.
export function createBitmapImage<
  Instance extends BitmapImageInstance<UriValue>,
  UriValue,
>(
  constructorType: NativeConstructor<Instance>,
  uriSource: UriValue,
  options: BitmapImageOptions = {},
): Instance {
  assertNonNullObject(uriSource, 'BitmapImage uriSource')
  const image = new constructorType()
  image.uriSource = uriSource
  if (options.decodePixelWidth !== undefined) {
    assertFiniteNonNegative(options.decodePixelWidth, 'decodePixelWidth')
    image.decodePixelWidth = options.decodePixelWidth
  }
  if (options.decodePixelHeight !== undefined) {
    assertFiniteNonNegative(options.decodePixelHeight, 'decodePixelHeight')
    image.decodePixelHeight = options.decodePixelHeight
  }
  return image
}

interface BitmapIconInstance<UriValue> {
  uriSource: UriValue
  showAsMonochrome: boolean
}

export interface BitmapIconOptions {
  readonly showAsMonochrome?: boolean
}

export function createBitmapIcon<
  Instance extends BitmapIconInstance<UriValue>,
  UriValue,
>(
  constructorType: NativeConstructor<Instance>,
  uriSource: UriValue,
  options: BitmapIconOptions = {},
): Instance {
  assertNonNullObject(uriSource, 'BitmapIcon uriSource')
  const icon = new constructorType()
  icon.uriSource = uriSource
  if (options.showAsMonochrome !== undefined) {
    icon.showAsMonochrome = options.showAsMonochrome
  }
  return icon
}

export interface FontFamilyConstructor<Instance> {
  new (familyName: string): Instance
}

export function createFontFamily<Instance>(
  constructorType: FontFamilyConstructor<Instance>,
  familyName: string,
): Instance {
  assertNonEmptyString(familyName, 'Font family name')
  return new constructorType(familyName)
}

export interface SolidColorBrushConstructor<Instance> {
  new (color: WinUIColor): Instance
}

export function createSolidColorBrush<Instance>(
  constructorType: SolidColorBrushConstructor<Instance>,
  color: WinUIColor,
): Instance {
  assertColorChannel(color.a, 'a')
  assertColorChannel(color.r, 'r')
  assertColorChannel(color.g, 'g')
  assertColorChannel(color.b, 'b')
  return new constructorType(color)
}

export interface ReferenceType<Boxed> {
  from(boxed: unknown): Boxed
}

export interface ReferenceBoxing<Value, Boxed> {
  readonly box: (value: Value) => unknown
  readonly referenceType: ReferenceType<Boxed>
}

// The concrete PropertyValue factory and IReference specialization stay injected.
export function createReferenceBoxing<Value, Boxed>(
  box: (value: Value) => unknown,
  referenceType: ReferenceType<Boxed>,
): ReferenceBoxing<Value, Boxed> {
  return { box, referenceType }
}

export function boxNullable<Value, Boxed>(
  boxing: ReferenceBoxing<Value, Boxed>,
  value: Value | null | undefined,
): Boxed | null {
  if (value === null || value === undefined) {
    return null
  }
  return boxing.referenceType.from(boxing.box(value))
}

export function unboxReference<Value>(
  reference: { readonly value: Value } | null | undefined,
): Value | null {
  if (reference === null || reference === undefined) {
    return null
  }
  return reference.value
}
