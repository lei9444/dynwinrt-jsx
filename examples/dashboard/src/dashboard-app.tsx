import {
  ErrorBoundary,
  For,
  Show,
  computed,
  createContext,
  createControls,
  createFocusTarget,
  createFontFamily,
  createGridControl,
  createListViewControl,
  createNavigationItem,
  createNavigationViewControl,
  createSymbolIcon,
  createWinUIThemeController,
  formatRendererDiagnostics,
  gridLength,
  onCleanup,
  onMount,
  showContentDialog,
  showFlyout,
  signal,
  styles,
  thickness,
  tokens,
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
  Flyout,
  FocusState,
  FontFamily,
  Grid,
  HorizontalAlignment,
  ListView,
  ListViewItem,
  NavigationView,
  NavigationViewItem,
  NavigationViewPaneDisplayMode,
  ProgressBar,
  RowDefinition,
  ScrollBarVisibility,
  ScrollViewer,
  Selector,
  StackPanel,
  Symbol,
  SymbolIcon,
  TeachingTip,
  TextBlock,
  TextBox,
  TitleBarTheme,
  ToggleSwitch,
  VerticalAlignment,
  Window,
  XamlRoot,
} from '#winapp/bindings'
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
  ListViewItem,
  ProgressBar,
  ScrollViewer,
  StackPanel,
  TeachingTip,
  TextBlock,
  TextBox,
  ToggleSwitch,
})
const LayoutGrid = createGridControl({
  Grid,
  RowDefinition,
  ColumnDefinition,
})
const TaskList = createListViewControl({
  ListView,
  selectedIndexProperty: Selector.selectedIndexProperty,
})
const AppNavigation = createNavigationViewControl<
  NavigationView,
  NavigationViewItem
>({
  NavigationView,
})

type StackPanelInstance = InstanceType<typeof StackPanel>
type ButtonInstance = InstanceType<typeof Button>
type TextBlockInstance = InstanceType<typeof TextBlock>
type TextBoxInstance = InstanceType<typeof TextBox>
type ToggleSwitchInstance = InstanceType<typeof ToggleSwitch>
type NavigationViewInstance = InstanceType<typeof NavigationView>

export interface DashboardAppContext {
  readonly model: DashboardModel
  readonly renderer: Renderer
  readonly window: Window
  getXamlRoot(): XamlRoot
  refreshDiagnostics(): void
}

interface PageProps {
  readonly title: string
  readonly subtitle: string
  readonly automationId: string
  readonly children: Child
  readonly onLoaded?: () => void
}

interface TaskRowProps {
  readonly context: DashboardAppContext
  readonly task: DashboardTask
  readonly afterRemoveFocus: () => void
}

interface TeachingTipService {
  open(target: ButtonInstance): void
}

const TeachingTipServiceContext =
  createContext<TeachingTipService | null>(null)
const ThemeControllerContext = createContext<{
  setDark(value: boolean): void
} | null>(null)

function Page(props: PageProps) {
  return (
    <UI.ScrollViewer
      horizontalScrollBarVisibility={ScrollBarVisibility.Disabled}
      verticalScrollBarVisibility={ScrollBarVisibility.Auto}
    >
      <UI.StackPanel
        padding={thickness(tokens.spacing.xl)}
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
          text={props.subtitle}
        />
        {props.children}
      </UI.StackPanel>
    </UI.ScrollViewer>
  )
}

function Card(props: { readonly children: Child; readonly gridColumn?: number }) {
  return (
    <UI.Border
      {...styles.card()}
      {...(props.gridColumn === undefined
        ? {}
        : { gridColumn: props.gridColumn })}
    >
      {props.children}
    </UI.Border>
  )
}

function MetricCard(props: {
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
          {...styles.heading({
            level: 'caption',
            tone: 'secondary',
          })}
          automationId={props.automationId}
          text={props.label.toUpperCase()}
        />
        <UI.TextBlock
          {...styles.heading({ level: 'title' })}
          text={props.value}
        />
        <UI.TextBlock
          {...styles.heading({
            level: 'caption',
            tone: 'secondary',
          })}
          text={props.detail}
        />
      </UI.StackPanel>
    </Card>
  )
}

