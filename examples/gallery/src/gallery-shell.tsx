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
  styles,
  theme,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  AccessibilityView,
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
  Visibility,
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
import { isGalleryRoute } from './launch-intent'
import {
  createGalleryRoutes,
} from './pages/routes'

export function Shell(context: AppContext) {
  const titleBar: RefObject<TitleBarInstance> = {
    current: null,
  }
  const appIcon = context.createProjected(
    () => new ImageIconSource(),
  )
  appIcon.imageSource = loadGalleryBitmap('GalleryAppIcon.png', 20)
  const themeController = createWinUIThemeController({
    isDark: context.model.darkTheme,
    setDark: context.model.setDarkTheme,
    application: Application.current,
    bindings: {
      ApplicationTheme,
      ElementTheme,
      TitleBarTheme,
    },
    titleBar: context.window.appWindow.titleBar,
  })
  onCleanup(themeController.dispose)
  const routes = createGalleryRoutes(context)
  const router = createRouter({
    routes,
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
  const navigationShell =
    createRouterNavigationViewShell({
      router,
      bindings: {
        NavigationViewItem,
        TextBlock,
        AutomationProperties,
      },
      routes,
      items: [
        {
          name: 'all-controls',
          routeId: 'all-controls',
          label: 'All',
          order: 61,
          createIcon: () =>
            createSymbolIcon(
              SymbolIcon,
              Symbol.AllApps,
            ),
          automationId: 'GalleryAllControlsNavItem',
        },
      ],
      settingsRouteId: 'settings',
      preservePaneOpenOnSelection: true,
      enqueue: (callback) =>
        context.window.dispatcherQueue.tryEnqueue(
          DispatcherQueuePriority.Normal,
          callback,
        ),
      createProjectedOwner:
        context.createProjectedOwner,
    })
  onCleanup(navigationShell.dispose)
  const controlsHeader = context.createProjected(
    () => new NavigationViewItem(),
  )
  const controlsHeaderText = context.createProjected(
    () => new TextBlock(),
  )
  controlsHeaderText.text = 'Controls'
  controlsHeader.content = controlsHeaderText
  controlsHeader.selectsOnInvoked = false
  controlsHeader.isTabStop = false
  AutomationProperties.setAccessibilityView(
    controlsHeader,
    AccessibilityView.Raw,
  )
  AutomationProperties.setAccessibilityView(
    controlsHeaderText,
    AccessibilityView.Raw,
  )
  controlsHeader.visibility = Visibility.Visible
  AutomationProperties.setAutomationId(
    controlsHeader,
    'GalleryControlsHeader',
  )
  const menuItems: (
    | NavigationViewItem
  )[] = [...navigationShell.menuItems]
  const allItem = navigationShell.itemForRoute('all-controls')
  const allIndex = allItem
    ? menuItems.indexOf(allItem)
    : -1
  menuItems.splice(
    allIndex >= 0 ? allIndex : menuItems.length,
    0,
    controlsHeader,
  )

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
          menuItems={menuItems}
          footerMenuItems={navigationShell.footerMenuItems}
          isSettingsVisible
          onSelectionChanged={navigationShell.onSelectionChanged}
          onPaneOpened={() => {
            controlsHeader.visibility = Visibility.Visible
          }}
          onPaneClosed={() => {
            controlsHeader.visibility = Visibility.Collapsed
          }}
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
