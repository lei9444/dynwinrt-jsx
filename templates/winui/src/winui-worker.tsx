import {
  ErrorBoundary,
  batch,
  computed,
  createControls,
  createMessageTransport,
  createStateBridge,
  createWinUIRenderer,
  effect,
  resource,
  signal,
  thickness,
  type RefObject,
  type RenderHandle,
} from 'dynwinrt-jsx'
import { roInitialize } from '@microsoft/dynwinrt'
import {
  Application,
  ApplicationTheme,
  Button,
  ElementTheme,
  Grid,
  IMap_Object_Object,
  IVector_UIElement,
  MicaBackdrop,
  PropertyValue,
  ScrollViewer,
  StackPanel,
  TextBlock,
  TitleBarTheme,
  ToggleSwitch,
  Window,
} from '../.winapp/bindings/index.js'

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
  workerData: { statePort: StatePort }
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

const bridge = createStateBridge(
  createMessageTransport(workerData.statePort),
  {
    role: 'client',
    channel: 'app-state',
    initial: {
      status: 'starting',
      count: 0,
    },
  },
)
const UI = createControls({
  Button,
  ScrollViewer,
  StackPanel,
  TextBlock,
  ToggleSwitch,
})
const renderer = createWinUIRenderer({
  Application,
  Grid,
  IMap_Object_Object,
  IVector_UIElement,
  PropertyValue,
  TextBlock,
})

type StackPanelInstance = InstanceType<typeof StackPanel>
type ToggleSwitchInstance = InstanceType<typeof ToggleSwitch>

function App(props: { window: Window }) {
  const count = signal(0)
  const darkTheme = signal(true)
  const rootRef: RefObject<StackPanelInstance> = { current: null }
  const themeRef: RefObject<ToggleSwitchInstance> = { current: null }
  const requestedTheme = computed(() =>
    darkTheme.value ? ElementTheme.Dark : ElementTheme.Light,
  )

  effect(() => {
    bridge.set({
      status: 'running',
      count: count.value,
    })
  })

  return (
    <UI.ScrollViewer>
      <UI.StackPanel
        ref={rootRef}
        requestedTheme={requestedTheme}
        padding={thickness(32)}
        spacing={16}
        onLoaded={() => {
          const scale = rootRef.current?.xamlRoot?.rasterizationScale ?? 1
          props.window.appWindow.resize({
            width: Math.round(640 * scale),
            height: Math.round(420 * scale),
          })
        }}
      >
        <UI.TextBlock
          text="dynwinrt-jsx"
          fontSize={30}
          fontWeight={{ weight: 700 }}
        />
        <UI.TextBlock
          text={computed(() => `Native count: ${count.value}`)}
          fontSize={20}
        />
        <UI.Button
          style={resource('AccentButtonStyle')}
          onClick={() => {
            count.value += 1
          }}
        >
          Increment
        </UI.Button>
        <UI.ToggleSwitch
          ref={themeRef}
          header="Dark theme"
          isOn={darkTheme}
          onToggled={() => {
            const isOn = themeRef.current?.isOn ?? darkTheme.value
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
      </UI.StackPanel>
    </UI.ScrollViewer>
  )
}

let renderHandle: RenderHandle | undefined
let closeSubscription: (() => void) | undefined
let exitCode = 1

Application.start(() => {
  try {
    Application.create(() => {
      try {
        const window = new Window()
        Application.current.requestedTheme = ApplicationTheme.Dark
        window.title = 'dynwinrt-jsx'
        window.systemBackdrop = new MicaBackdrop()
        window.appWindow.titleBar.preferredTheme = TitleBarTheme.Dark
        renderHandle = renderer.render(
          <ErrorBoundary
            fallback={(error) => (
              <UI.TextBlock
                text={`App failed: ${String(error)}`}
                margin={thickness(24)}
              />
            )}
          >
            <App window={window} />
          </ErrorBoundary>,
          window,
        )
        closeSubscription = window.onClosed(() => {
          try {
            bridge.set({
              ...bridge.state.value,
              status: 'closed',
            })
            renderHandle?.dispose()
            renderHandle = undefined
            const diagnostics = renderer.diagnostics
            if (
              diagnostics.activeNative !== 0 ||
              diagnostics.activeComponents !== 0
            ) {
              throw new Error(
                `Renderer disposal left active records: ${JSON.stringify(diagnostics)}`,
              )
            }
            parentPort.postMessage({
              type: 'diagnostics',
              value: diagnostics,
            })
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

bridge.dispose()
workerData.statePort.close()
process.exit(exitCode)