function OverlayShowcase(context: DashboardAppContext) {
  const flyoutTarget = createFocusTarget<ButtonInstance>(
    FocusState.Programmatic,
  )
  const teachingTipTarget = createFocusTarget<ButtonInstance>(
    FocusState.Programmatic,
  )
  const teachingTipService = useContext(TeachingTipServiceContext)
  let flyoutSession: ReturnType<typeof showFlyout> | undefined
  onCleanup(() => {
    flyoutSession?.dispose()
  })
  const headingFont = createFontFamily(
    FontFamily,
    'Segoe UI Variable Text',
  )
  return (
    <Card>
      <UI.StackPanel spacing={10}>
        <UI.TextBlock
          {...styles.heading({
            level: 'subtitle',
            tone: 'accent',
          })}
          text="Scoped guidance"
          fontFamily={headingFont}
        />
        <UI.StackPanel orientation={1} spacing={10}>
          <UI.Button
            ref={flyoutTarget}
            automationId="ShowFlyoutButton"
            onClick={() => {
              const target = flyoutTarget.current
              if (!target) {
                throw new Error('Flyout target is not mounted.')
              }
              flyoutSession?.dispose()
              flyoutSession = showFlyout(
                context.renderer,
                new Flyout(),
                target,
                <UI.StackPanel spacing={8}>
                  <UI.TextBlock
                    automationId="Phase2FlyoutContent"
                    text="Renderer-owned Flyout content"
                  />
                  <UI.Button
                    automationId="CloseFlyoutButton"
                    onClick={() => {
                      flyoutSession?.hide()
                    }}
                  >
                    Close flyout
                  </UI.Button>
                </UI.StackPanel>,
                { observeClose: false },
              )
            }}
          >
            Show flyout
          </UI.Button>
          <UI.Button
            ref={teachingTipTarget}
            automationId="ShowTeachingTipButton"
            onClick={() => {
              const target = teachingTipTarget.current
              if (!target) {
                throw new Error('TeachingTip target is not mounted.')
              }
              if (!teachingTipService) {
                throw new Error('TeachingTip service is unavailable.')
              }
              teachingTipService.open(target)
            }}
          >
            Show teaching tip
          </UI.Button>
        </UI.StackPanel>
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
      onLoaded={() => {
        context.model.status.value = 'running'
      }}
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
          column={0}
          automationId="TasksMetric"
          label="Tasks"
          value={computed(() => String(context.model.tasks.value.length))}
          detail={context.model.taskSummary}
        />
        <MetricCard
          column={1}
          automationId="CompleteMetric"
          label="Complete"
          value={computed(() => `${context.model.completion.value}%`)}
          detail="Reactive progress"
        />
        <MetricCard
          column={2}
          automationId="RuntimeMetric"
          label="Runtime"
          value="Native"
          detail="Window and Worker stay alive"
        />
        <MetricCard
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
              {...styles.heading({ level: 'subtitle' })}
              text="Pilot application shell"
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
              {...styles.heading({ level: 'subtitle' })}
              text="Runtime health"
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
            <UI.TextBlock
              text={computed(() =>
                `Hot reload: ${context.model.hotStatus.value}`,
              )}
            />
          </UI.StackPanel>
        </Card>
      </LayoutGrid>
      <OverlayShowcase {...context} />
    </Page>
  )
}

function deferFocus(window: Window, focus: () => boolean): void {
  const timer = window.dispatcherQueue.createTimer()
  timer.interval = { duration: 2_500_000n }
  timer.isRepeating = false
  const unsubscribe = timer.onTick(() => {
    timer.stop()
    unsubscribe()
    focus()
  })
  timer.start()
}

async function confirmRemove(
  context: DashboardAppContext,
  task: DashboardTask,
  cancelFocus: () => void,
  afterRemoveFocus: () => void,
): Promise<void> {
  const dialog = new ContentDialog()
  const title = new TextBlock()
  title.text = 'Remove task?'
  dialog.title = title
  dialog.primaryButtonText = 'Remove'
  dialog.closeButtonText = 'Cancel'
  dialog.defaultButton = ContentDialogButton.Close
  AutomationProperties.setAutomationId(dialog, 'RemoveTaskDialog')
  AutomationProperties.setIsDialog(dialog, true)
  await showContentDialog(
    context.renderer,
    dialog,
    context.getXamlRoot(),
    <UI.TextBlock text={`Remove "${task.title}" from the sprint?`} />,
    {
      onClosed(result) {
        if (result === ContentDialogResult.Primary) {
          context.model.removeTask(task.id)
        }
      },
      restoreFocus(result) {
        if (result === ContentDialogResult.Primary) {
          afterRemoveFocus()
        }
        else {
          cancelFocus()
        }
      },
    },
  )
}

