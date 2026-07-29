import {
  ErrorBoundary,
  Outlet,
  RouterProvider,
  Show,
  computed,
  createContext,
  createControls,
  createFocusTarget,
  createNavigationViewControl,
  createRouter,
  createRouterNavigationViewShell,
  createSymbolIcon,
  createWinUIThemeController,
  formatRendererDiagnostics,
  onCleanup,
  showContentDialog,
  styles,
  thickness,
  tokens,
  useContext,
  type Child,
  type ProjectedOwnership,
  type RouteDefinition,
  type RouterNavigationViewRouteHandle,
  type RefObject,
  type Renderer,
} from 'dynwinrt-jsx'
import {
  Application,
  ApplicationTheme,
  AutomationProperties,
  Button,
  ContentDialog,
  ContentDialogButton,
  DispatcherQueuePriority,
  ElementTheme,
  FocusState,
  NavigationView,
  NavigationViewItem,
  NavigationViewPaneDisplayMode,
  StackPanel,
  Symbol,
  SymbolIcon,
  TextBlock,
  TitleBarTheme,
  ToggleSwitch,
  Window,
} from '#winapp/bindings'
import type { AppModel, AppRoute } from './app-model'

const UI = createControls({
  Button,
  StackPanel,
  TextBlock,
  ToggleSwitch,
})
const Navigation = createNavigationViewControl<
  NavigationView,
  NavigationViewItem
>({ NavigationView })

const ThemeControllerContext = createContext<{
  setDark(value: boolean): void
} | null>(null)

type ButtonInstance = InstanceType<typeof Button>
type ToggleInstance = InstanceType<typeof ToggleSwitch>

export interface AppContext extends ProjectedOwnership {
  readonly model: AppModel
  readonly renderer: Renderer
  readonly window: Window
  refreshDiagnostics(): void
}

function Page(props: {
  readonly title: string
  readonly automationId: string
  readonly children: Child
  readonly onLoaded?: () => void
}) {
  return (
    <UI.StackPanel
      padding={thickness(tokens.spacing.xxl)}
      spacing={tokens.spacing.lg}
    >
      <UI.TextBlock
        {...styles.heading({ level: 'title' })}
        {...(props.onLoaded ? { onLoaded: props.onLoaded } : {})}
        automationId={props.automationId}
        automationName={props.title}
        automationHeadingLevel={1}
        text={props.title}
      />
      <UI.TextBlock
        {...styles.heading({
          level: 'body',
          tone: 'secondary',
        })}
        text="Native WinUI resources follow the effective theme."
      />
      {props.children}
    </UI.StackPanel>
  )
}

async function showAbout(
  context: AppContext,
  restoreFocus: () => void,
) {
  const dialog = new ContentDialog()
  const title = new TextBlock()
  title.text = 'dynwinrt-jsx'
  dialog.title = title
  dialog.closeButtonText = 'Done'
  dialog.defaultButton = ContentDialogButton.Close
  AutomationProperties.setAutomationId(dialog, 'AboutDialog')
  AutomationProperties.setIsDialog(dialog, true)
  await showContentDialog(
    context.renderer,
    dialog,
    context.window.content.xamlRoot,
    <UI.TextBlock text="Native WinUI TSX with versioned hot reload." />,
    { restoreFocus },
  )
}

function HomePage(context: AppContext) {
  const aboutButton = createFocusTarget<ButtonInstance>(
    FocusState.Programmatic,
  )
  return (
    <Page
      title="Home"
      automationId="HomePageHeading"
      onLoaded={() => {
        context.model.status.value = 'running'
      }}
    >
      <UI.TextBlock
        {...styles.heading({ level: 'subtitle' })}
        text={context.model.countText}
      />
      <UI.Button
        {...styles.button({ variant: 'accent' })}
        automationId="IncrementButton"
        onClick={() => {
          context.model.increment()
        }}
      >
        Increment
      </UI.Button>
      <UI.Button
        ref={aboutButton}
        automationId="AboutButton"
        onClick={() => void showAbout(context, () => {
          aboutButton.focus()
        })}
      >
        Show dialog
      </UI.Button>
    </Page>
  )
}

