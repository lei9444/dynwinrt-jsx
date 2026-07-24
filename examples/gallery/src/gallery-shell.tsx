import {
  ErrorBoundary,
  computed,
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
import { TextInputPage } from './pages/text-input'
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
import { ResourcesPage } from './pages/resources'
import { IconsPage } from './pages/icons'
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
    case 'text-input':
      return <TextInputPage {...context} />
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
    case 'resources':
      return <ResourcesPage {...context} />
    case 'icons':
      return <IconsPage {...context} />
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
    case 'category-menus-toolbars':
      return <MenusToolbarsCategoryPage {...context} />
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
  const navigationItems = [
    homeItem,
    createNavigationGroup(
      'Fundamentals',
      'Fundamentals',
      Symbol.Library,
      ['signals', 'selection'],
    ),
    createNavigationGroup(
      'Design',
      'Design',
      Symbol.Highlight,
      ['resources', 'icons'],
    ),
    createNavigationGroup(
      'Accessibility',
      'Accessibility',
      Symbol.Permissions,
      [],
    ),
    controlsHeader,
    allItem,
    basicInputItem,
    collectionsItem,
    dateTimeItem,
    dialogsFlyoutsItem,
    layoutItem,
    createNavigationGroup('Media', 'Media', Symbol.Play, []),
    menusToolbarsItem,
    createNavigationGroup('Motion', 'Motion', Symbol.Sync, []),
    createNavigationGroup(
      'Navigation',
      'Navigation',
      Symbol.GlobalNavigationButton,
      [],
    ),
    createNavigationGroup(
      'Scrolling',
      'Scrolling',
      Symbol.Forward,
      [],
    ),
    createNavigationGroup('Shell', 'Shell', Symbol.Repair, []),
    createNavigationGroup(
      'Text',
      'Text',
      Symbol.Font,
      ['text-input'],
    ),
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
  routeItems.set(
    'category-menus-toolbars',
    menusToolbarsItem,
  )
  const selectedItem = computed(() => {
    if (context.model.route.value === 'settings') {
      return navigation.current?.settingsItem ?? null
    }
    return routeItems.get(context.model.route.value) ?? null
  })

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
            if (currentPage?.category === 'Menus & toolbars') {
              context.model.navigate('category-menus-toolbars')
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
          ref={navigation}
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
          selectedItem={selectedItem}
          isSettingsVisible
          onSelectionChanged={(_sender, args) => {
            if (args.isSettingsSelected) {
              context.model.navigate('settings')
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
              route === 'category-menus-toolbars' ||
              findGalleryPage(route)
            ) {
              context.model.navigate(route)
            }
          }}
        >
          <ErrorBoundary
            reset={computed(
              () =>
                `${context.model.route.value}:${context.model.hotVersion.value}`,
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
            {computed(() =>
              renderRoute(context, context.model.route.value),
            )}
          </ErrorBoundary>
        </Navigation>
      </LayoutGrid>
    </ThemeControllerContext.Provider>
  )
}
