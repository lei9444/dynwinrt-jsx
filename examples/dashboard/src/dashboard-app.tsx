import {
  ErrorBoundary,
  For,
  Show,
  batch,
  computed,
  cornerRadius,
  createContext,
  createControls,
  createFocusTarget,
  createGridControl,
  createNavigationItem,
  createNavigationViewControl,
  createSymbolIcon,
  formatRendererDiagnostics,
  gridLength,
  resource,
  showContentDialog,
  thickness,
  useContext,
  type Child,
  type ReadonlySignal,
  type RefObject,
  type Renderer,
} from 'dynwinrt-jsx'
import {
  Application,
  ApplicationTheme,
  AutomationProperties,
  Border,
  Button,
  CheckBox,
  ColumnDefinition,
  ContentDialog,
  ContentDialogButton,
  ContentDialogResult,
  ElementTheme,
  FocusState,
  Grid,
  HorizontalAlignment,
  NavigationView,
  NavigationViewItem,
  NavigationViewPaneDisplayMode,
  ProgressBar,
  RowDefinition,
  ScrollBarVisibility,
  ScrollViewer,
  StackPanel,
  Symbol,
  SymbolIcon,
  TextBlock,
  TextBox,
  TitleBarTheme,
  ToggleSwitch,
  VerticalAlignment,
  Window,
} from '../.winapp/bindings/index.js'
import type {
  DashboardModel,
  DashboardRoute,
  DashboardTask,
} from './dashboard-model'

const UI = createControls({
  Border,
  Button,
  CheckBox,
  Grid,
  ProgressBar,
  ScrollViewer,
  StackPanel,
  TextBlock,
  TextBox,
  ToggleSwitch,
})
const LayoutGrid = createGridControl({
  Grid,
  RowDefinition,
  ColumnDefinition,
})
const AppNavigation = createNavigationViewControl<
  NavigationView,
  InstanceType<typeof import('../.winapp/bindings/NavigationViewItem.js').NavigationViewItem>
>({
  NavigationView,
})

type StackPanelInstance = InstanceType<typeof StackPanel>
type TextBlockInstance = InstanceType<typeof TextBlock>
type TextBoxInstance = InstanceType<typeof TextBox>
type ToggleSwitchInstance = InstanceType<typeof ToggleSwitch>
type NavigationViewInstance = InstanceType<typeof NavigationView>

export interface DashboardAppContext {
  readonly model: DashboardModel
  readonly renderer: Renderer
  readonly window: Window
  refreshDiagnostics(): void
}

interface PageProps {
  readonly title: string
  readonly subtitle: string
  readonly automationId: string
  readonly children: Child
}

interface TaskRowProps {
  readonly context: DashboardAppContext
  readonly task: DashboardTask
}

const ThemeSignal = createContext<ReadonlySignal<boolean> | null>(null)

function themeResource<Value = unknown>(
  key: string,
  fallback?: Value,
) {
  const theme = useContext(ThemeSignal)
  return theme
    ? resource(key, fallback, theme)
    : resource(key, fallback)
}

function secondaryForeground(context: DashboardAppContext) {
  return computed(() =>
    context.model.darkTheme.value
      ? context.model.colors.white
      : context.model.colors.purple,
  )
}

function Page(props: PageProps) {
  const heading = createFocusTarget<TextBlockInstance>(
    FocusState.Programmatic,
  )
  return (
    <UI.ScrollViewer
      horizontalScrollBarVisibility={ScrollBarVisibility.Disabled}
      verticalScrollBarVisibility={ScrollBarVisibility.Auto}
    >
      <UI.StackPanel
        padding={thickness(24)}
        spacing={18}
      >
        <UI.TextBlock
          ref={heading}
          automationId={props.automationId}
          automationName={props.title}
          text={props.title}
          fontSize={28}
          fontWeight={{ weight: 700 }}
          onLoaded={() => {
            heading.focus()
          }}
        />
        <UI.TextBlock
          text={props.subtitle}
          fontSize={13}
        />
        {props.children}
      </UI.StackPanel>
    </UI.ScrollViewer>
  )
}

