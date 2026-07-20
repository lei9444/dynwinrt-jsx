import {
  ErrorBoundary,
  Show,
  computed,
  createContext,
  createControls,
  createFocusTarget,
  createNavigationItem,
  createNavigationViewControl,
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

type NavigationInstance = InstanceType<typeof NavigationView>
type ButtonInstance = InstanceType<typeof Button>
type ToggleInstance = InstanceType<typeof ToggleSwitch>

export interface AppContext {
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

function renderRoute(context: AppContext, route: AppRoute): Child {
  switch (route) {
    case 'diagnostics':
      return <DiagnosticsPage {...context} />
    case 'settings':
      return <SettingsPage {...context} />
    default:
      return <HomePage {...context} />
  }
}

function Shell(context: AppContext) {
  const navigation: RefObject<NavigationInstance> = { current: null }
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
    automationId: 'HomeNavItem',
    automationPositionInSet: 1,
    automationSizeOfSet: 2,
  })
  const diagnosticsItem = createNavigationItem(itemBindings, {
    name: 'diagnostics',
    label: 'Diagnostics',
    icon: createSymbolIcon(SymbolIcon, Symbol.Repair),
    automationId: 'DiagnosticsNavItem',
    automationPositionInSet: 2,
    automationSizeOfSet: 2,
  })
  const routeItems = new Map<AppRoute, NavigationViewItem>([
    ['home', homeItem],
    ['diagnostics', diagnosticsItem],
  ])
  const selectedItem = computed(() =>
    context.model.route.value === 'settings'
      ? navigation.current?.settingsItem ?? null
      : routeItems.get(context.model.route.value) ?? null,
  )
  return (
    <ThemeControllerContext.Provider value={themeController}>
      <Navigation
        ref={navigation}
        automationId="AppNavigation"
        requestedTheme={themeController.requestedTheme}
        paneTitle="dynwinrt-jsx"
        paneDisplayMode={NavigationViewPaneDisplayMode.Left}
        menuItems={[homeItem]}
        footerMenuItems={[diagnosticsItem]}
        selectedItem={selectedItem}
        isSettingsVisible
        onSelectionChanged={(_sender, args) => {
          if (args.isSettingsSelected) {
            context.model.route.value = 'settings'
            return
          }
          const route = [...routeItems.entries()]
            .find(
              ([, item]) =>
                item.name === args.selectedItemContainer.name,
            )
            ?.[0]
          if (route) {
            context.model.route.value = route
          }
        }}
      >
        {computed(() =>
          renderRoute(context, context.model.route.value),
        )}
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
