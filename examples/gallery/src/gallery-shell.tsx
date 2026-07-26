import {
  ErrorBoundary,
  computed,
  createNavigationHost,
  createNavigationItem,
  createSymbolIcon,
  createWinUIThemeController,
  gridLength,
  onCleanup,
  styles,
  theme,
  thickness,
  type Child,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  Application,
  ApplicationTheme,
  AutomationProperties,
  DispatcherQueuePriority,
  ElementTheme,
  HorizontalAlignment,
  ImageIconSource,
  NavigationViewBackButtonVisible,
  NavigationViewItem,
  NavigationViewPaneDisplayMode,
  PropertyValue,
  Symbol,
  SymbolIcon,
  TextBlock,
  TextWrapping,
  TitleBarTheme,
  VerticalAlignment,
} from '#winapp/bindings'
import {
  type AppContext,
  LayoutGrid,
  Navigation,
  type NavigationInstance,
  ThemeControllerContext,
  type TitleBarInstance,
  UI,
} from './gallery-ui'
import { loadGalleryBitmap } from './gallery-assets'
import {
  findGalleryPage,
  galleryPages,
  type GalleryPageId,
  type GalleryRoute,
} from './gallery-data'
import { HomePage } from './pages/home'
import { SearchPage } from './pages/search'
import { SignalsPage } from './pages/signals'
import { ButtonPage } from './pages/basic-input/button'
import { CheckBoxPage } from './pages/basic-input/check-box'
import { ColorPickerPage } from './pages/basic-input/color-picker'
import { ComboBoxPage } from './pages/basic-input/combo-box'
import { DropDownButtonPage } from './pages/basic-input/drop-down-button'
import { HyperlinkButtonPage } from './pages/basic-input/hyperlink-button'
import { RadioButtonPage } from './pages/basic-input/radio-button'
import { RatingControlPage } from './pages/basic-input/rating-control'
import { RepeatButtonPage } from './pages/basic-input/repeat-button'
import { SliderPage } from './pages/basic-input/slider'
import { SplitButtonPage } from './pages/basic-input/split-button'
import { ToggleButtonPage } from './pages/basic-input/toggle-button'
import { ToggleSplitButtonPage } from './pages/basic-input/toggle-split-button'
import { ToggleSwitchPage } from './pages/basic-input/toggle-switch'
import { BasicInputCategoryPage } from './pages/basic-input'
import { CollectionsCategoryPage } from './pages/collections/index'
import { FlipViewPage } from './pages/collections/flip-view'
import { GridViewPage } from './pages/collections/grid-view'
import { ItemsRepeaterPage } from './pages/collections/items-repeater'
import { ItemsViewPage } from './pages/collections/items-view'
import { ListViewPage } from './pages/collections/list-view'
import { PullToRefreshPage } from './pages/collections/pull-to-refresh'
import { TreeViewPage } from './pages/collections/tree-view'
import { DateTimeCategoryPage } from './pages/date-time'
import { CalendarDatePickerPage } from './pages/date-time/calendar-date-picker'
import { CalendarViewPage } from './pages/date-time/calendar-view'
import { DatePickerPage } from './pages/date-time/date-picker'
import { TimePickerPage } from './pages/date-time/time-picker'
import { DialogsFlyoutsCategoryPage } from './pages/dialogs-flyouts'
import { ContentDialogPage } from './pages/dialogs-flyouts/content-dialog'
import { FlyoutPage } from './pages/dialogs-flyouts/flyout'
import { PopupPage } from './pages/dialogs-flyouts/popup'
import { TeachingTipPage } from './pages/dialogs-flyouts/teaching-tip'
import { SelectionPage } from './pages/selection'
import { StatusInfoCategoryPage } from './pages/status-info'
import { InfoBadgePage } from './pages/status-info/info-badge'
import { InfoBarPage } from './pages/status-info/info-bar'
import { ProgressBarPage } from './pages/status-info/progress-bar'
import { ProgressRingPage } from './pages/status-info/progress-ring'
import { ToolTipPage } from './pages/status-info/tool-tip'
import { LayoutCategoryPage } from './pages/layout/index'
import { BorderPage } from './pages/layout/border'
import { CanvasPage } from './pages/layout/canvas'
import { ExpanderPage } from './pages/layout/expander'
import { GridPage } from './pages/layout/grid'
import { RelativePanelPage } from './pages/layout/relative-panel'
import { SplitViewPage } from './pages/layout/split-view'
import { StackPanelPage } from './pages/layout/stack-panel'
import { VariableSizedWrapGridPage } from './pages/layout/variable-sized-wrap-grid'
import { ViewboxPage } from './pages/layout/viewbox'
import { MediaCategoryPage } from './pages/media'
import { AnimatedVisualPlayerPage } from './pages/media/animated-visual-player'
import { CaptureElementPreviewPage } from './pages/media/capture-element-preview'
import { ImagePage } from './pages/media/image'
import { MapControlPage } from './pages/media/map-control'
import { MediaPlayerElementPage } from './pages/media/media-player-element'
import { PersonPicturePage } from './pages/media/person-picture'
import { SoundPage } from './pages/media/sound'
import { MotionCategoryPage } from './pages/motion'
import { AnimationInteropPage } from './pages/motion/animation-interop'
import { ConnectedAnimationPage } from './pages/motion/connected-animation'
import { EasingFunctionsPage } from './pages/motion/easing-functions'
import { ImplicitTransitionsPage } from './pages/motion/implicit-transitions'
import { PageTransitionsPage } from './pages/motion/page-transitions'
import { ParallaxViewPage } from './pages/motion/parallax-view'
import { ThemeTransitionsPage } from './pages/motion/theme-transitions'
import { WindowingCategoryPage } from './pages/windowing'
import { AppWindowPage } from './pages/windowing/app-window'
import { AppWindowTitleBarPage } from './pages/windowing/app-window-title-bar'
import { MultipleWindowsPage } from './pages/windowing/multiple-windows'
import { TitleBarPage } from './pages/windowing/title-bar'
import { SystemCategoryPage } from './pages/system'
import { ClipboardPage } from './pages/system/clipboard'
import { ContentIslandPage } from './pages/system/content-island'
import { StoragePickersPage } from './pages/system/storage-pickers'
import { ShellCategoryPage } from './pages/shell'
import { AppNotificationsPage } from './pages/shell/app-notifications'
import { BadgeNotificationsPage } from './pages/shell/badge-notifications'
import { JumpListPage } from './pages/shell/jump-list'
import { MenusToolbarsCategoryPage } from './pages/menus-toolbars'
import { AppBarButtonPage } from './pages/menus-toolbars/app-bar-button'
import { AppBarSeparatorPage } from './pages/menus-toolbars/app-bar-separator'
import { AppBarToggleButtonPage } from './pages/menus-toolbars/app-bar-toggle-button'
import { CommandBarPage } from './pages/menus-toolbars/command-bar'
import { CommandBarFlyoutPage } from './pages/menus-toolbars/command-bar-flyout'
import { MenuBarPage } from './pages/menus-toolbars/menu-bar'
import { MenuFlyoutPage } from './pages/menus-toolbars/menu-flyout'
import { SwipeControlPage } from './pages/menus-toolbars/swipe-control'
import { StandardUICommandPage } from './pages/menus-toolbars/standard-ui-command'
import { XamlUICommandPage } from './pages/menus-toolbars/xaml-ui-command'
import { NavigationCategoryPage } from './pages/navigation'
import { BreadcrumbBarPage } from './pages/navigation/breadcrumb-bar'
import { NavigationViewPage } from './pages/navigation/navigation-view'
import { PivotPage } from './pages/navigation/pivot'
import { SelectorBarPage } from './pages/navigation/selector-bar'
import { TabViewPage } from './pages/navigation/tab-view'
import { ScrollingCategoryPage } from './pages/scrolling'
import { AnnotatedScrollBarPage } from './pages/scrolling/annotated-scroll-bar'
import { PipsPagerPage } from './pages/scrolling/pips-pager'
import { ScrollViewPage } from './pages/scrolling/scroll-view'
import { ScrollViewerPage } from './pages/scrolling/scroll-viewer'
import { SemanticZoomPage } from './pages/scrolling/semantic-zoom'
import { TextCategoryPage } from './pages/text'
import { AutoSuggestBoxPage } from './pages/text/auto-suggest-box'
import { NumberBoxPage } from './pages/text/number-box'
import { PasswordBoxPage } from './pages/text/password-box'
import { RichEditBoxPage } from './pages/text/rich-edit-box'
import { RichTextBlockPage } from './pages/text/rich-text-block'
import { TextBlockPage } from './pages/text/text-block'
import { TextBoxPage } from './pages/text/text-box'
import { FundamentalsCategoryPage } from './pages/fundamentals'
import { StylePage } from './pages/fundamentals/style'
import { BindingPage } from './pages/fundamentals/binding'
import { TemplatesPage } from './pages/fundamentals/templates'
import { CustomUserControlsPage } from './pages/fundamentals/custom-user-controls'
import { XamlConditionsPage } from './pages/fundamentals/xaml-conditions'
import { ScratchPadPage } from './pages/fundamentals/scratch-pad'
import { DesignCategoryPage } from './pages/design'
import { ColorPage } from './pages/design/color'
import { GeometryPage } from './pages/design/geometry'
import { IconographyPage } from './pages/design/iconography'
import { SpacingPage } from './pages/design/spacing'
import { TypographyPage } from './pages/design/typography'
import { AccessibilityCategoryPage } from './pages/accessibility'
import { ColorContrastPage } from './pages/accessibility/color-contrast'
import { KeyboardNavigationPage } from './pages/accessibility/keyboard-navigation'
import { ScreenReaderPage } from './pages/accessibility/screen-reader'
import { StylesCategoryPage } from './pages/styles'
import { AcrylicBrushPage } from './pages/styles/acrylic-brush'
import { AnimatedIconPage } from './pages/styles/animated-icon'
import { CompactSizingPage } from './pages/styles/compact-sizing'
import { IconElementPage } from './pages/styles/icon-element'
import { LinePage } from './pages/styles/line'
import { ShapePage } from './pages/styles/shape'
import { RadialGradientBrushPage } from './pages/styles/radial-gradient-brush'
import { SystemBackdropsPage } from './pages/styles/system-backdrops'
import { SystemBackdropElementPage } from './pages/styles/system-backdrop-element'
import { ThemeShadowPage } from './pages/styles/theme-shadow'
import { ResourcesPage } from './pages/resources'
import { DiagnosticsPage } from './pages/diagnostics'
import { SettingsPage } from './pages/settings'

