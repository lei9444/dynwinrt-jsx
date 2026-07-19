import type { NativeConstructor } from './native'

export function createSymbolIcon<Icon>(
  constructorType: new (symbol: number) => Icon,
  symbol: number,
): Icon {
  return new constructorType(symbol)
}

interface FontIconInstance<FontFamily> {
  glyph: string
  fontFamily: FontFamily
  fontSize: number
}

export interface FontIconOptions<FontFamily> {
  readonly fontFamily?: FontFamily
  readonly fontSize?: number
}

export function createFontIcon<
  Icon extends FontIconInstance<FontFamily>,
  FontFamily,
>(
  constructorType: NativeConstructor<Icon>,
  glyph: string,
  options: FontIconOptions<FontFamily> = {},
): Icon {
  if (glyph.length === 0) {
    throw new RangeError('Font icon glyph cannot be empty.')
  }
  const icon = new constructorType()
  icon.glyph = glyph
  if (options.fontFamily !== undefined) {
    icon.fontFamily = options.fontFamily
  }
  if (options.fontSize !== undefined) {
    if (!Number.isFinite(options.fontSize) || options.fontSize <= 0) {
      throw new RangeError('Font icon size must be a positive number.')
    }
    icon.fontSize = options.fontSize
  }
  return icon
}
