import {
  ErrorBoundary,
  Outlet,
  RouterProvider,
  computed,
  createRouter,
  createRouterNavigationViewShell,
  createSymbolIcon,
  createWinUIThemeController,
  effect,
  gridLength,
  onCleanup,
  ownProjectedValue,
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
  releaseProjected,
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
  ThemeControllerContext,
  type TitleBarInstance,
  UI,
} from './gallery-ui'
import { loadGalleryBitmap } from './gallery-assets'
import {
  galleryPages,
} from './gallery-data'
import { isGalleryRoute } from './launch-intent'
import {
  createGalleryRoutes,
  galleryCategoryRouteIds,
} from './pages/routes'

interface GalleryNavigationCategory {
  readonly category: string
  readonly name: string
  readonly symbol: Symbol
}

const primaryNavigationCategories = [
  {
    category: 'Framework',
    name: 'Framework',
    symbol: Symbol.Document,
  },
  {
    category: 'Fundamentals',
    name: 'Fundamentals',
    symbol: Symbol.Library,
  },
  {
    category: 'Design',
    name: 'Design',
    symbol: Symbol.Highlight,
  },
  {
    category: 'Accessibility',
    name: 'Accessibility',
    symbol: Symbol.Permissions,
  },
  {
    category: 'Styles',
    name: 'Styles',
    symbol: Symbol.Highlight,
  },
] as const satisfies readonly GalleryNavigationCategory[]

const controlNavigationCategories = [
  {
    category: 'Basic input',
    name: 'BasicInput',
    symbol: Symbol.TouchPointer,
  },
  {
    category: 'Collections',
    name: 'Collections',
    symbol: Symbol.Bullets,
  },
  {
    category: 'Date & time',
    name: 'DateTime',
    symbol: Symbol.Clock,
  },
  {
    category: 'Dialogs & flyouts',
    name: 'DialogsFlyouts',
    symbol: Symbol.OpenWith,
  },
  {
    category: 'Layout',
    name: 'Layout',
    symbol: Symbol.Page,
  },
  {
    category: 'Media',
    name: 'Media',
    symbol: Symbol.Play,
  },
  {
    category: 'Menus & toolbars',
    name: 'MenusToolbars',
    symbol: Symbol.Bullets,
  },
  {
    category: 'Motion',
    name: 'Motion',
    symbol: Symbol.Sync,
  },
  {
    category: 'Windowing',
    name: 'Windowing',
    symbol: Symbol.NewWindow,
  },
  {
    category: 'System',
    name: 'System',
    symbol: Symbol.Setting,
  },
  {
    category: 'Navigation',
    name: 'Navigation',
    symbol: Symbol.GlobalNavigationButton,
  },
  {
    category: 'Scrolling',
    name: 'Scrolling',
    symbol: Symbol.Forward,
  },
  {
    category: 'Shell',
    name: 'Shell',
    symbol: Symbol.Repair,
  },
  {
    category: 'Text',
    name: 'Text',
    symbol: Symbol.Font,
  },
  {
    category: 'Status & info',
    name: 'StatusInfo',
    symbol: Symbol.Flag,
  },
] as const satisfies readonly GalleryNavigationCategory[]

export function Shell(context: AppContext) {
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
  const ownedIcon = (symbol: Symbol) =>
    ownProjectedValue(
      createSymbolIcon(SymbolIcon, symbol),
      releaseProjected,
    )
  const categoryItem = (
    definition: GalleryNavigationCategory,
  ) => {
    const routeId =
      galleryCategoryRouteIds.get(definition.category)
    const pages = galleryPages.filter(
      (page) => page.category === definition.category,
    )
    if (pages.length === 0) {
      throw new Error(
        `Gallery navigation category '${definition.category}' has no pages.`,
      )
    }
    return {
      ...(routeId
        ? { routeId }
        : { name: `category-${definition.name}` }),
      label: definition.category,
      icon: ownedIcon(definition.symbol),
      automationId:
        `Gallery${definition.name}CategoryNavItem`,
      children: pages.map((page) => ({
        routeId: page.id,
        label: page.title,
        automationId: `Gallery${page.id}NavItem`,
      })),
    }
  }
  const navigationShell =
    createRouterNavigationViewShell({
      router,
      bindings: {
        NavigationViewItem,
        TextBlock,
        AutomationProperties,
      },
      items: [
        {
          routeId: 'home',
          label: 'Home',
          icon: ownedIcon(Symbol.Home),
          automationId: 'GalleryHomeNavItem',
        },
        ...primaryNavigationCategories.map(categoryItem),
        {
          name: 'controls-header',
          label: 'Controls',
          automationId: 'GalleryControlsHeader',
        },
        {
          name: 'all-controls',
          label: 'All',
          icon: ownedIcon(Symbol.AllApps),
          automationId: 'GalleryAllControlsNavItem',
        },
        ...controlNavigationCategories.map(categoryItem),
      ],
      footerItems: [
        {
          routeId: 'diagnostics',
          label: 'Diagnostics',
          icon: ownedIcon(Symbol.Repair),
          automationId: 'GalleryDiagnosticsNavItem',
        },
      ],
      settingsRouteId: 'settings',
      preservePaneOpenOnSelection: true,
      enqueue: (callback) =>
        context.window.dispatcherQueue.tryEnqueue(
          DispatcherQueuePriority.Low,
          callback,
        ),
      releaseProjected,
    })
  onCleanup(navigationShell.dispose)

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
            const current = navigationShell.navigation
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
          ref={navigationShell.ref}
          gridRow={1}
          automationId="GalleryNavigation"
          requestedTheme={themeController.requestedTheme}
          paneDisplayMode={NavigationViewPaneDisplayMode.Auto}
          isBackButtonVisible={
            NavigationViewBackButtonVisible.Collapsed
          }
          isPaneToggleButtonVisible={false}
          alwaysShowHeader={false}
          menuItems={navigationShell.menuItems}
          footerMenuItems={navigationShell.footerMenuItems}
          isSettingsVisible
          onSelectionChanged={navigationShell.onSelectionChanged}
        >
          <RouterProvider router={router}>
            {navigationShell.render(() => (
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
