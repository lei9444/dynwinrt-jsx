import {
  adapter,
  createComboBoxControl,
  createContext,
  createControls,
  createGridControl,
  createItemsRepeaterControl,
  createListViewControl,
  createNavigationViewControl,
  createSelectorBarControl,
  createVirtualizedItemsControl,
  native,
  type MaybeSignal,
  type Renderer,
} from 'dynwinrt-jsx'
import {
  AutoSuggestBox,
  Border,
  Button,
  CalendarDatePicker,
  CalendarView,
  CheckBox,
  ColumnDefinition,
  ColorPicker,
  ComboBox,
  ContentControl,
  DatePicker,
  DropDownButton,
  Expander,
  Flyout,
  FlipView,
  FontIcon,
  Grid,
  GridView,
  GridViewItem,
  HyperlinkButton,
  IElementFactory,
  IObservableVector_Object,
  InfoBar,
  Image,
  ItemContainer,
  IReference_Int32,
  ItemsRepeater,
  ItemsView,
  ListView,
  ListViewItem,
  MenuFlyout,
  MenuFlyoutItem,
  NavigationView,
  NavigationViewItem,
  NumberBox,
  PasswordBox,
  ProgressBar,
  ProgressRing,
  PropertyValue,
  RadioButton,
  RadioButtons,
  RatingControl,
  RefreshContainer,
  RepeatButton,
  RowDefinition,
  ScrollViewer,
  Selector,
  SelectorBar,
  SelectorBarItem,
  Slider,
  StackPanel,
  SplitButton,
  SymbolIcon,
  TextBlock,
  TextBox,
  TimePicker,
  TitleBar,
  ToggleButton,
  ToggleSplitButton,
  ToggleSwitch,
  TreeView,
  TreeViewNode,
  Window,
} from '#winapp/bindings'
import type { AppModel } from './app-model'

export const UI = createControls({
  AutoSuggestBox,
  Border,
  Button,
  CalendarDatePicker,
  CalendarView,
  CheckBox,
  ColorPicker,
  DatePicker,
  Expander,
  Flyout,
  FlipView,
  FontIcon,
  Grid,
  GridView,
  GridViewItem,
  HyperlinkButton,
  InfoBar,
  Image,
  ListViewItem,
  MenuFlyout,
  MenuFlyoutItem,
  NumberBox,
  PasswordBox,
  ProgressBar,
  ProgressRing,
  RadioButton,
  RatingControl,
  RefreshContainer,
  RepeatButton,
  ScrollViewer,
  SelectorBarItem,
  Slider,
  StackPanel,
  SymbolIcon,
  TextBlock,
  TextBox,
  TimePicker,
  TitleBar,
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
export const GalleryRadioButtons = native(RadioButtons, {
  displayName: 'RadioButtons',
  adapters: {
    selectedIndex: adapter.withPhase(
      adapter.oneWay(),
      'afterChildren',
    ),
  },
  children: adapter.collectionSlot('items'),
})
export const GalleryDropDownButton = native(DropDownButton, {
  displayName: 'DropDownButton',
  children: adapter.slot('flyout'),
})
export const GallerySplitButton = native(SplitButton, {
  displayName: 'SplitButton',
  children: adapter.slot('flyout'),
})
export const GalleryToggleSplitButton = native(
  ToggleSplitButton,
  {
    displayName: 'ToggleSplitButton',
    children: adapter.slot('flyout'),
  },
)
export const GalleryListView = createListViewControl({
  ListView,
  selectedIndexProperty: Selector.selectedIndexProperty,
})
export const GallerySelectorBar = createSelectorBarControl<
  SelectorBar,
  SelectorBarItem
>({ SelectorBar })
export const GalleryItemsRepeater = createItemsRepeaterControl({
  ItemsRepeater,
  ContentControl,
  IElementFactory,
  IObservableVector_Object,
  PropertyValue,
  IReference_Int32,
})
const itemsViewMountHosts =
  new WeakMap<ItemContainer, ContentControl>()
export const GalleryItemsView =
  createVirtualizedItemsControl({
    Control: ItemsView,
    ItemHost: ItemContainer,
    initializeItemHost: (host) => {
      host.isEnabled = true
      const mountHost = new ContentControl()
      host.child = mountHost
      itemsViewMountHosts.set(host, mountHost)
    },
    getItemMountHost: (host) => {
      const mountHost = itemsViewMountHosts.get(host)
      if (!mountHost) {
        throw new Error('ItemsView item mount host is missing.')
      }
      return mountHost
    },
    clearItemsSource: (instance) => {
      instance.itemsSource = null
    },
    IElementFactory,
    IObservableVector_Object,
    PropertyValue,
    IReference_Int32,
  }, {
    displayName: 'ItemsView',
  })
export const GalleryTreeView = native<
  TreeView,
  {
    rootNodes?: MaybeSignal<readonly TreeViewNode[]>
  }
>(TreeView, {
  displayName: 'TreeView',
  adapters: {
    rootNodes: adapter.collection({
      get: (instance) => instance.rootNodes,
      label: 'TreeView rootNodes',
    }),
  },
})

export type NavigationInstance = InstanceType<typeof NavigationView>
export type ButtonInstance = InstanceType<typeof Button>
export type BorderInstance = InstanceType<typeof Border>
export type CalendarViewInstance = InstanceType<typeof CalendarView>
export type TitleBarInstance = InstanceType<typeof TitleBar>
export type NumberBoxInstance = InstanceType<typeof NumberBox>
export type PasswordBoxInstance = InstanceType<typeof PasswordBox>
export type SliderInstance = InstanceType<typeof Slider>
export type ScrollViewerInstance = InstanceType<typeof ScrollViewer>
export type TextBoxInstance = InstanceType<typeof TextBox>
export type ToggleButtonInstance = InstanceType<typeof ToggleButton>
export type FlyoutInstance = InstanceType<typeof Flyout>
export type ToggleInstance = InstanceType<typeof ToggleSwitch>
export type RefreshContainerInstance =
  InstanceType<typeof RefreshContainer>

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