function renderSamplePage(
  context: AppContext,
  route: GalleryPageId,
): Child {
  switch (route) {
    case 'signals':
      return <SignalsPage {...context} />
    case 'button':
      return <ButtonPage {...context} />
    case 'drop-down-button':
      return <DropDownButtonPage {...context} />
    case 'hyperlink-button':
      return <HyperlinkButtonPage {...context} />
    case 'repeat-button':
      return <RepeatButtonPage {...context} />
    case 'toggle-button':
      return <ToggleButtonPage {...context} />
    case 'split-button':
      return <SplitButtonPage {...context} />
    case 'toggle-split-button':
      return <ToggleSplitButtonPage {...context} />
    case 'check-box':
      return <CheckBoxPage {...context} />
    case 'color-picker':
      return <ColorPickerPage {...context} />
    case 'combo-box':
      return <ComboBoxPage {...context} />
    case 'radio-button':
      return <RadioButtonPage {...context} />
    case 'rating-control':
      return <RatingControlPage {...context} />
    case 'slider':
      return <SliderPage {...context} />
    case 'toggle-switch':
      return <ToggleSwitchPage {...context} />
    case 'selection':
      return <SelectionPage {...context} />
    case 'info-badge':
      return <InfoBadgePage {...context} />
    case 'info-bar':
      return <InfoBarPage {...context} />
    case 'progress-bar':
      return <ProgressBarPage {...context} />
    case 'progress-ring':
      return <ProgressRingPage {...context} />
    case 'tool-tip':
      return <ToolTipPage {...context} />
    case 'flip-view':
      return <FlipViewPage {...context} />
    case 'grid-view':
      return <GridViewPage {...context} />
    case 'items-repeater':
      return <ItemsRepeaterPage {...context} />
    case 'items-view':
      return <ItemsViewPage {...context} />
    case 'list-view':
      return <ListViewPage {...context} />
    case 'pull-to-refresh':
      return <PullToRefreshPage {...context} />
    case 'tree-view':
      return <TreeViewPage {...context} />
    case 'calendar-date-picker':
      return <CalendarDatePickerPage {...context} />
    case 'calendar-view':
      return <CalendarViewPage {...context} />
    case 'date-picker':
      return <DatePickerPage {...context} />
    case 'time-picker':
      return <TimePickerPage {...context} />
    case 'content-dialog':
      return <ContentDialogPage {...context} />
    case 'flyout':
      return <FlyoutPage {...context} />
    case 'popup':
      return <PopupPage {...context} />
    case 'teaching-tip':
      return <TeachingTipPage {...context} />
    case 'border':
      return <BorderPage {...context} />
    case 'canvas':
      return <CanvasPage {...context} />
    case 'expander':
      return <ExpanderPage {...context} />
    case 'grid':
      return <GridPage {...context} />
    case 'relative-panel':
      return <RelativePanelPage {...context} />
    case 'split-view':
      return <SplitViewPage {...context} />
    case 'stack-panel':
      return <StackPanelPage {...context} />
    case 'variable-sized-wrap-grid':
      return <VariableSizedWrapGridPage {...context} />
    case 'viewbox':
      return <ViewboxPage {...context} />
    case 'animated-visual-player':
      return <AnimatedVisualPlayerPage {...context} />
    case 'capture-element-preview':
      return <CaptureElementPreviewPage {...context} />
    case 'image':
      return <ImagePage {...context} />
    case 'map-control':
      return <MapControlPage {...context} />
    case 'media-player-element':
      return <MediaPlayerElementPage {...context} />
    case 'person-picture':
      return <PersonPicturePage {...context} />
    case 'sound':
      return <SoundPage {...context} />
    case 'animation-interop':
      return <AnimationInteropPage {...context} />
    case 'connected-animation':
      return <ConnectedAnimationPage {...context} />
    case 'easing-functions':
      return <EasingFunctionsPage {...context} />
    case 'implicit-transitions':
      return <ImplicitTransitionsPage {...context} />
    case 'page-transitions':
      return <PageTransitionsPage {...context} />
    case 'theme-transitions':
      return <ThemeTransitionsPage {...context} />
    case 'parallax-view':
      return <ParallaxViewPage {...context} />
    case 'app-window':
      return <AppWindowPage {...context} />
    case 'app-window-title-bar':
      return <AppWindowTitleBarPage {...context} />
    case 'multiple-windows':
      return <MultipleWindowsPage {...context} />
    case 'title-bar':
      return <TitleBarPage {...context} />
    case 'clipboard':
      return <ClipboardPage {...context} />
    case 'content-island':
      return <ContentIslandPage {...context} />
    case 'storage-pickers':
      return <StoragePickersPage {...context} />
    case 'app-notifications':
      return <AppNotificationsPage {...context} />
    case 'badge-notifications':
      return <BadgeNotificationsPage {...context} />
    case 'jump-list':
      return <JumpListPage {...context} />
    case 'app-bar-button':
      return <AppBarButtonPage {...context} />
    case 'app-bar-separator':
      return <AppBarSeparatorPage {...context} />
    case 'app-bar-toggle-button':
      return <AppBarToggleButtonPage {...context} />
    case 'command-bar':
      return <CommandBarPage {...context} />
    case 'command-bar-flyout':
      return <CommandBarFlyoutPage {...context} />
    case 'menu-bar':
      return <MenuBarPage {...context} />
    case 'menu-flyout':
      return <MenuFlyoutPage {...context} />
    case 'swipe-control':
      return <SwipeControlPage {...context} />
    case 'standard-ui-command':
      return <StandardUICommandPage {...context} />
    case 'xaml-ui-command':
      return <XamlUICommandPage {...context} />
    case 'breadcrumb-bar':
      return <BreadcrumbBarPage {...context} />
    case 'navigation-view':
      return <NavigationViewPage {...context} />
    case 'pivot':
      return <PivotPage {...context} />
    case 'selector-bar':
      return <SelectorBarPage {...context} />
    case 'tab-view':
      return <TabViewPage {...context} />
    case 'annotated-scroll-bar':
      return <AnnotatedScrollBarPage {...context} />
    case 'pips-pager':
      return <PipsPagerPage {...context} />
    case 'scroll-view':
      return <ScrollViewPage {...context} />
    case 'scroll-viewer':
      return <ScrollViewerPage {...context} />
    case 'semantic-zoom':
      return <SemanticZoomPage {...context} />
    case 'auto-suggest-box':
      return <AutoSuggestBoxPage {...context} />
    case 'number-box':
      return <NumberBoxPage {...context} />
    case 'password-box':
      return <PasswordBoxPage {...context} />
    case 'rich-edit-box':
      return <RichEditBoxPage {...context} />
    case 'rich-text-block':
      return <RichTextBlockPage {...context} />
    case 'text-block':
      return <TextBlockPage {...context} />
    case 'text-box':
      return <TextBoxPage {...context} />
    case 'style':
      return <StylePage {...context} />
    case 'binding':
      return <BindingPage {...context} />
    case 'templates':
      return <TemplatesPage {...context} />
    case 'custom-user-controls':
      return <CustomUserControlsPage {...context} />
    case 'xaml-conditions':
      return <XamlConditionsPage {...context} />
    case 'scratch-pad':
      return <ScratchPadPage {...context} />
    case 'resources':
      return <ResourcesPage {...context} />
    case 'color':
      return <ColorPage {...context} />
    case 'geometry':
      return <GeometryPage {...context} />
    case 'iconography':
      return <IconographyPage {...context} />
    case 'spacing':
      return <SpacingPage {...context} />
    case 'typography':
      return <TypographyPage {...context} />
    case 'color-contrast':
      return <ColorContrastPage {...context} />
    case 'keyboard-navigation':
      return <KeyboardNavigationPage {...context} />
    case 'screen-reader':
      return <ScreenReaderPage {...context} />
    case 'acrylic-brush':
      return <AcrylicBrushPage {...context} />
    case 'animated-icon':
      return <AnimatedIconPage {...context} />
    case 'compact-sizing':
      return <CompactSizingPage {...context} />
    case 'icon-element':
      return <IconElementPage {...context} />
    case 'line':
      return <LinePage {...context} />
    case 'shape':
      return <ShapePage {...context} />
    case 'radial-gradient-brush':
      return <RadialGradientBrushPage {...context} />
    case 'system-backdrops':
      return <SystemBackdropsPage {...context} />
    case 'system-backdrop-element':
      return <SystemBackdropElementPage {...context} />
    case 'theme-shadow':
      return <ThemeShadowPage {...context} />
  }
}

