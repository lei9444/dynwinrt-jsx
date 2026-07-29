import {
  createControls,
  createGridControl,
} from 'dynwinrt-jsx'
import {
  Button,
  Border,
  ColumnDefinition,
  Grid,
  RowDefinition,
  ScrollViewer,
  Slider,
  StackPanel,
  TextBlock,
} from '#winapp/bindings'

export const UI = createControls({
  Button,
  Border,
  ScrollViewer,
  Slider,
  StackPanel,
  TextBlock,
})

export const LayoutGrid = createGridControl({
  Grid,
  RowDefinition,
  ColumnDefinition,
})
