import {
  ErrorBoundary,
  For,
  Show,
  batch,
  color,
  computed,
  cornerRadius,
  createContext,
  createControls,
  createMessageTransport,
  createStateBridge,
  createWinUIRenderer,
  effect,
  resource,
  signal,
  thickness,
  useContext,
  type Child,
  type ReadonlySignal,
  type RefObject,
  type RenderHandle,
} from 'dynwinrt-jsx'
import {
  Application,
  ApplicationTheme,
  Border,
  Button,
  CheckBox,
  ElementTheme,
  Grid,
  HorizontalAlignment,
  IMap_Object_Object,
  IReference_Boolean,
  IVector_UIElement,
  MicaBackdrop,
  Orientation,
  ProgressBar,
  PropertyValue,
  ScrollBarVisibility,
  ScrollViewer,
  SolidColorBrush,
  StackPanel,
  TextBlock,
  TextBox,
  TitleBarTheme,
  ToggleSwitch,
  VerticalAlignment,
  Window,
} from '../.winapp/bindings/index.js'
import { roInitialize } from '@microsoft/dynwinrt'

interface ParentPort {
  postMessage(message: unknown): void
}

interface StatePort {
  postMessage(message: unknown): void
  on(type: 'message', listener: (message: unknown) => void): unknown
  off(type: 'message', listener: (message: unknown) => void): unknown
  close(): void
}

declare function require(
  id: 'node:worker_threads',
): {
  parentPort: ParentPort | null
  workerData: {
    statePort: StatePort
  }
}

declare const process: {
  exit(code?: number): never
}

const {
  parentPort,
  workerData,
} = require('node:worker_threads')

if (!parentPort) {
  throw new Error('The WinUI entry point must run in a Worker.')
}

roInitialize(0)

interface DashboardState {
  readonly status: 'starting' | 'running' | 'closed'
  readonly taskCount: number
  readonly completedCount: number
}

const stateBridge = createStateBridge<DashboardState>(
  createMessageTransport(workerData.statePort),
  {
    role: 'client',
    channel: 'dashboard-state',
    initial: {
      status: 'starting',
      taskCount: 0,
      completedCount: 0,
    },
  },
)

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

const renderer = createWinUIRenderer({
  Application,
  Grid,
  IMap_Object_Object,
  IReference_Boolean,
  IVector_UIElement,
  PropertyValue,
  TextBlock,
})

type StackPanelInstance = InstanceType<typeof StackPanel>
type TextBoxInstance = InstanceType<typeof TextBox>
type ToggleSwitchInstance = InstanceType<typeof ToggleSwitch>

interface Task {
  readonly id: number
  readonly title: string
  readonly detail: string
  readonly completed: boolean
}

interface CardProps {
  readonly children: Child
  readonly width?: number
}

interface MetricCardProps {
  readonly label: string
  readonly value: string | ReturnType<typeof computed<string>>
  readonly detail: string | ReturnType<typeof computed<string>>
  readonly accent: SolidColorBrush
}

interface TaskRowProps {
  readonly task: Task
  readonly updateTask: (id: number, completed: boolean) => void
  readonly removeTask: (id: number) => void
}

const brush = (r: number, g: number, b: number, a = 255) =>
  new SolidColorBrush(color(r, g, b, a))