function renderRoute(
  context: AppContext,
  route: GalleryRoute,
): Child {
  switch (route) {
    case 'home':
      return <HomePage {...context} />
    case 'search':
      return <SearchPage {...context} />
    case 'category-basic-input':
      return <BasicInputCategoryPage {...context} />
    case 'category-collections':
      return <CollectionsCategoryPage {...context} />
    case 'category-date-time':
      return <DateTimeCategoryPage {...context} />
    case 'category-dialogs-flyouts':
      return <DialogsFlyoutsCategoryPage {...context} />
    case 'category-status-info':
      return <StatusInfoCategoryPage {...context} />
    case 'category-layout':
      return <LayoutCategoryPage {...context} />
    case 'category-media':
      return <MediaCategoryPage {...context} />
    case 'category-motion':
      return <MotionCategoryPage {...context} />
    case 'category-windowing':
      return <WindowingCategoryPage {...context} />
    case 'category-system':
      return <SystemCategoryPage {...context} />
    case 'category-shell':
      return <ShellCategoryPage {...context} />
    case 'category-menus-toolbars':
      return <MenusToolbarsCategoryPage {...context} />
    case 'category-navigation':
      return <NavigationCategoryPage {...context} />
    case 'category-scrolling':
      return <ScrollingCategoryPage {...context} />
    case 'category-text':
      return <TextCategoryPage {...context} />
    case 'category-fundamentals':
      return <FundamentalsCategoryPage {...context} />
    case 'category-design':
      return <DesignCategoryPage {...context} />
    case 'category-accessibility':
      return <AccessibilityCategoryPage {...context} />
    case 'category-styles':
      return <StylesCategoryPage {...context} />
    case 'diagnostics':
      return <DiagnosticsPage {...context} />
    case 'settings':
      return <SettingsPage {...context} />
    default:
      return renderSamplePage(context, route)
  }
}