function Card(props: { readonly children: Child; readonly gridColumn?: number }) {
  return (
    <UI.Border
      {...(props.gridColumn === undefined
        ? {}
        : { gridColumn: props.gridColumn })}
      padding={thickness(18)}
      cornerRadius={cornerRadius(12)}
      borderThickness={thickness(1)}
      background={themeResource('CardBackgroundFillColorDefaultBrush')}
      borderBrush={themeResource('CardStrokeColorDefaultBrush')}
    >
      {props.children}
    </UI.Border>
  )
}

function MetricCard(props: {
  readonly context: DashboardAppContext
  readonly column: number
  readonly automationId: string
  readonly label: string
  readonly value: string | ReadonlySignal<string>
  readonly detail: string | ReadonlySignal<string>
}) {
  return (
    <Card gridColumn={props.column}>
      <UI.StackPanel spacing={6}>
        <UI.TextBlock
          automationId={props.automationId}
          text={props.label.toUpperCase()}
          fontSize={11}
          fontWeight={{ weight: 700 }}
          foreground={secondaryForeground(props.context)}
        />
        <UI.TextBlock
          text={props.value}
          fontSize={28}
          fontWeight={{ weight: 700 }}
        />
        <UI.TextBlock
          text={props.detail}
          fontSize={12}
        />
      </UI.StackPanel>
    </Card>
  )
}

function DashboardPage(context: DashboardAppContext) {
  return (
    <Page
      title="Dashboard"
      subtitle="Versioned, scoped hot reload preserves the same Window and model state."
      automationId="DashboardPageHeading"
    >
      <LayoutGrid
        rowDefinitions={[gridLength.auto()]}
        columnDefinitions={[
          gridLength.star(),
          gridLength.star(),
          gridLength.star(),
          gridLength.star(),
        ]}
        columnSpacing={12}
      >
        <MetricCard
          context={context}
          column={0}
          automationId="TasksMetric"
          label="Tasks"
          value={computed(() => String(context.model.tasks.value.length))}
          detail={context.model.taskSummary}
        />
        <MetricCard
          context={context}
          column={1}
          automationId="CompleteMetric"
          label="Complete"
          value={computed(() => `${context.model.completion.value}%`)}
          detail="Reactive progress"
        />
        <MetricCard
          context={context}
          column={2}
          automationId="RuntimeMetric"
          label="Runtime"
          value="Native"
          detail="Window and Worker stay alive"
        />
        <MetricCard
          context={context}
          column={3}
          automationId="BuildMetric"
          label="Build"
          value={context.model.buildStatus}
          detail="TypeScript + dynwinrt"
        />
      </LayoutGrid>
      <LayoutGrid
        rowDefinitions={[gridLength.auto()]}
        columnDefinitions={[gridLength.star(), gridLength.pixel(340)]}
        columnSpacing={14}
      >
        <Card gridColumn={0}>
          <UI.StackPanel spacing={12}>
            <UI.TextBlock
              text="Pilot application shell"
              fontSize={18}
              fontWeight={{ weight: 700 }}
            />
            <UI.TextBlock text="✓ NavigationView collection adapter" />
            <UI.TextBlock text="✓ Scoped ContentDialog lifecycle" />
            <UI.TextBlock text="✓ Worker-owned hot reload boundary" />
            <UI.TextBlock text="✓ Automation and focus evidence" />
          </UI.StackPanel>
        </Card>
        <Card gridColumn={1}>
          <UI.StackPanel spacing={10}>
            <UI.TextBlock
              text="Runtime health"
              fontSize={18}
              fontWeight={{ weight: 700 }}
            />
            <UI.TextBlock
              text={computed(() =>
                formatRendererDiagnostics(context.model.diagnostics.value),
              )}
            />
            <UI.TextBlock
              text={computed(() =>
                `Hot reload: ${context.model.hotStatus.value}`,
              )}
            />
          </UI.StackPanel>
        </Card>
      </LayoutGrid>
    </Page>
  )
}

async function confirmRemove(
  context: DashboardAppContext,
  task: DashboardTask,
): Promise<void> {
  const dialog = new ContentDialog()
  const title = new TextBlock()
  title.text = 'Remove task?'
  dialog.title = title
  dialog.primaryButtonText = 'Remove'
  dialog.closeButtonText = 'Cancel'
  dialog.defaultButton = ContentDialogButton.Close
  AutomationProperties.setAutomationId(dialog, 'RemoveTaskDialog')
  const result = await showContentDialog(
    context.renderer,
    dialog,
    context.window.content.xamlRoot,
    <UI.TextBlock text={`Remove "${task.title}" from the sprint?`} />,
  )
  if (result === ContentDialogResult.Primary) {
    context.model.removeTask(task.id)
  }
}