let colors: {
  blue: SolidColorBrush
  green: SolidColorBrush
  orange: SolidColorBrush
  purple: SolidColorBrush
  white: SolidColorBrush
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

function secondaryForeground(theme: ReadonlySignal<boolean>) {
  return computed(() =>
    theme.value ? brush(205, 205, 205) : brush(95, 95, 95),
  )
}

function contextualSecondaryForeground() {
  const theme = useContext(ThemeSignal)
  return theme ? secondaryForeground(theme) : brush(95, 95, 95)
}

function Card(props: CardProps) {
  return (
    <UI.Border
      width={props.width ?? Number.NaN}
      padding={thickness(18)}
      cornerRadius={cornerRadius(12)}
      borderThickness={thickness(1)}
      background={themeResource(
        'CardBackgroundFillColorDefaultBrush',
        brush(245, 245, 245),
      )}
      borderBrush={themeResource(
        'CardStrokeColorDefaultBrush',
        brush(220, 220, 220),
      )}
    >
      {props.children}
    </UI.Border>
  )
}

function SectionTitle(props: { title: string; subtitle?: string }) {
  return (
    <UI.StackPanel spacing={3}>
      <UI.TextBlock
        text={props.title}
        fontSize={17}
        fontWeight={{ weight: 700 }}
      />
      <Show when={props.subtitle}>
        {(subtitle) => (
          <UI.TextBlock
            text={subtitle}
            fontSize={12}
            foreground={contextualSecondaryForeground()}
          />
        )}
      </Show>
    </UI.StackPanel>
  )
}

function MetricCard(props: MetricCardProps) {
  return (
    <Card width={218}>
      <UI.StackPanel spacing={6}>
        <UI.StackPanel
          orientation={Orientation.Horizontal}
          spacing={8}
          verticalAlignment={VerticalAlignment.Center}
        >
          <UI.Border
            width={9}
            height={9}
            cornerRadius={cornerRadius(5)}
            background={props.accent}
          />
          <UI.TextBlock
            text={props.label.toUpperCase()}
            fontSize={11}
            fontWeight={{ weight: 700 }}
            foreground={contextualSecondaryForeground()}
          />
        </UI.StackPanel>
        <UI.TextBlock
          text={props.value}
          fontSize={28}
          fontWeight={{ weight: 700 }}
        />
        <UI.TextBlock
          text={props.detail}
          fontSize={12}
          foreground={contextualSecondaryForeground()}
        />
      </UI.StackPanel>
    </Card>
  )
}

function TaskRow(props: TaskRowProps) {
  return (
    <UI.Border
      padding={{ left: 12, top: 10, right: 10, bottom: 10 }}
      cornerRadius={cornerRadius(8)}
      background={themeResource(
        'LayerFillColorDefaultBrush',
        brush(255, 255, 255, 24),
      )}
    >
      <UI.StackPanel
        orientation={Orientation.Horizontal}
        spacing={12}
        verticalAlignment={VerticalAlignment.Center}
      >
        <UI.CheckBox
          isChecked={props.task.completed}
          onChecked={() => {
            if (!props.task.completed) {
              props.updateTask(props.task.id, true)
            }
          }}
          onUnchecked={() => {
            if (props.task.completed) {
              props.updateTask(props.task.id, false)
            }
          }}
        />
        <UI.StackPanel width={520} spacing={2}>
          <UI.TextBlock
            text={props.task.title}
            fontSize={13}
            fontWeight={{ weight: 600 }}
          />
          <UI.TextBlock
            text={props.task.detail}
            fontSize={11}
            foreground={contextualSecondaryForeground()}
          />
        </UI.StackPanel>
        <UI.Border
          padding={{ left: 9, top: 4, right: 9, bottom: 4 }}
          cornerRadius={cornerRadius(10)}
          background={props.task.completed ? colors.green : colors.orange}
        >
          <UI.TextBlock
            text={props.task.completed ? 'DONE' : 'ACTIVE'}
            fontSize={10}
            fontWeight={{ weight: 700 }}
            foreground={colors.white}
          />
        </UI.Border>
        <UI.Button
          onClick={() => props.removeTask(props.task.id)}
        >
          Remove
        </UI.Button>
      </UI.StackPanel>
    </UI.Border>
  )
}

function Dashboard(props: { window: Window }) {
  const darkTheme = signal(true)
  const focusMode = signal(false)
  const nextTaskId = signal(4)
  const tasks = signal<Task[]>([
    {
      id: 1,
      title: 'Finalize JSX renderer',
      detail: 'Native children, events, refs, and disposal',
      completed: true,
    },
    {
      id: 2,
      title: 'Exercise real WinUI bindings',
      detail: 'Run the TSX dashboard through dynwinrt',
      completed: false,
    },
    {
      id: 3,
      title: 'Document the V1 workflow',
      detail: 'Explain V1 setup, architecture, and current limits',
      completed: false,
    },
  ])

  const inputRef: RefObject<TextBoxInstance> = { current: null }
  const rootRef: RefObject<StackPanelInstance> = { current: null }
  const themeToggleRef: RefObject<ToggleSwitchInstance> = {
    current: null,
  }
  const completedCount = computed(
    () => tasks.value.filter((task) => task.completed).length,
  )
  const completion = computed(() =>
    tasks.value.length === 0
      ? 0
      : Math.round((completedCount.value / tasks.value.length) * 100),
  )
  const taskSummary = computed(
    () => `${completedCount.value} of ${tasks.value.length} completed`,
  )
  const buildStatus = computed(() =>
    completion.value === 100 ? 'Ready to ship' : 'In progress',
  )
  effect(() => {
    stateBridge.set({
      status: 'running',
      taskCount: tasks.value.length,
      completedCount: completedCount.value,
    })
  })

  const updateTask = (id: number, completed: boolean) => {
    tasks.value = tasks.value.map((task) =>
      task.id === id
        ? { ...task, completed }
        : task,
    )
  }

  const removeTask = (id: number) => {
    tasks.value = tasks.value.filter((task) => task.id !== id)
  }

  const addTask = () => {
    const input = inputRef.current
    const title = input?.text.trim()
    if (!input || !title) {
      return
    }

    tasks.value = [
      ...tasks.value,
      {
        id: nextTaskId.value,
        title,
        detail: 'Added from the native WinUI text box',
        completed: false,
      },
    ]
    nextTaskId.value += 1
    input.text = ''
  }

  const requestedTheme = computed(() =>
    darkTheme.value ? ElementTheme.Dark : ElementTheme.Light,
  )

  return (
    <ThemeSignal.Provider value={darkTheme}>
      <UI.ScrollViewer
      horizontalScrollBarVisibility={ScrollBarVisibility.Disabled}
      verticalScrollBarVisibility={ScrollBarVisibility.Auto}
    >
      <UI.StackPanel
        ref={rootRef}
        requestedTheme={requestedTheme}
        padding={{ left: 24, top: 20, right: 24, bottom: 24 }}
        spacing={18}
        onLoaded={() => {
          const scale = rootRef.current?.xamlRoot?.rasterizationScale ?? 1
          props.window.appWindow.resize({
            width: Math.round(1220 * scale),
            height: Math.round(820 * scale),
          })
          props.window.appWindow.moveInZOrderAtTop()
        }}
      >
        <UI.StackPanel
          orientation={Orientation.Horizontal}
          spacing={18}
          verticalAlignment={VerticalAlignment.Center}
        >
          <UI.StackPanel width={760} spacing={3}>
            <UI.TextBlock
              text="DynWinRT JSX Workspace"
              fontSize={28}
              fontWeight={{ weight: 700 }}
            />
            <UI.TextBlock
              text="React-like TSX authoring, fine-grained signals, native WinUI controls."
              fontSize={13}
              foreground={secondaryForeground(darkTheme)}
            />
          </UI.StackPanel>
          <UI.ToggleSwitch
            ref={themeToggleRef}
            header="Dark theme"
            isOn={darkTheme}
            onToggled={() => {
              const isOn = themeToggleRef.current?.isOn ?? darkTheme.value
              if (isOn === darkTheme.value) {
                return
              }
              batch(() => {
                darkTheme.value = isOn
                Application.current.requestedTheme =
                  isOn ? ApplicationTheme.Dark : ApplicationTheme.Light
                props.window.appWindow.titleBar.preferredTheme =
                  isOn ? TitleBarTheme.Dark : TitleBarTheme.Light
              })
            }}
          />
          <UI.Button
            style={resource('AccentButtonStyle', undefined, darkTheme)}
            onClick={() => {
              focusMode.value = !focusMode.value
            }}
          >
            {computed(() =>
              focusMode.value ? 'Exit focus' : 'Focus mode',
            )}
          </UI.Button>
        </UI.StackPanel>

        <UI.StackPanel
          orientation={Orientation.Horizontal}
          spacing={12}
        >
          <MetricCard
            label="Tasks"
            value={computed(() => String(tasks.value.length))}
            detail={taskSummary}
            accent={colors.blue}
          />
          <MetricCard
            label="Complete"
            value={computed(() => `${completion.value}%`)}
            detail="Reactive progress"
            accent={colors.green}
          />
          <MetricCard
            label="Runtime"
            value="Native"
            detail="No Chromium process"
            accent={colors.purple}
          />
          <MetricCard
            label="Build"
            value={buildStatus}
            detail="TypeScript + dynwinrt"
            accent={colors.orange}
          />
        </UI.StackPanel>

        <Show
          when={focusMode}
          fallback={
            <UI.StackPanel
              orientation={Orientation.Horizontal}
              spacing={14}
            >
              <Card width={820}>
                <UI.StackPanel spacing={14}>
                  <SectionTitle
                    title="Sprint tasks"
                    subtitle="Each row is a live native control subtree."
                  />
                  <UI.StackPanel
                    orientation={Orientation.Horizontal}
                    spacing={10}
                  >
                    <UI.TextBox
                      ref={inputRef}
                      width={630}
                      placeholderText="Add a task"
                    />
                    <UI.Button
                      style={resource(
                        'AccentButtonStyle',
                        undefined,
                        darkTheme,
                      )}
                      onClick={addTask}
                    >
                      Add task
                    </UI.Button>
                  </UI.StackPanel>
                  <UI.ProgressBar
                    value={completion}
                    minimum={0}
                    maximum={100}
                  />
                  <UI.StackPanel spacing={8}>
                    <For
                      each={tasks}
                      key={(task) => task.id}
                      fallback={
                        <UI.TextBlock
                          text="No tasks. Add one above."
                          horizontalAlignment={HorizontalAlignment.Center}
                        />
                      }
                    >
                      {(task) => (
                        <TaskRow
                          task={task}
                          updateTask={updateTask}
                          removeTask={removeTask}
                        />
                      )}
                    </For>
                  </UI.StackPanel>
                </UI.StackPanel>
              </Card>

              <Card width={320}>
                <UI.StackPanel spacing={16}>
                  <SectionTitle
                    title="Runtime health"
                    subtitle="Direct signals update native properties."
                  />
                  <UI.StackPanel spacing={10}>
                    <UI.TextBlock
                      text="✓ Type-safe generated controls"
                      fontSize={13}
                    />
                    <UI.TextBlock
                      text="✓ Deterministic event cleanup"
                      fontSize={13}
                    />
                    <UI.TextBlock
                      text="✓ Fine-grained property updates"
                      fontSize={13}
                    />
                    <UI.TextBlock
                      text="✓ Native Fluent resources"
                      fontSize={13}
                    />
                  </UI.StackPanel>
                  <UI.Border
                    padding={thickness(12)}
                    cornerRadius={cornerRadius(8)}
                    background={colors.blue}
                  >
                    <UI.StackPanel spacing={3}>
                      <UI.TextBlock
                        text="V1 STATUS"
                        fontSize={10}
                        fontWeight={{ weight: 700 }}
                        foreground={colors.white}
                      />
                      <UI.TextBlock
                        text={buildStatus}
                        fontSize={15}
                        fontWeight={{ weight: 600 }}
                        foreground={colors.white}
                      />
                    </UI.StackPanel>
                  </UI.Border>
                </UI.StackPanel>
              </Card>
            </UI.StackPanel>
          }
        >
          <Card>
            <UI.StackPanel spacing={14}>
              <SectionTitle
                title="Focus mode"
                subtitle="Show swaps this entire native subtree without reconciling unrelated controls."
              />
              <UI.ProgressBar
                value={completion}
                minimum={0}
                maximum={100}
              />
              <UI.TextBlock
                text={taskSummary}
                fontSize={22}
                fontWeight={{ weight: 700 }}
              />
              <UI.TextBlock
                text="Finish the current sprint, then exit focus mode to manage individual tasks."
                fontSize={13}
              />
            </UI.StackPanel>
          </Card>
        </Show>
      </UI.StackPanel>
      </UI.ScrollViewer>
    </ThemeSignal.Provider>
  )
}

let application: Application | undefined
let renderHandle: RenderHandle | undefined
let closeSubscription: (() => void) | undefined
let exitCode = 1

Application.start(() => {
  try {
    application = Application.create(() => {
      try {
        const window = new Window()
        Application.current.requestedTheme = ApplicationTheme.Dark
        colors = {
          blue: brush(0, 120, 212),
          green: brush(16, 124, 16),
          orange: brush(202, 80, 16),
          purple: brush(136, 23, 152),
          white: brush(255, 255, 255),
        }
        window.title = 'DynWinRT JSX Workspace'
        window.systemBackdrop = new MicaBackdrop()
        window.appWindow.titleBar.preferredTheme = TitleBarTheme.Dark

        renderHandle = renderer.render(
          <ErrorBoundary
            fallback={(error) => (
              <UI.TextBlock
                text={`Dashboard failed: ${String(error)}`}
                margin={thickness(24)}
                textWrapping={1}
              />
            )}
          >
            <Dashboard window={window} />
          </ErrorBoundary>,
          window,
        )
        closeSubscription = window.onClosed(() => {
          try {
            stateBridge.set({
              ...stateBridge.state.value,
              status: 'closed',
            })
            renderHandle?.dispose()
            renderHandle = undefined
            closeSubscription?.()
            closeSubscription = undefined
          } finally {
            Application.current.exit()
          }
        })

        window.activate()
        exitCode = 0
      } catch (error) {
        parentPort.postMessage({
          type: 'error',
          message: error instanceof Error ? error.stack : String(error),
        })
        Application.current?.exit()
      }
    })
  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      message: error instanceof Error ? error.stack : String(error),
    })
  }
})

stateBridge.dispose()
workerData.statePort.close()
process.exit(exitCode)
