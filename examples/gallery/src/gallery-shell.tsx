import {
  ErrorBoundary,
  Outlet,
  RouterProvider,
  computed,
  createNavigationItem,
  createRouter,
  createRouterNavigationHost,
  createSymbolIcon,
  createWinUIThemeController,
  effect,
  gridLength,
  onCleanup,
  styles,
  theme,
  thickness,
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
import { isGalleryRoute } from './launch-intent'
import {
  createGalleryRoutes,
  galleryCategoryRouteIds,
} from './pages/routes'

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
  for (const [category, routeId] of galleryCategoryRouteIds) {
    const item = categoryItems.get(category)
    if (item) {
      routeItems.set(routeId, item)
    }
  }
  const itemForRoute = (routeId: string) => {
    if (routeId === 'settings') {
      return navigation.current?.settingsItem ?? null
    }
    return routeItems.get(routeId as GalleryRoute) ?? null
  }
  const synchronizeNavigationSelection = (routeId: string) => {
    const current = navigation.current
    const item = itemForRoute(routeId)
    if (!current || !item) {
      return
    }
    current.selectedItem = item
    const page = findGalleryPage(routeId)
    const categoryItem = page
      ? categoryItems.get(page.category)
      : undefined
    if (categoryItem) {
      categoryItem.isExpanded = true
    }
  }
  const router = createRouter({
    routes: createGalleryRoutes(context),
    initialRouteId: context.model.route.peek(),
  })
  onCleanup(router.dispose)
  effect(() => {
    const route = context.model.route.value
    if (router.routeId.peek() !== route) {
      router.navigate({ routeId: route })
    }
  })
  router.routeId.subscribe((routeId) => {
    if (
      isGalleryRoute(routeId) &&
      context.model.route.peek() !== routeId
    ) {
      context.model.navigate(routeId)
    }
  })
  const navigationHost = createRouterNavigationHost(router, {
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
            () => router.routeId.value !== 'home',
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
            if (router.routeId.peek() === 'search') {
              context.model.setSearchQuery('')
              return
            }
            if (router.up()) {
              return
            }
            if (!router.back()) {
              router.replace(
                { routeId: 'home' },
                { trigger: 'history' },
              )
            }
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
            if (isGalleryRoute(route)) {
              navigationHost.requestNativeNavigation(route)
            }
          }}
        >
          <RouterProvider router={router}>
            {navigationHost.render(() => (
              <ErrorBoundary
                reset={computed(
                  () =>
                    `${router.routeId.value}:${context.model.hotVersion.value}`,
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
                <Outlet />
              </ErrorBoundary>
            ))}
          </RouterProvider>
        </Navigation>
      </LayoutGrid>
    </ThemeControllerContext.Provider>
  )
}