function TaskRow(props: TaskRowProps) {
  return (
    <UI.Border
      padding={thickness(12)}
      cornerRadius={cornerRadius(8)}
      background={themeResource('LayerFillColorDefaultBrush')}
    >
      <UI.StackPanel
        orientation={1}
        spacing={12}
        verticalAlignment={VerticalAlignment.Center}
      >
        <UI.CheckBox
          isChecked={props.task.completed}
          onChecked={() => {
            props.context.model.updateTask(props.task.id, true)
          }}
          onUnchecked={() => {
            props.context.model.updateTask(props.task.id, false)
          }}
        />
        <UI.StackPanel width={560} spacing={2}>
          <UI.TextBlock
            text={props.task.title}
            fontSize={13}
            fontWeight={{ weight: 600 }}
          />
          <UI.TextBlock text={props.task.detail} fontSize={11} />
        </UI.StackPanel>
        <UI.Button
          automationName={`Remove ${props.task.title}`}
          onClick={() => {
            void confirmRemove(props.context, props.task)
          }}
        >
          Remove
        </UI.Button>
      </UI.StackPanel>
    </UI.Border>
  )
}

function TasksPage(context: DashboardAppContext) {
  const input: RefObject<TextBoxInstance> = { current: null }
  const addTask = () => {
    const textBox = input.current
    if (!textBox) {
      return
    }
    context.model.addTask(textBox.text)
    textBox.text = ''
  }
  return (
    <Page
      title="Sprint tasks"
      subtitle="Collection updates, keyed identity, and dialog lifecycle."
      automationId="TasksPageHeading"
    >
      <UI.StackPanel
        orientation={1}
        spacing={10}
      >
        <UI.TextBox
          ref={input}
          automationId="TaskInput"
          width={640}
          placeholderText="Add a task"
        />
        <UI.Button
          automationId="AddTaskButton"
          style={resource('AccentButtonStyle')}
          onClick={addTask}
        >
          Add task
        </UI.Button>
      </UI.StackPanel>
      <UI.ProgressBar
        value={context.model.completion}
        minimum={0}
        maximum={100}
      />
      <UI.StackPanel spacing={8}>
        <For
          each={context.model.tasks}
          key={(task) => task.id}
          fallback={
            <UI.TextBlock
              text="No tasks. Add one above."
              horizontalAlignment={HorizontalAlignment.Center}
            />
          }
        >
          {(task) => <TaskRow context={context} task={task} />}
        </For>
      </UI.StackPanel>
    </Page>
  )
}

function DiagnosticsPage(context: DashboardAppContext) {
  return (
    <Page
      title="Diagnostics"
      subtitle="Renderer counters and hot reload recovery state."
      automationId="DiagnosticsPageHeading"
    >
      <Card>
        <UI.StackPanel spacing={12}>
          <UI.TextBlock
            automationId="HotReloadStatus"
            text={computed(() =>
              `Hot reload ${context.model.hotStatus.value}; version ${context.model.hotVersion.value}`,
            )}
            fontSize={18}
            fontWeight={{ weight: 700 }}
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
          <UI.Button
            automationId="RefreshDiagnosticsButton"
            onClick={context.refreshDiagnostics}
          >
            Refresh diagnostics
          </UI.Button>
        </UI.StackPanel>
      </Card>
    </Page>
  )
}