function TaskRow(props: TaskRowProps) {
  const removeButton = createFocusTarget<ButtonInstance>(
    FocusState.Programmatic,
  )
  return (
    <UI.Border padding={thickness(tokens.spacing.md)}>
      <UI.StackPanel
        orientation={1}
        spacing={12}
        verticalAlignment={VerticalAlignment.Center}
      >
        <UI.CheckBox
          automationId={`TaskCheck${props.task.id}`}
          automationName={`Mark ${props.task.title} complete`}
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
            {...styles.heading({ level: 'bodyStrong' })}
            text={props.task.title}
          />
          <UI.TextBlock
            {...styles.heading({
              level: 'caption',
              tone: 'secondary',
            })}
            text={props.task.detail}
          />
        </UI.StackPanel>
        <UI.Button
          ref={removeButton}
          automationName={`Remove ${props.task.title}`}
          automationHelpText="Opens a confirmation dialog."
          onClick={() => {
            void confirmRemove(
              props.context,
              props.task,
              () => {
                deferFocus(
                  props.context.window,
                  () => removeButton.focus(),
                )
              },
              props.afterRemoveFocus,
            )
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
  const inputLabel = signal<TextBlockInstance | null>(null)
  const addButton = createFocusTarget<ButtonInstance>(
    FocusState.Programmatic,
  )
  const selectedTaskIndex = signal(-1)
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
        <UI.TextBlock
          ref={(value) => {
            inputLabel.value = value
          }}
          automationId="TaskInputLabel"
          text="New task"
        />
        <UI.TextBox
          ref={input}
          automationId="TaskInput"
          automationLabeledBy={inputLabel}
          width={640}
          placeholderText="Add a task"
        />
        <UI.Button
          {...styles.button({ variant: 'accent' })}
          ref={addButton}
          automationId="AddTaskButton"
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
      <TaskList
        automationId="TaskList"
        selectedIndex={selectedTaskIndex}
        onSelectedIndexChange={(index) => {
          selectedTaskIndex.value = index
        }}
        header={
          <UI.TextBlock
            {...styles.heading({ level: 'bodyStrong' })}
            text={computed(() =>
              `${context.model.tasks.value.length} sprint tasks`,
            )}
          />
        }
        footer={
          <UI.TextBlock text="Select a task or use its checkbox and remove action." />
        }
      >
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
          {(task) => (
            <UI.ListViewItem
              automationId={`TaskItem${task.id}`}
              automationName={task.title}
              horizontalContentAlignment={HorizontalAlignment.Stretch}
              padding={thickness(0)}
            >
              <TaskRow
                context={context}
                task={task}
                afterRemoveFocus={() => {
                  deferFocus(
                    context.window,
                    () => addButton.focus(),
                  )
                }}
              />
            </UI.ListViewItem>
          )}
        </For>
      </TaskList>
    </Page>
  )
}

function DiagnosticsPage(context: DashboardAppContext) {
  const hotTone = computed<
    'attention' | 'critical' | 'success'
  >(() =>
      context.model.hotStatus.value === 'error'
        ? 'critical'
        : context.model.hotStatus.value === 'ready'
          ? 'success'
          : 'attention',
  )
  return (
    <Page
      title="Diagnostics"
      subtitle="Renderer counters and hot reload recovery state."
      automationId="DiagnosticsPageHeading"
    >
      <Card>
        <UI.StackPanel spacing={12}>
          <UI.Border {...styles.status({ tone: hotTone })}>
            <UI.TextBlock
              {...styles.heading({ level: 'bodyStrong' })}
              automationId="HotReloadStatus"
              text={computed(() =>
                `Hot reload ${context.model.hotStatus.value}; version ${context.model.hotVersion.value}`,
              )}
            />
          </UI.Border>
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
  const themeController = useContext(ThemeControllerContext)
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
              if (!themeController) {
                throw new Error('Theme controller is unavailable.')
              }
              themeController.setDark(isOn)
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
  const teachingTip: RefObject<TeachingTip> = { current: null }
  const teachingTipOpen = signal(false)
  let teachingTipTarget: ButtonInstance | null = null
  let teachingTipTimer:
    | ReturnType<Window['dispatcherQueue']['createTimer']>
    | undefined
  let teachingTipTimerSubscription: (() => void) | undefined
  const stopTeachingTipTimer = () => {
    teachingTipTimer?.stop()
    teachingTipTimerSubscription?.()
    teachingTipTimer = undefined
    teachingTipTimerSubscription = undefined
  }
  onCleanup(stopTeachingTipTimer)
  const teachingTipService: TeachingTipService = {
    open(target) {
      stopTeachingTipTimer()
      if (teachingTipOpen.value) {
        teachingTipOpen.value = false
        return
      }
      const tip = teachingTip.current
      if (!tip) {
        throw new Error('TeachingTip is not mounted.')
      }
      teachingTipTarget = target
      tip.target = target
      teachingTipOpen.value = true
      teachingTipTimer = context.window.dispatcherQueue.createTimer()
      teachingTipTimer.interval = { duration: 10_000_000n }
      teachingTipTimer.isRepeating = false
      teachingTipTimerSubscription = teachingTipTimer.onTick(() => {
        stopTeachingTipTimer()
        teachingTipOpen.value = false
      })
      teachingTipTimer.start()
    },
  }
  onMount(() => {
    const tip = teachingTip.current
    if (!tip) {
      throw new Error('TeachingTip did not mount before onMount.')
    }
    const property = TeachingTip.isOpenProperty
    const token = tip.registerPropertyChangedCallback(
      property,
      () => {
        if (!tip.isOpen) {
          teachingTipOpen.value = false
        }
      },
    )
    return () => {
      tip.unregisterPropertyChangedCallback(property, token)
    }
  })
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
    automationPositionInSet: 1,
    automationSizeOfSet: 3,
  })
  const tasksItem = createNavigationItem(itemBindings, {
    name: 'tasks',
    label: 'Tasks',
    icon: createSymbolIcon(SymbolIcon, Symbol.Bullets),
    automationId: 'TasksNavItem',
    automationName: 'Tasks page',
    automationPositionInSet: 2,
    automationSizeOfSet: 3,
  })
  const diagnosticsItem = createNavigationItem(itemBindings, {
    name: 'diagnostics',
    label: 'Diagnostics',
    icon: createSymbolIcon(SymbolIcon, Symbol.Repair),
    automationId: 'DiagnosticsNavItem',
    automationName: 'Diagnostics page',
    automationPositionInSet: 3,
    automationSizeOfSet: 3,
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
    <ThemeControllerContext.Provider value={themeController}>
      <TeachingTipServiceContext.Provider value={teachingTipService}>
        <AppNavigation
          ref={navigation}
          automationId="AppNavigation"
          requestedTheme={themeController.requestedTheme}
          paneTitle="DynWinRT JSX"
          paneDisplayMode={NavigationViewPaneDisplayMode.Left}
          isSettingsVisible
          menuItems={[dashboardItem, tasksItem]}
          footerMenuItems={[diagnosticsItem]}
          selectedItem={selectedItem}
          onLoaded={() => {
            const scale = context.getXamlRoot().rasterizationScale
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
          <UI.Grid>
            {computed(() =>
              renderRoute(context, context.model.route.value),
            )}
            <UI.TeachingTip
              ref={teachingTip}
              isLightDismissEnabled
              isOpen={teachingTipOpen}
            >
              <Show when={teachingTipOpen}>
                {() => (
                  <UI.StackPanel spacing={8}>
                    <UI.TextBlock
                      automationId="Phase2TeachingTipContent"
                      text="TeachingTip content is scoped per open cycle."
                    />
                    <UI.Button
                      automationId="CloseTeachingTipButton"
                      onClick={() => {
                        teachingTipOpen.value = false
                      }}
                    >
                      Close tip
                    </UI.Button>
                  </UI.StackPanel>
                )}
              </Show>
            </UI.TeachingTip>
          </UI.Grid>
        </AppNavigation>
    </TeachingTipServiceContext.Provider>
    </ThemeControllerContext.Provider>
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
            {...styles.heading({ level: 'subtitle' })}
            text="Dashboard render failed"
          />
          <UI.TextBlock
            text={
              error instanceof Error
                ? error.stack ?? error.message
                : String(error)
            }
            textWrapping={1}
          />
        </UI.StackPanel>
      )}
    >
      <ApplicationShell {...context} />
    </ErrorBoundary>
  )
}
