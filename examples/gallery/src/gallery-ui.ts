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
  type Child,
  type MaybeSignal,
  type Renderer,
} from 'dynwinrt-jsx'
import {
  AutoSuggestBox,
  AppBarButton,
  AppBarSeparator,
  AppBarToggleButton,
  AnnotatedScrollBar,
  AnnotatedScrollBarLabel,
  AnimatedIcon,
  AnimatedVisualPlayer,
  Border,
  BitmapIcon,
  BreadcrumbBar,
  Button,
  CalendarDatePicker,
  CalendarView,
  Canvas,
  CheckBox,
  ColumnDefinition,
  ColorPicker,
  ComboBox,
  CommandBar,
  CommandBarFlyout,
  ContentControl,
  DatePicker,
  DropDownButton,
  Expander,
  Flyout,
  FlipView,
  FontIcon,
  Frame,
  Grid,
  GridView,
  GridViewItem,
  HyperlinkButton,
  IElementFactory,
  IObservableVector_Object,
  InfoBar,
  Image,
  ImageIcon,
  InfoBadge,
  ItemContainer,
  IReference_Int32,
  ItemsRepeater,
  ItemsView,
  ListView,
  ListViewItem,
  MapControl,
  MediaPlayerElement,
  MenuBar,
  MenuBarItem,
  MenuFlyout,
  MenuFlyoutItem,
  MenuFlyoutSeparator,
  MenuFlyoutSubItem,
  NavigationView,
  NavigationViewItem,
  NumberBox,
  ParallaxView,
  PasswordBox,
  PathIcon,
  PersonPicture,
  PipsPager,
  Pivot,
  PivotItem,
  ProgressBar,
  ProgressRing,
  PropertyValue,
  Popup,
  RadioButton,
  RadioButtons,
  RadioMenuFlyoutItem,
  RatingControl,
  RefreshContainer,
  RelativePanel,
  Rectangle,
  Path,
  Polygon,
  Polyline,
  Ellipse,
  Line,
  RepeatButton,
  RichEditBox,
  RichTextBlock,
  RowDefinition,
  ScrollView,
  ScrollViewer,
  SemanticZoom,
  SystemBackdropElement,
  Selector,
  SelectorBar,
  SelectorBarItem,
  Slider,
  StackPanel,
  SplitButton,
  SplitMenuFlyoutItem,
  SplitView,
  SymbolIcon,
  SwipeControl,
  SwipeItem,
  SwipeItems,
  TeachingTip,
  TabView,
  TabViewItem,
  TextBlock,
  TextBox,
  TimePicker,
  TitleBar,
  ToggleButton,
  ToggleMenuFlyoutItem,
  ToggleSplitButton,
  ToggleSwitch,
  TreeView,
  TreeViewNode,
  Paragraph,
  Run,
  VariableSizedWrapGrid,
  Viewbox,
  Window,
} from '#winapp/bindings'
import type { AppModel } from './app-model'
import type { AppNotificationOwner } from './app-notification-owner'
import type {
  GallerySecondaryWindowManager,
} from './secondary-window-manager'
import { commandBarCollection } from './command-bar-collection'

export const UI = createControls({
  AutoSuggestBox,
  AppBarButton,
  AppBarSeparator,
  AppBarToggleButton,
  AnimatedIcon,
  AnimatedVisualPlayer,
  Border,
  BitmapIcon,
  BreadcrumbBar,
  Button,
  CalendarDatePicker,
  CalendarView,
  Canvas,
  CheckBox,
  ColorPicker,
  ContentControl,
  DatePicker,
  Expander,
  Flyout,
  FlipView,
  FontIcon,
  Frame,
  Grid,
  GridView,
  GridViewItem,
  HyperlinkButton,
  InfoBadge,
  InfoBar,
  Image,
  ImageIcon,
  ListViewItem,
  MapControl,
  MediaPlayerElement,
  MenuBar,
  MenuBarItem,
  MenuFlyout,
  MenuFlyoutItem,
  MenuFlyoutSeparator,
  MenuFlyoutSubItem,
  NumberBox,
  ParallaxView,
  PasswordBox,
  PathIcon,
  PersonPicture,
  PipsPager,
  PivotItem,
  ProgressBar,
  ProgressRing,
  Popup,
  RadioButton,
  RadioMenuFlyoutItem,
  RatingControl,
  RefreshContainer,
  RelativePanel,
  Rectangle,
  Path,
  Polygon,
  Polyline,
  Ellipse,
  Line,
  RepeatButton,
  RichEditBox,
  ScrollView,
  ScrollViewer,
  SystemBackdropElement,
  SelectorBarItem,
  Slider,
  SplitMenuFlyoutItem,
  StackPanel,
  SymbolIcon,
  SwipeItem,
  TeachingTip,
  TabViewItem,
  TextBlock,
  TextBox,
  TimePicker,
  TitleBar,
  ToggleButton,
  ToggleMenuFlyoutItem,
  ToggleSwitch,
  Run,
  VariableSizedWrapGrid,
  Viewbox,
})
export const GalleryInfoBar = native<
  InfoBar,
  {
    action?: MaybeSignal<Child>
  }
>(InfoBar, {
  displayName: 'InfoBar',
  adapters: {
    action: adapter.slot('actionButton'),
  },
})
export const GalleryAppBarButton = native(AppBarButton, {
  displayName: 'AppBarButton',
  children: adapter.slot('flyout'),
})
export const GalleryCommandBar = native<
  CommandBar,
  {
    secondaryCommands?: MaybeSignal<Child>
  }
