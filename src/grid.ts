import {
  native,
  type NativeComponent,
  type NativeConstructor,
} from './native'
import { adapter } from './adapters'
import type { MaybeSignal } from './reactive'
import type { NativeCollection } from './renderer'

export type WinUIGridUnitType = 0 | 1 | 2

export interface WinUIGridLength {
  readonly value: number
  readonly gridUnitType: WinUIGridUnitType
}

export interface WinUIGridTrack {
  readonly size: WinUIGridLength
  readonly min?: number
  readonly max?: number
}

export interface GridLayoutProps<RowDefinition, ColumnDefinition> {
  rowDefinitions?: MaybeSignal<
    readonly GridDefinitionInput<RowDefinition>[]
  >
  columnDefinitions?: MaybeSignal<
    readonly GridDefinitionInput<ColumnDefinition>[]
  >
}

export type GridDefinitionInput<Definition> =
  | Definition
  | WinUIGridLength
  | WinUIGridTrack

interface GridInstance {
  readonly rowDefinitions: NativeCollection
  readonly columnDefinitions: NativeCollection
}

interface RowDefinitionInstance {
  height: {
    readonly value: number
    readonly gridUnitType: number
  }
  minHeight: number
  maxHeight: number
}

interface ColumnDefinitionInstance {
  width: {
    readonly value: number
    readonly gridUnitType: number
  }
  minWidth: number
  maxWidth: number
}

export interface GridControlBindings<
  Grid extends GridInstance,
  RowDefinition extends RowDefinitionInstance,
  ColumnDefinition extends ColumnDefinitionInstance,
> {
  readonly Grid: NativeConstructor<Grid>
  readonly RowDefinition: NativeConstructor<RowDefinition>
  readonly ColumnDefinition: NativeConstructor<ColumnDefinition>
}

function nonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number.`)
  }
  return value
}

export const gridLength = {
  auto(): WinUIGridLength {
    return { value: 1, gridUnitType: 0 }
  },
  pixel(value: number): WinUIGridLength {
    return {
      value: nonNegative(value, 'Pixel grid length'),
      gridUnitType: 1,
    }
  },
  star(weight = 1): WinUIGridLength {
    return {
      value: nonNegative(weight, 'Star grid length'),
      gridUnitType: 2,
    }
  },
}

function normalizeTrack(
  value: WinUIGridLength | WinUIGridTrack,
): WinUIGridTrack {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('Grid track definition must be an object.')
  }
  const track = 'size' in value ? value : { size: value }
  const { size } = track
  if (
    !Number.isFinite(size.value) ||
    !(
      size.gridUnitType === 0 ||
      size.gridUnitType === 1 ||
      size.gridUnitType === 2
    )
  ) {
    throw new TypeError('Invalid GridLength value.')
  }
  if (size.gridUnitType === 1 && size.value < 0) {
    throw new RangeError('Pixel grid length cannot be negative.')
  }
  if (size.gridUnitType === 2 && size.value < 0) {
    throw new RangeError('Star grid length cannot be negative.')
  }

  const min = track.min === undefined
    ? undefined
    : nonNegative(track.min, 'Grid track minimum')
  const max = track.max
  if (
    max !== undefined &&
    (!(Number.isFinite(max) || max === Number.POSITIVE_INFINITY) || max < 0)
  ) {
    throw new RangeError(
      'Grid track maximum must be a non-negative number or Infinity.',
    )
  }
  if (min !== undefined && max !== undefined && min > max) {
    throw new RangeError('Grid track minimum cannot exceed its maximum.')
  }

  return { size: { ...size }, min, max }
}

export function createGridControl<
  Grid extends GridInstance,
  RowDefinition extends RowDefinitionInstance,
  ColumnDefinition extends ColumnDefinitionInstance,
>(
  bindings: GridControlBindings<Grid, RowDefinition, ColumnDefinition>,
): NativeComponent<
  Grid,
  GridLayoutProps<RowDefinition, ColumnDefinition>
> {
  return native<
    Grid,
    GridLayoutProps<RowDefinition, ColumnDefinition>
  >(bindings.Grid, {
    displayName: 'Grid',
    adapters: {
      rowDefinitions: adapter.collection<Grid>({
        get: (instance) => instance.rowDefinitions,
        label: 'Grid rowDefinitions',
        map(definition) {
          if (definition instanceof bindings.RowDefinition) {
            return definition
          }
          const track = normalizeTrack(
            definition as WinUIGridLength | WinUIGridTrack,
          )
          const row = new bindings.RowDefinition()
          row.height = track.size
          if (track.min !== undefined) {
            row.minHeight = track.min
          }
          if (track.max !== undefined) {
            row.maxHeight = track.max
          }
          return row
        },
      }),
      columnDefinitions: adapter.collection<Grid>({
        get: (instance) => instance.columnDefinitions,
        label: 'Grid columnDefinitions',
        map(definition) {
          if (definition instanceof bindings.ColumnDefinition) {
            return definition
          }
          const track = normalizeTrack(
            definition as WinUIGridLength | WinUIGridTrack,
          )
          const column = new bindings.ColumnDefinition()
          column.width = track.size
          if (track.min !== undefined) {
            column.minWidth = track.min
          }
          if (track.max !== undefined) {
            column.maxWidth = track.max
          }
          return column
        },
      }),
    },
  })
}