function SettingsPage(context: DashboardAppContext) {
  const themeToggle: RefObject<ToggleSwitchInstance> = {
    current: null,
  }
  return (
    <Page
      title="Settings"
      subtitle="Theme and development behavior."
      automationId="SettingsPageHeading"
    >
      <Card>
        <UI.StackPanel spacing={14}>
          <UI.ToggleSwitch
            ref={themeToggle}
            automationId="ThemeToggle"
            header="Dark theme"
            isOn={context.model.darkTheme}
            onToggled={() => {
              const isOn =
                themeToggle.current?.isOn ??
                context.model.darkTheme.value
              if (isOn === context.model.darkTheme.value) {
                return
              }
              batch(() => {
                context.model.darkTheme.value = isOn
                Application.current.requestedTheme =
                  isOn ? ApplicationTheme.Dark : ApplicationTheme.Light
                context.window.appWindow.titleBar.preferredTheme =
                  isOn ? TitleBarTheme.Dark : TitleBarTheme.Light
              })
            }}
          />
          <UI.TextBlock text="Application state survives TSX hot reloads." />
          <UI.TextBlock text="Binding or native runtime changes restart the Worker." />
        </UI.StackPanel>
      </Card>
    </Page>
  )
}

function renderRoute(
  context: DashboardAppContext,
  route: DashboardRoute,
): Child {
  switch (route) {
    case 'tasks':
      return <TasksPage {...context} />
    case 'diagnostics':
      return <DiagnosticsPage {...context} />
    case 'settings':
      return <SettingsPage {...context} />
    default:
      return <DashboardPage {...context} />
  }
}

function ApplicationShell(context: DashboardAppContext) {
  const navigation: RefObject<NavigationViewInstance> = {
    current: null,
  }
  const requestedTheme = computed(() =>
    context.model.darkTheme.value
      ? ElementTheme.Dark
      : ElementTheme.Light,
  )
  const itemBindings = {
    NavigationViewItem,
    TextBlock,
    AutomationProperties,
  }
  const dashboardItem = createNavigationItem(itemBindings, {
    name: 'dashboard',
    label: 'Dashboard',
    icon: createSymbolIcon(SymbolIcon, Symbol.Home),
    automationId: 'DashboardNavItem',
    automationName: 'Dashboard page',
  })
  const tasksItem = createNavigationItem(itemBindings, {
    name: 'tasks',
    label: 'Tasks',
    icon: createSymbolIcon(SymbolIcon, Symbol.Bullets),
    automationId: 'TasksNavItem',
    automationName: 'Tasks page',
  })
  const diagnosticsItem = createNavigationItem(itemBindings, {
    name: 'diagnostics',
    label: 'Diagnostics',
    icon: createSymbolIcon(SymbolIcon, Symbol.Repair),
    automationId: 'DiagnosticsNavItem',
    automationName: 'Diagnostics page',
  })
  const routeItems = new Map<DashboardRoute, NavigationViewItem>([
    ['dashboard', dashboardItem],
    ['tasks', tasksItem],
    ['diagnostics', diagnosticsItem],
  ])
  const selectedItem = computed(() => {
    if (context.model.route.value === 'settings') {
      return navigation.current?.settingsItem ?? null
    }
    return routeItems.get(context.model.route.value) ?? null
  })

  return (
    <ThemeSignal.Provider value={context.model.darkTheme}>
      <AppNavigation
        ref={navigation}
        automationId="AppNavigation"
        requestedTheme={requestedTheme}
        paneTitle="DynWinRT JSX"
        paneDisplayMode={NavigationViewPaneDisplayMode.Left}
        isSettingsVisible
        menuItems={[dashboardItem, tasksItem]}
        footerMenuItems={[diagnosticsItem]}
        selectedItem={selectedItem}
        onLoaded={() => {
          const scale =
            navigation.current?.xamlRoot?.rasterizationScale ?? 1
          context.window.appWindow.resize({
            width: Math.round(1220 * scale),
            height: Math.round(820 * scale),
          })
          context.window.appWindow.moveInZOrderAtTop()
        }}
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
      </AppNavigation>
    </ThemeSignal.Provider>
  )
}

export function renderDashboardApp(
  context: DashboardAppContext,
): Child {
  return (
    <ErrorBoundary
      reset={context.model.hotVersion}
      fallback={(error) => (
        <UI.StackPanel padding={thickness(24)} spacing={12}>
          <UI.TextBlock
            text="Dashboard render failed"
            fontSize={24}
            fontWeight={{ weight: 700 }}
          />
          <UI.TextBlock
            text={String(error)}
            textWrapping={1}
          />
        </UI.StackPanel>
      )}
    >
      <ApplicationShell {...context} />
    </ErrorBoundary>
  )
}