>(CommandBar, {
  displayName: 'CommandBar',
  adapters: {
    secondaryCommands: adapter.collectionSlotFrom(
      (instance) =>
        commandBarCollection(
          instance.secondaryCommands,
        ),
    ),
  },
  children: adapter.collectionSlotFrom(
    (instance) =>
      commandBarCollection(
        instance.primaryCommands,
      ),
  ),
})
export const GalleryCommandBarFlyout = native<
  CommandBarFlyout,
  {
    secondaryCommands?: MaybeSignal<Child>
  }
>(CommandBarFlyout, {
  displayName: 'CommandBarFlyout',
  adapters: {
    secondaryCommands: adapter.collectionSlotFrom(
      (instance) =>
        commandBarCollection(
          instance.secondaryCommands,
        ),
    ),
  },
  children: adapter.collectionSlotFrom(
    (instance) =>
      commandBarCollection(
        instance.primaryCommands,
      ),
  ),
})
export const GallerySwipeItems = native(SwipeItems, {
  displayName: 'SwipeItems',
  children: adapter.selfCollection(),
})
export const GallerySwipeControl = native<
  SwipeControl,
  {
    leftItemsContent?: MaybeSignal<Child>
    rightItemsContent?: MaybeSignal<Child>
  }
>(SwipeControl, {
  displayName: 'SwipeControl',
  adapters: {
    leftItemsContent: adapter.slot('leftItems'),
    rightItemsContent: adapter.slot('rightItems'),
  },
  children: adapter.slot('content'),
})
export const GallerySplitView = native<
  SplitView,
  {
    paneContent?: MaybeSignal<Child>
  }
>(SplitView, {
  displayName: 'SplitView',
  adapters: {
    paneContent: adapter.slot('pane'),
  },
  children: adapter.slot('content'),
})
export const GalleryPivot = native(Pivot, {
  displayName: 'Pivot',
  adapters: {
    selectedIndex: adapter.withPhase(
      adapter.oneWay(),
      'afterChildren',
    ),
  },
  children: adapter.collectionSlot('items'),
})
export const GalleryTabView = native<
  TabView,
  {
    tabStripHeaderContent?: MaybeSignal<Child>
    tabStripFooterContent?: MaybeSignal<Child>
  }
>(TabView, {
  displayName: 'TabView',
  adapters: {
    selectedIndex: adapter.withPhase(
      adapter.oneWay(),
      'afterChildren',
    ),
    tabStripHeaderContent: adapter.slot('tabStripHeader'),
    tabStripFooterContent: adapter.slot('tabStripFooter'),
  },
  children: adapter.collectionSlotFrom(
    (instance) => instance.tabItems,
  ),
})
export const GalleryAnnotatedScrollBar = native<
  AnnotatedScrollBar,
  {
    labelItems?: MaybeSignal<
      readonly AnnotatedScrollBarLabel[]
    >
  }
>(AnnotatedScrollBar, {
  displayName: 'AnnotatedScrollBar',
  adapters: {
    labelItems: adapter.collection({
      get: (instance) => instance.labels,
      label: 'AnnotatedScrollBar labels',
    }),
  },
})
export const GallerySemanticZoom = native<
  SemanticZoom,
  {
    zoomedInContent?: MaybeSignal<Child>
    zoomedOutContent?: MaybeSignal<Child>
  }
>(SemanticZoom, {
  displayName: 'SemanticZoom',
  adapters: {
    zoomedInContent: adapter.slot('zoomedInView'),
    zoomedOutContent: adapter.slot('zoomedOutView'),
  },
})
export const GalleryTitleBar = native<
  TitleBar,
  {
    leftHeaderContent?: MaybeSignal<Child>
    rightHeaderContent?: MaybeSignal<Child>
  }
>(TitleBar, {
  displayName: 'TitleBar',
  adapters: {
    leftHeaderContent: adapter.slot('leftHeader'),
    rightHeaderContent: adapter.slot('rightHeader'),
  },
  children: adapter.slot('content'),
})
export const GalleryRichTextBlock = native(RichTextBlock, {
  displayName: 'RichTextBlock',
  children: adapter.collectionSlot('blocks'),
})
export const GalleryParagraph = native(Paragraph, {
  displayName: 'Paragraph',
  children: adapter.collectionSlot('inlines'),
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
export type ComboBoxInstance = InstanceType<typeof ComboBox>
export type RadioButtonsInstance = InstanceType<typeof RadioButtons>
export type AppBarToggleButtonInstance =
  InstanceType<typeof AppBarToggleButton>
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
export type TeachingTipInstance = InstanceType<typeof TeachingTip>
export type FlyoutInstance = InstanceType<typeof Flyout>
export type FrameInstance = InstanceType<typeof Frame>
export type ParallaxViewInstance = InstanceType<typeof ParallaxView>
export type PopupInstance = InstanceType<typeof Popup>
export type ToggleInstance = InstanceType<typeof ToggleSwitch>
export type RefreshContainerInstance =
  InstanceType<typeof RefreshContainer>

export interface AppContext {
  readonly model: AppModel
  readonly renderer: Renderer
  readonly window: Window
  readonly appNotifications: AppNotificationOwner
  readonly secondaryWindows: GallerySecondaryWindowManager
  readonly shellCapabilities: {
    readonly appNotifications: {
      readonly available: boolean
      readonly description: string
      readonly aumid: string | null
    }
  }
  refreshDiagnostics(): void
  exportDiagnostics(): void
}

export const ThemeControllerContext = createContext<{
  setDark(value: boolean): void
} | null>(null)