export function Shell(context: AppContext) {
  const navigation: RefObject<NavigationInstance> = {
    current: null,
  }
  const titleBar: RefObject<TitleBarInstance> = {
    current: null,
  }
  const appIcon = new ImageIconSource()
  appIcon.imageSource = loadGalleryBitmap('GalleryAppIcon.png', 20)
  const themeController = createWinUIThemeController({
    isDark: context.model.darkTheme,
    setDark: context.model.setDarkTheme,
    application: Application.current,
    applicationTheme: ApplicationTheme,
    elementTheme: ElementTheme,
    titleBar: context.window.appWindow.titleBar,
    titleBarTheme: TitleBarTheme,
  })
  onCleanup(themeController.dispose)

  const itemBindings = {
    NavigationViewItem,
    TextBlock,
    AutomationProperties,
  }
  const homeItem = createNavigationItem(itemBindings, {
    name: 'home',
    label: 'Home',
    icon: createSymbolIcon(SymbolIcon, Symbol.Home),
    automationId: 'GalleryHomeNavItem',
  })
  const pageItems = new Map<GalleryPageId, NavigationViewItem>(
    galleryPages.map((page) => [
      page.id,
      createNavigationItem(itemBindings, {
        name: page.id,
        label: page.title,
        automationId: `Gallery${page.id}NavItem`,
      }),
    ]),
  )
  const createNavigationGroup = (
    name: string,
    label: string,
    symbol: Symbol,
    pageIds: readonly GalleryPageId[],
    route?: GalleryRoute,
  ) => {
    const item = createNavigationItem(itemBindings, {
      name: route ?? `category-${name}`,
      label,
      icon: createSymbolIcon(SymbolIcon, symbol),
      selectsOnInvoked: route !== undefined,
      automationId: `Gallery${name}CategoryNavItem`,
    })
    item.isExpanded = false
    if (pageIds.length === 0) {
      item.menuItems.append(createNavigationItem(itemBindings, {
        name: `placeholder-${name}`,
        label: 'Coming soon',
        selectsOnInvoked: false,
      }))
      return item
    }
    for (const pageId of pageIds) {
      item.menuItems.append(pageItems.get(pageId)!)
    }
    return item
  }
  const controlsHeader = createNavigationItem(itemBindings, {
    name: 'controls-header',
    label: 'Controls',
    selectsOnInvoked: false,
    automationId: 'GalleryControlsHeader',
  })
  const allItem = createNavigationItem(itemBindings, {
    name: 'all-controls',
    label: 'All',
    icon: createSymbolIcon(SymbolIcon, Symbol.AllApps),
    selectsOnInvoked: false,
    automationId: 'GalleryAllControlsNavItem',
  })
  const basicInputItem = createNavigationGroup(
    'BasicInput',
    'Basic input',
    Symbol.TouchPointer,
    [
      'button',
      'drop-down-button',
      'hyperlink-button',
      'repeat-button',
      'toggle-button',
      'split-button',
      'toggle-split-button',
      'check-box',
      'color-picker',
      'combo-box',
      'radio-button',
      'rating-control',
      'slider',
      'toggle-switch',
    ],
    'category-basic-input',
  )
  const collectionsItem = createNavigationGroup(
    'Collections',
    'Collections',
    Symbol.Bullets,
    [
      'flip-view',
      'grid-view',
      'items-repeater',
      'items-view',
      'list-view',
      'pull-to-refresh',
      'tree-view',
    ],
    'category-collections',
  )
  const dateTimeItem = createNavigationGroup(
    'DateTime',
    'Date & time',
    Symbol.Clock,
    [
      'calendar-date-picker',
      'calendar-view',
      'date-picker',
      'time-picker',
    ],
    'category-date-time',
  )
  const dialogsFlyoutsItem = createNavigationGroup(
    'DialogsFlyouts',
    'Dialogs & flyouts',
    Symbol.OpenWith,
    [
      'content-dialog',
      'flyout',
      'popup',
      'teaching-tip',
    ],
    'category-dialogs-flyouts',
  )
  const statusInfoItem = createNavigationGroup(
    'StatusInfo',
    'Status & info',
    Symbol.Flag,
    [
      'info-badge',
      'info-bar',
      'progress-bar',
      'progress-ring',
      'tool-tip',
    ],
    'category-status-info',
  )
  const layoutItem = createNavigationGroup(
    'Layout',
    'Layout',
    Symbol.Page,
    [
      'border',
      'canvas',
      'expander',
      'grid',
      'relative-panel',
      'split-view',
      'stack-panel',
      'variable-sized-wrap-grid',
      'viewbox',
    ],
    'category-layout',
  )
  const menusToolbarsItem = createNavigationGroup(
    'MenusToolbars',
    'Menus & toolbars',
    Symbol.Bullets,
    [
      'app-bar-button',
      'app-bar-separator',
      'app-bar-toggle-button',
      'command-bar',
      'command-bar-flyout',
      'menu-bar',
      'menu-flyout',
      'swipe-control',
      'standard-ui-command',
      'xaml-ui-command',
    ],
    'category-menus-toolbars',
  )
  const navigationItem = createNavigationGroup(
    'Navigation',
    'Navigation',
    Symbol.GlobalNavigationButton,
    [
      'breadcrumb-bar',
      'navigation-view',
      'pivot',
      'selector-bar',
      'tab-view',
    ],
    'category-navigation',
  )
  const scrollingItem = createNavigationGroup(
    'Scrolling',
    'Scrolling',
    Symbol.Forward,
    [
      'annotated-scroll-bar',
      'pips-pager',
      'scroll-view',
      'scroll-viewer',
      'semantic-zoom',
    ],
    'category-scrolling',
  )
  const textItem = createNavigationGroup(
    'Text',
    'Text',
    Symbol.Font,
    [
      'auto-suggest-box',
      'number-box',
      'password-box',
      'rich-edit-box',
      'rich-text-block',
      'text-block',
      'text-box',
    ],
    'category-text',
  )
  const fundamentalsItem = createNavigationGroup(
    'Fundamentals',
    'Fundamentals',
    Symbol.Library,
    [
      'resources',
      'style',
      'binding',
      'templates',
      'custom-user-controls',
      'xaml-conditions',
      'scratch-pad',
    ],
    'category-fundamentals',
  )
  const frameworkItem = createNavigationGroup(
    'Framework',
    'Framework',
    Symbol.Document,
    ['signals', 'selection'],
  )
  const designItem = createNavigationGroup(
    'Design',
    'Design',
    Symbol.Highlight,
    [
      'color',
      'geometry',
      'iconography',
      'spacing',
      'typography',
    ],
    'category-design',
  )
  const accessibilityItem = createNavigationGroup(
    'Accessibility',
    'Accessibility',
    Symbol.Permissions,
    [
      'color-contrast',
      'keyboard-navigation',
      'screen-reader',
    ],
    'category-accessibility',
  )
  const stylesItem = createNavigationGroup(
    'Styles',
    'Styles',
    Symbol.Highlight,
    [
      'acrylic-brush',
      'animated-icon',
      'compact-sizing',
      'icon-element',
      'line',
      'shape',
      'radial-gradient-brush',
      'system-backdrops',
      'system-backdrop-element',
      'theme-shadow',
    ],
    'category-styles',
  )
  const mediaItem = createNavigationGroup(
    'Media',
    'Media',
    Symbol.Play,
    [
      'animated-visual-player',
      'capture-element-preview',
      'image',
      'map-control',
      'media-player-element',
      'person-picture',
      'sound',
    ],
    'category-media',
  )
  const motionItem = createNavigationGroup(
    'Motion',
    'Motion',
    Symbol.Sync,
    [
      'animation-interop',
      'connected-animation',
      'easing-functions',
      'implicit-transitions',
      'page-transitions',
      'theme-transitions',
      'parallax-view',
    ],
    'category-motion',
  )
  const windowingItem = createNavigationGroup(
    'Windowing',
    'Windowing',
    Symbol.NewWindow,
    [
      'app-window',
      'app-window-title-bar',
      'multiple-windows',
      'title-bar',
    ],
    'category-windowing',
  )
  const systemItem = createNavigationGroup(
    'System',
    'System',
    Symbol.Setting,
    [
      'clipboard',
      'content-island',
      'storage-pickers',
    ],
    'category-system',
  )
  const shellItem = createNavigationGroup(
    'Shell',
    'Shell',
    Symbol.Repair,
    [
      'app-notifications',
      'badge-notifications',
      'jump-list',
    ],
    'category-shell',
  )
  const navigationItems = [
    homeItem,
    frameworkItem,
    fundamentalsItem,
    designItem,
    accessibilityItem,
    stylesItem,
    controlsHeader,
    allItem,
    basicInputItem,
    collectionsItem,
    dateTimeItem,
    dialogsFlyoutsItem,
    layoutItem,
    mediaItem,
    menusToolbarsItem,
    motionItem,
    windowingItem,
    systemItem,
    navigationItem,
    scrollingItem,
    shellItem,
    textItem,
    statusInfoItem,
  ]
  const diagnosticsItem = createNavigationItem(
    itemBindings,
    {
      name: 'diagnostics',
      label: 'Diagnostics',
      icon: createSymbolIcon(SymbolIcon, Symbol.Repair),
      automationId: 'GalleryDiagnosticsNavItem',
    },
  )
  const routeItems = new Map<GalleryRoute, NavigationViewItem>(
    [
      ['home', homeItem],
      ...galleryPages.map((page) => [
        page.id,
        pageItems.get(page.id)!,
      ] as const),
    ],
  )
  routeItems.set('diagnostics', diagnosticsItem)
  routeItems.set('category-basic-input', basicInputItem)
  routeItems.set('category-collections', collectionsItem)
  routeItems.set('category-date-time', dateTimeItem)
  routeItems.set(
    'category-dialogs-flyouts',
    dialogsFlyoutsItem,
  )
  routeItems.set('category-status-info', statusInfoItem)
  routeItems.set('category-layout', layoutItem)
  routeItems.set('category-media', mediaItem)
  routeItems.set('category-motion', motionItem)
  routeItems.set('category-windowing', windowingItem)
  routeItems.set('category-system', systemItem)
  routeItems.set('category-shell', shellItem)
  routeItems.set(
    'category-menus-toolbars',
    menusToolbarsItem,
  )
  routeItems.set('category-navigation', navigationItem)
  routeItems.set('category-scrolling', scrollingItem)
  routeItems.set('category-text', textItem)
  routeItems.set('category-fundamentals', fundamentalsItem)
  routeItems.set('category-design', designItem)
  routeItems.set('category-accessibility', accessibilityItem)
  routeItems.set('category-styles', stylesItem)
  const categoryItems = new Map<string, NavigationViewItem>([
    ['Framework', frameworkItem],
    ['Fundamentals', fundamentalsItem],
    ['Design', designItem],
    ['Accessibility', accessibilityItem],
    ['Styles', stylesItem],
    ['Basic input', basicInputItem],
    ['Collections', collectionsItem],
    ['Date & time', dateTimeItem],
    ['Dialogs & flyouts', dialogsFlyoutsItem],
    ['Status & info', statusInfoItem],
    ['Layout', layoutItem],
    ['Media', mediaItem],
    ['Menus & toolbars', menusToolbarsItem],
    ['Motion', motionItem],
    ['Windowing', windowingItem],
    ['System', systemItem],
    ['Navigation', navigationItem],
    ['Scrolling', scrollingItem],
    ['Shell', shellItem],
    ['Text', textItem],
  ])
  const itemForRoute = (route: GalleryRoute) => {
    if (route === 'settings') {
      return navigation.current?.settingsItem ?? null
    }
    return routeItems.get(route) ?? null
  }
  const synchronizeNavigationSelection = (route: GalleryRoute) => {
    const current = navigation.current
    const item = itemForRoute(route)
    if (!current || !item) {
      return
    }
    current.selectedItem = item
    const page = findGalleryPage(route)
    const categoryItem = page
      ? categoryItems.get(page.category)
      : undefined
    if (categoryItem) {
      categoryItem.isExpanded = true
    }
  }
  const navigationHost = createNavigationHost({
    route: context.model.route,
    navigate: (route) => context.model.navigate(route),
    enqueue: (callback) =>
      context.window.dispatcherQueue.tryEnqueue(
        DispatcherQueuePriority.Low,
        callback,
      ),
    selectRoute: synchronizeNavigationSelection,
  })
  onCleanup(navigationHost.dispose)

  return (
    <ThemeControllerContext.Provider value={themeController}>
      <LayoutGrid
        rowDefinitions={[
          gridLength.auto(),
          gridLength.star(),
        ]}
      >
        <UI.TitleBar
          ref={titleBar}
          title="dynwinrt-jsx Gallery"
          iconSource={appIcon}
          isBackButtonVisible={computed(
            () => context.model.route.value !== 'home',
          )}
          isPaneToggleButtonVisible
          resourceOverrides={{
            TitleBarContentHorizontalAlignment:
              PropertyValue.createInt32(
                HorizontalAlignment.Stretch,
              ),
          }}
          onLoaded={() => {
            const current = titleBar.current
            if (current) {
              context.window.setTitleBar(current)
            }
          }}
          onBackRequested={() => {
            if (context.model.route.value === 'search') {
              context.model.setSearchQuery('')
              return
            }
            const currentPage = findGalleryPage(
              context.model.route.value,
            )
            if (currentPage?.category === 'Basic input') {
              context.model.navigate('category-basic-input')
              return
            }
            if (currentPage?.category === 'Collections') {
              context.model.navigate('category-collections')
              return
            }
            if (currentPage?.category === 'Date & time') {
              context.model.navigate('category-date-time')
              return
            }
            if (currentPage?.category === 'Dialogs & flyouts') {
              context.model.navigate('category-dialogs-flyouts')
              return
            }
            if (currentPage?.category === 'Status & info') {
              context.model.navigate('category-status-info')
              return
            }
            if (currentPage?.category === 'Layout') {
              context.model.navigate('category-layout')
              return
            }
            if (currentPage?.category === 'Media') {
              context.model.navigate('category-media')
              return
            }
            if (currentPage?.category === 'Motion') {
              context.model.navigate('category-motion')
              return
            }
            if (currentPage?.category === 'Windowing') {
              context.model.navigate('category-windowing')
              return
            }
            if (currentPage?.category === 'Menus & toolbars') {
              context.model.navigate('category-menus-toolbars')
              return
            }
            if (currentPage?.category === 'Navigation') {
              context.model.navigate('category-navigation')
              return
            }
            if (currentPage?.category === 'Scrolling') {
              context.model.navigate('category-scrolling')
              return
            }
            if (currentPage?.category === 'Text') {
              context.model.navigate('category-text')
              return
            }
            if (currentPage?.category === 'Fundamentals') {
              context.model.navigate('category-fundamentals')
              return
            }
            if (currentPage?.category === 'Design') {
              context.model.navigate('category-design')
              return
            }
            if (currentPage?.category === 'Accessibility') {
              context.model.navigate('category-accessibility')
              return
            }
            if (currentPage?.category === 'Styles') {
              context.model.navigate('category-styles')
              return
            }
            if (currentPage?.category === 'System') {
              context.model.navigate('category-system')
              return
            }
            if (currentPage?.category === 'Shell') {
              context.model.navigate('category-shell')
              return
            }
            context.model.navigate('home')
          }}
          onPaneToggleRequested={() => {
            const current = navigation.current
            if (current) {
              current.isPaneOpen = !current.isPaneOpen
            }
          }}
        >
          <UI.AutoSuggestBox
            automationId="GallerySearchBox"
            placeholderText="Search controls and samples..."
            queryIcon={createSymbolIcon(SymbolIcon, Symbol.Find)}
            text={context.model.searchQuery}
            onTextChanged={(sender) => {
              context.model.setSearchQuery(sender.text)
            }}
            maxWidth={580}
            horizontalAlignment={HorizontalAlignment.Stretch}
            verticalAlignment={VerticalAlignment.Center}
          />
        </UI.TitleBar>
        <Navigation
          ref={(value) => {
            navigation.current = value
            if (value) {
              navigationHost.synchronizeSelection()
            }
          }}
          gridRow={1}
          automationId="GalleryNavigation"
          requestedTheme={themeController.requestedTheme}
          paneDisplayMode={NavigationViewPaneDisplayMode.Auto}
          isBackButtonVisible={
            NavigationViewBackButtonVisible.Collapsed
          }
          isPaneToggleButtonVisible={false}
          alwaysShowHeader={false}
          menuItems={navigationItems}
          footerMenuItems={[diagnosticsItem]}
          isSettingsVisible
          onSelectionChanged={(_sender, args) => {
            if (args.isSettingsSelected) {
              navigationHost.requestNativeNavigation('settings')
              return
            }
            const selectedContainer =
              args.selectedItemContainer
            if (!selectedContainer) {
              return
            }
            const route =
              selectedContainer.name as GalleryRoute
            if (
              route === 'home' ||
              route === 'diagnostics' ||
              route === 'category-basic-input' ||
              route === 'category-collections' ||
              route === 'category-date-time' ||
              route === 'category-dialogs-flyouts' ||
              route === 'category-status-info' ||
              route === 'category-layout' ||
              route === 'category-media' ||
              route === 'category-motion' ||
              route === 'category-windowing' ||
              route === 'category-system' ||
              route === 'category-shell' ||
              route === 'category-menus-toolbars' ||
              route === 'category-navigation' ||
              route === 'category-scrolling' ||
              route === 'category-text' ||
              route === 'category-fundamentals' ||
              route === 'category-design' ||
              route === 'category-accessibility' ||
              route === 'category-styles' ||
              findGalleryPage(route)
            ) {
              navigationHost.requestNativeNavigation(route)
            }
          }}
        >
          {navigationHost.render((route) => (
            <ErrorBoundary
              reset={computed(
                () =>
                  `${String(route)}:${context.model.hotVersion.value}`,
              )}
              fallback={(error, errorContext) => (
                <UI.StackPanel
                  padding={thickness(36, 24)}
                  spacing={12}
                >
                  <UI.TextBlock
                    {...styles.heading({ level: 'subtitle' })}
                    text="Sample render failed"
                  />
                  <UI.TextBlock
                    automationId="GalleryRenderError"
                    text={`${errorContext.phase}: ${String(error)}`}
                    textWrapping={TextWrapping.Wrap}
                  />
                  <UI.TextBlock
                    foreground={theme.secondaryText}
                    text="Choose another sample from the navigation pane to continue."
                    textWrapping={TextWrapping.Wrap}
                  />
                </UI.StackPanel>
              )}
            >
              {renderRoute(context, route)}
            </ErrorBoundary>
          ))}
        </Navigation>
      </LayoutGrid>
    </ThemeControllerContext.Provider>
  )
}
