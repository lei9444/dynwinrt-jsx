import {
  ErrorBoundary,
  Show,
  batch,
  computed,
  createControls,
  createFocusTarget,
  createNavigationItem,
  createNavigationViewControl,
  createSymbolIcon,
  formatRendererDiagnostics,
  resource,
  showContentDialog,
  thickness,
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
} from '../.winapp/bindings/index.js'
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

type NavigationInstance = InstanceType<typeof NavigationView>
type TextBlockInstance = InstanceType<typeof TextBlock>
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
}) {
  const heading = createFocusTarget<TextBlockInstance>(
    FocusState.Programmatic,
  )
  return (
    <UI.StackPanel padding={thickness(32)} spacing={16}>
      <UI.TextBlock
        ref={heading}
        automationId={props.automationId}
        automationName={props.title}
        text={props.title}
        fontSize={30}
        fontWeight={{ weight: 700 }}
        onLoaded={() => heading.focus()}
      />
      {props.children}
    </UI.StackPanel>
  )
}

async function showAbout(context: AppContext) {
  const dialog = new ContentDialog()
  const title = new TextBlock()
  title.text = 'dynwinrt-jsx'
  dialog.title = title
  dialog.closeButtonText = 'Done'
  dialog.defaultButton = ContentDialogButton.Close
  AutomationProperties.setAutomationId(dialog, 'AboutDialog')
  await showContentDialog(
    context.renderer,
    dialog,
    context.window.content.xamlRoot,
    <UI.TextBlock text="Native WinUI TSX with versioned hot reload." />,
  )
}

function HomePage(context: AppContext) {
  return (
    <Page title="Home" automationId="HomePageHeading">
      <UI.TextBlock text={context.model.countText} fontSize={20} />
      <UI.Button
        automationId="IncrementButton"
        style={resource('AccentButtonStyle')}
        onClick={() => {
          context.model.count.value += 1
        }}
      >
        Increment
      </UI.Button>
      <UI.Button
        automationId="AboutButton"
        onClick={() => void showAbout(context)}
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
          batch(() => {
            context.model.darkTheme.value = isOn
            Application.current.requestedTheme =
              isOn ? ApplicationTheme.Dark : ApplicationTheme.Light
            context.window.appWindow.titleBar.preferredTheme =
              isOn ? TitleBarTheme.Dark : TitleBarTheme.Light
          })
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
  })
  const diagnosticsItem = createNavigationItem(itemBindings, {
    name: 'diagnostics',
    label: 'Diagnostics',
    icon: createSymbolIcon(SymbolIcon, Symbol.Repair),
    automationId: 'DiagnosticsNavItem',
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
    <Navigation
      ref={navigation}
      automationId="AppNavigation"
      requestedTheme={computed(() =>
        context.model.darkTheme.value
          ? ElementTheme.Dark
          : ElementTheme.Light,
      )}
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
          .find(([, item]) => item.name === args.selectedItemContainer.name)
          ?.[0]
        if (route) {
          context.model.route.value = route
        }
      }}
    >
      {computed(() => renderRoute(context, context.model.route.value))}
    </Navigation>
  )
}

export function renderApp(context: AppContext): Child {
  return (
    <ErrorBoundary
      reset={context.model.hotVersion}
      fallback={(error) => (
        <UI.TextBlock
          text={`App failed: ${String(error)}`}
          margin={thickness(24)}
          textWrapping={1}
        />
      )}
    >
      <Shell {...context} />
    </ErrorBoundary>
  )
}