function DiagnosticsPage(context: AppContext) {
  return (
    <Page title="Diagnostics" automationId="DiagnosticsPageHeading">
      <UI.TextBlock
        automationId="HotReloadStatus"
        text={computed(() =>
          `Hot reload ${context.model.hotStatus.value}; version ${context.model.hotVersion.value}`,
        )}
      />
      <UI.TextBlock
        text={computed(() =>
          formatRendererDiagnostics(context.model.diagnostics.value),
        )}
      />
      <UI.TextBlock
        automationId="PersistenceStatus"
        text={computed(() =>
          context.model.persistenceError.value
            ? `State recovery error: ${context.model.persistenceError.value}`
            : context.model.updatedAt.value
              ? `State changed ${context.model.updatedAt.value}`
              : 'State has not changed in this session.',
        )}
      />
      <Show when={context.model.lastError}>
        {(error) => (
          <UI.TextBlock
            automationId="HotReloadError"
            text={error}
            textWrapping={1}
          />
        )}
      </Show>
      <UI.Button onClick={context.refreshDiagnostics}>
        Refresh diagnostics
      </UI.Button>
    </Page>
  )
}

function SettingsPage(context: AppContext) {
  const themeController = useContext(ThemeControllerContext)
  const toggle: RefObject<ToggleInstance> = { current: null }
  return (
    <Page title="Settings" automationId="SettingsPageHeading">
      <UI.ToggleSwitch
        ref={toggle}
        automationId="ThemeToggle"
        header="Dark theme"
        isOn={context.model.darkTheme}
        onToggled={() => {
          const isOn =
            toggle.current?.isOn ?? context.model.darkTheme.value
          if (!themeController) {
            throw new Error('Theme controller is unavailable.')
          }
          themeController.setDark(isOn)
        }}
      />
    </Page>
  )
}

function Shell(context: AppContext) {
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
  const routePaths: Readonly<Record<AppRoute, string>> = {
    home: '/',
    diagnostics: '/diagnostics',
    settings: '/settings',
  }
  const routes: readonly RouteDefinition<
    unknown,
    RouterNavigationViewRouteHandle<
      InstanceType<typeof SymbolIcon>
    >
  >[] = [
    {
      id: 'home',
      path: '/',
      handle: {
        navigation: {
          label: 'Home',
          createIcon: () =>
            createSymbolIcon(SymbolIcon, Symbol.Home),
          automationId: 'HomeNavItem',
          automationPositionInSet: 1,
          automationSizeOfSet: 2,
        },
      },
      render: () => <HomePage {...context} />,
    },
    {
      id: 'diagnostics',
      path: '/diagnostics',
      handle: {
        navigation: {
          label: 'Diagnostics',
          placement: 'footer' as const,
          createIcon: () =>
            createSymbolIcon(SymbolIcon, Symbol.Repair),
          automationId: 'DiagnosticsNavItem',
          automationPositionInSet: 2,
          automationSizeOfSet: 2,
        },
      },
      render: () => <DiagnosticsPage {...context} />,
    },
    {
      id: 'settings',
      path: '/settings',
      render: () => <SettingsPage {...context} />,
    },
  ]
  const router = createRouter({
    routes,
    initialEntries: [
      routePaths[context.model.route.peek()],
    ],
  })
  onCleanup(router.dispose)
  router.routeId.subscribe((routeId) => {
    if (Object.hasOwn(routePaths, routeId)) {
      context.model.route.value = routeId as AppRoute
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
      settingsRouteId: 'settings',
      enqueue: (callback) =>
        context.window.dispatcherQueue.tryEnqueue(
          DispatcherQueuePriority.Low,
          callback,
        ),
      createProjectedOwner:
        context.createProjectedOwner,
    })
  onCleanup(navigationShell.dispose)
  return (
    <ThemeControllerContext.Provider value={themeController}>
      <Navigation
        ref={navigationShell.ref}
        automationId="AppNavigation"
        requestedTheme={themeController.requestedTheme}
        paneTitle="dynwinrt-jsx"
        paneDisplayMode={NavigationViewPaneDisplayMode.Left}
        menuItems={navigationShell.menuItems}
        footerMenuItems={navigationShell.footerMenuItems}
        isSettingsVisible
        onSelectionChanged={navigationShell.onSelectionChanged}
      >
        <RouterProvider router={router}>
          {navigationShell.render(() => <Outlet />)}
        </RouterProvider>
      </Navigation>
    </ThemeControllerContext.Provider>
  )
}

export function renderApp(context: AppContext): Child {
  return (
    <ErrorBoundary
      reset={context.model.hotVersion}
      fallback={(error) => (
        <UI.TextBlock
          {...styles.heading({ level: 'subtitle' })}
          text={`App failed: ${String(error)}`}
          margin={thickness(tokens.spacing.xl)}
          textWrapping={1}
        />
      )}
    >
      <Shell {...context} />
    </ErrorBoundary>
  )
}
