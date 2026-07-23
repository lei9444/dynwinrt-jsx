import {
  createComboBoxControl,
  createContext,
  createControls,
  createGridControl,
  createItemsRepeaterControl,
  createListViewControl,
  createNavigationViewControl,
  type Renderer,
} from 'dynwinrt-jsx'
import {
  AutoSuggestBox,
  Border,
  Button,
  CheckBox,
  ColumnDefinition,
  ComboBox,
  ContentControl,
  FontIcon,
  Grid,
  IElementFactory,
  IObservableVector_Object,
  InfoBar,
  Image,
  IReference_Int32,
  ItemsRepeater,
  ListView,
  ListViewItem,
  NavigationView,
  NavigationViewItem,
  NumberBox,
  PasswordBox,
  ProgressBar,
  ProgressRing,
  PropertyValue,
  RadioButton,
  RowDefinition,
  ScrollViewer,
  Selector,
  Slider,
  StackPanel,
  SymbolIcon,
  TextBlock,
  TextBox,
  ToggleButton,
  ToggleSwitch,
  Window,
} from '#winapp/bindings'
import type { AppModel } from './app-model'

export const UI = createControls({
  AutoSuggestBox,
  Border,
  Button,
  CheckBox,
  Grid,
  FontIcon,
  InfoBar,
  Image,
  ListViewItem,
  NumberBox,
  PasswordBox,
  ProgressBar,
  ProgressRing,
  RadioButton,
  ScrollViewer,
  Slider,
  StackPanel,
  SymbolIcon,
  TextBlock,
  TextBox,
  ToggleButton,
  ToggleSwitch,
})
export const LayoutGrid = createGridControl({
  Grid,
  RowDefinition,
  ColumnDefinition,
})
export const Navigation = createNavigationViewControl<
  NavigationView,
  NavigationViewItem
>({ NavigationView })
export const GalleryComboBox = createComboBoxControl({
  ComboBox,
  selectedIndexProperty: Selector.selectedIndexProperty,
})
export const GalleryListView = createListViewControl({
  ListView,
  selectedIndexProperty: Selector.selectedIndexProperty,
})
export const GalleryItemsRepeater = createItemsRepeaterControl({
  ItemsRepeater,
  ContentControl,
  IElementFactory,
  IObservableVector_Object,
  PropertyValue,
  IReference_Int32,
})

export type NavigationInstance = InstanceType<typeof NavigationView>
export type ButtonInstance = InstanceType<typeof Button>
export type BorderInstance = InstanceType<typeof Border>
export type NumberBoxInstance = InstanceType<typeof NumberBox>
export type PasswordBoxInstance = InstanceType<typeof PasswordBox>
export type SliderInstance = InstanceType<typeof Slider>
export type ScrollViewerInstance = InstanceType<typeof ScrollViewer>
export type TextBoxInstance = InstanceType<typeof TextBox>
export type ToggleButtonInstance = InstanceType<typeof ToggleButton>
export type ToggleInstance = InstanceType<typeof ToggleSwitch>

export interface AppContext {
  readonly model: AppModel
  readonly renderer: Renderer
  readonly window: Window
  refreshDiagnostics(): void
  exportDiagnostics(): void
}

export const ThemeControllerContext = createContext<{
  setDark(value: boolean): void
} | null>(null)
