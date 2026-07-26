import {
  computed,
  onCleanup,
  signal,
  styles,
  thickness,
  tokens,
  type RefObject,
  type Signal,
} from 'dynwinrt-jsx'
import {
  AppWindow,
  CompactOverlayPresenter,
  CompactOverlaySize,
  DisplayArea,
  DisplayAreaFallback,
  FullScreenPresenter,
  HorizontalAlignment,
  InfoBarSeverity,
  NumberBoxSpinButtonPlacementMode,
  Orientation,
  OverlappedPresenter,
  OverlappedPresenterState,
  Symbol,
  TextAlignment,
  TextWrapping,
  TitleBarTheme,
  VerticalAlignment,
  Window,
  type DispatcherQueueTimer,
} from '#winapp/bindings'
import {
  type AppContext,
  type ComboBoxInstance,
  GalleryComboBox,
  type TextBoxInstance,
  type ToggleInstance,
  UI,
} from '../../gallery-ui'
import {
  Page,
  SampleCard,
} from '../../components/gallery-components'
import {
  formatNativeError,
  useSecondaryWindowScope,
} from './shared'

function WindowCloseButton(props: {
  readonly automationId: string
  readonly close: () => void
}) {
  return (
    <UI.Button
      automationId={props.automationId}
      width={200}
      margin={thickness(0, 16, 0, 0)}
      horizontalAlignment={HorizontalAlignment.Center}
      onClick={props.close}
    >
      <UI.StackPanel
        orientation={Orientation.Horizontal}
        spacing={4}
        verticalAlignment={VerticalAlignment.Center}
      >
        <UI.SymbolIcon symbol={Symbol.Cancel} />
        <UI.TextBlock text="Close" />
      </UI.StackPanel>
    </UI.Button>
  )
}

function GeneralWindowContent(props: {
  readonly window: Window
}) {
  let timer: DispatcherQueueTimer | undefined
  let timerSubscription: (() => void) | undefined
  const stopTimer = () => {
    timer?.stop()
    timerSubscription?.()
    timer = undefined
    timerSubscription = undefined
  }
  onCleanup(stopTimer)

  return (
    <UI.StackPanel
      spacing={8}
      horizontalAlignment={HorizontalAlignment.Center}
      verticalAlignment={VerticalAlignment.Center}
    >
      <UI.Button
        width={200}
        onClick={() => props.window.appWindow.hide()}
      >
        Hide
      </UI.Button>
      <UI.Button
        width={200}
        onClick={() => {
          stopTimer()
          props.window.appWindow.hide()
          timer = props.window.dispatcherQueue.createTimer()
          timer.interval = { duration: 30_000_000n }
          timer.isRepeating = false
          timerSubscription = timer.onTick(() => {
            stopTimer()
            props.window.appWindow.show()
          })
          timer.start()
        }}
      >
        Hide and show the window after 3 seconds
      </UI.Button>
      <WindowCloseButton
        automationId="GalleryWindowingGeneralChildClose"
        close={() => props.window.close()}
      />
    </UI.StackPanel>
  )
}

function BooleanOption(props: {
  readonly label: string
  readonly value: Signal<boolean>
  readonly onChanged?: (value: boolean) => void
}) {
  const toggle: RefObject<ToggleInstance> = { current: null }
  return (
    <UI.ToggleSwitch
      ref={toggle}
      header={props.label}
      isOn={props.value}
      onContent="true"
      offContent="false"
      onToggled={() => {
        const next = toggle.current?.isOn
        if (next !== undefined) {
          props.value.value = next
          props.onChanged?.(next)
        }
      }}
    />
  )
}

export function AppWindowPage(context: AppContext) {
  const windows = useSecondaryWindowScope(context)
  const status = signal('No secondary window is open.')
  const windowTitle = signal('This is a title')
  const windowWidth = signal(800)
  const windowHeight = signal(500)
  const xPoint = signal(50)
  const yPoint = signal(50)
  const isAlwaysOnTop = signal(false)
  const isMaximizable = signal(true)
  const isMinimizable = signal(true)
  const isResizable = signal(true)
  const hasBorder = signal(true)
  const hasTitleBar = signal(true)
  const minWidth = signal(400)
  const minHeight = signal(400)
  const maxWidth = signal(1000)
  const maxHeight = signal(1000)
  const compactSizeIndex = signal(0)
  const compactSizeNames = ['Small', 'Medium', 'Large'] as const
  const titleBox: RefObject<TextBoxInstance> = { current: null }
  const compactSizeBox: RefObject<ComboBoxInstance> = {
    current: null,
  }

  const runNative = (label: string, action: () => void) => {
    try {
      action()
      status.value = `${label} opened.`
      context.model.recordInteraction()
    }
    catch (error) {
      status.value = `${label} is unavailable: ${formatNativeError(error)}`
    }
  }

  const setIcon = (appWindow: AppContext['window']['appWindow']) => {
    appWindow.setIcon('Assets/Tiles/GalleryIcon.ico')
    appWindow.titleBar.preferredTheme =
      TitleBarTheme.UseDefaultAppMode
  }

  return (
    <Page
      title="AppWindow"
      subtitle="A flexible, customizable window management system for app development."
      automationId="AppWindowPageHeading"
      pageId="app-window"
      model={context.model}
    >
      <UI.TextBlock
        {...styles.heading({ level: 'subtitle' })}
        text="General usage of AppWindow"
      />
      <SampleCard
        automationId="GalleryWindowingAppWindowGeneralSample"
        title="Create and customize an AppWindow"
        description="Create a native XAML Window, then use its AppWindow to set the title, size, position, taskbar icon, and title-bar icon."
        code={`const window = new Window()
window.appWindow.title = title
window.appWindow.resize({ width, height })
window.appWindow.move({ x, y })
window.appWindow.setTaskbarIcon('Assets/Tiles/GalleryIcon.ico')
window.appWindow.setTitleBarIcon('Assets/Tiles/GalleryIcon.ico')
window.activate()`}
        output={
          <UI.TextBlock
            automationId="GalleryWindowingAppWindowStatus"
            text={status}
            textWrapping={TextWrapping.Wrap}
          />
        }
        options={
          <UI.StackPanel spacing={8} width={260}>
            <UI.TextBox
              ref={titleBox}
              automationId="GalleryWindowingAppWindowTitle"
              header="Window title"
              text={windowTitle}
              placeholderText="Enter window title"
              onTextChanged={() => {
                const next = titleBox.current?.text
                if (next !== undefined) {
                  windowTitle.value = next
                }
              }}
            />
            <UI.TextBlock text="Window size" fontWeight={{ weight: 600 }} />
            <UI.StackPanel orientation={Orientation.Horizontal} spacing={8}>
              <UI.NumberBox
                header="Width"
                width={120}
                minimum={200}
                maximum={1000}
                smallChange={10}
                largeChange={100}
                value={windowWidth}
                spinButtonPlacementMode={
                  NumberBoxSpinButtonPlacementMode.Inline
                }
                onValueChanged={(sender) => {
                  windowWidth.value = sender.value
                }}
              />
              <UI.NumberBox
                header="Height"
                width={120}
                minimum={200}
                maximum={700}
                smallChange={10}
                largeChange={100}
                value={windowHeight}
                spinButtonPlacementMode={
                  NumberBoxSpinButtonPlacementMode.Inline
                }
                onValueChanged={(sender) => {
                  windowHeight.value = sender.value
                }}
              />
            </UI.StackPanel>
            <UI.TextBlock text="Window position" fontWeight={{ weight: 600 }} />
            <UI.StackPanel orientation={Orientation.Horizontal} spacing={8}>
              <UI.NumberBox
                header="X"
                width={120}
                minimum={0}
                maximum={800}
                value={xPoint}
                spinButtonPlacementMode={
                  NumberBoxSpinButtonPlacementMode.Inline
                }
                onValueChanged={(sender) => {
                  xPoint.value = sender.value
                }}
              />
              <UI.NumberBox
                header="Y"
                width={120}
                minimum={0}
                maximum={300}
                value={yPoint}
                spinButtonPlacementMode={
                  NumberBoxSpinButtonPlacementMode.Inline
                }
                onValueChanged={(sender) => {
                  yPoint.value = sender.value
                }}
              />
            </UI.StackPanel>
          </UI.StackPanel>
        }
      >
        <UI.Button
          automationId="GalleryWindowingAppWindowShowGeneral"
          onClick={() => runNative('General AppWindow sample', () => {
            windows.openXamlWindow({
              title: windowTitle.value,
              configure(window) {
                const appWindow = window.appWindow
                appWindow.title = windowTitle.value
                appWindow.resize({
                  width: Math.round(windowWidth.value),
                  height: Math.round(windowHeight.value),
                })
                appWindow.move({
                  x: Math.round(xPoint.value),
                  y: Math.round(yPoint.value),
                })
                appWindow.setTaskbarIcon(
                  'Assets/Tiles/GalleryIcon.ico',
                )
                appWindow.setTitleBarIcon(
                  'Assets/Tiles/GalleryIcon.ico',
                )
                appWindow.titleBar.preferredTheme =
                  TitleBarTheme.UseDefaultAppMode
              },
              content: (window) => (
                <GeneralWindowContent window={window} />
              ),
              onClosed() {
                status.value = 'General AppWindow sample closed.'
              },
            })
          })}
        >
          Show window
        </UI.Button>
      </SampleCard>

      <SampleCard
        automationId="GalleryWindowingAppWindowCenteredSample"
        title="Center an AppWindow in the available display area"
        description="Use DisplayArea.GetFromWindowId and the AppWindow size to calculate a centered screen position."
        code={`const area = DisplayArea.getFromWindowId(
  window.appWindow.id,
  DisplayAreaFallback.Nearest,
)
window.appWindow.move({
  x: area.workArea.x + (area.workArea.width - window.appWindow.size.width) / 2,
  y: area.workArea.y + (area.workArea.height - window.appWindow.size.height) / 2,
})`}
      >
        <UI.Button
          automationId="GalleryWindowingAppWindowShowCentered"
          onClick={() => runNative('Centered AppWindow sample', () => {
            windows.openXamlWindow({
              title: 'Centered AppWindow sample',
              configure(window) {
                const appWindow = window.appWindow
                appWindow.resize({ width: 500, height: 320 })
                setIcon(appWindow)
                const area = DisplayArea.getFromWindowId(
                  appWindow.id,
                  DisplayAreaFallback.Nearest,
                )
                const workArea = area.workArea
                const size = appWindow.size
                appWindow.move({
                  x: Math.round(
                    workArea.x + (workArea.width - size.width) / 2,
                  ),
                  y: Math.round(
                    workArea.y + (workArea.height - size.height) / 2,
                  ),
                })
              },
              content: (window) => (
                <UI.StackPanel
                  spacing={12}
                  horizontalAlignment={HorizontalAlignment.Center}
                  verticalAlignment={VerticalAlignment.Center}
                >
                  <UI.TextBlock
                    {...styles.heading({ level: 'title' })}
                    text="This is a centered sample window"
                    textAlignment={TextAlignment.Center}
                  />
                  <WindowCloseButton
                    automationId="GalleryWindowingCenteredChildClose"
                    close={() => window.close()}
                  />
                </UI.StackPanel>
              ),
            })
          })}
        >
          Show centered sample window
        </UI.Button>
      </SampleCard>

      <UI.TextBlock
        {...styles.heading({ level: 'subtitle' })}
        margin={thickness(0, 8, 0, 0)}
        text="AppWindow Presenters"
      />
      <SampleCard
        automationId="GalleryWindowingAppWindowOverlappedSample"
        title="OverlappedPresenter"
        description="OverlappedPresenter is the default presenter for AppWindow, providing a standard resizable window with system buttons. It can control resizing, border, title bar, and button availability."
        code={`const presenter = OverlappedPresenter.create()
presenter.isAlwaysOnTop = isAlwaysOnTop
presenter.isMaximizable = isMaximizable
presenter.isMinimizable = isMinimizable
presenter.isResizable = isResizable
presenter.setBorderAndTitleBar(hasBorder, hasTitleBar)
window.appWindow.setPresenter(presenter)`}
        options={
          <UI.StackPanel spacing={8} width={250}>
            {([
              ['IsAlwaysOnTop', isAlwaysOnTop],
              ['IsMaximizable', isMaximizable],
              ['IsMinimizable', isMinimizable],
              ['IsResizable', isResizable],
              ['HasBorder', hasBorder],
              ['HasTitleBar', hasTitleBar],
            ] as const).map(([label, value]) => (
              <BooleanOption
                label={label}
                value={value}
                onChanged={(next) => {
                  if (label === 'HasBorder' && !next) {
                    hasTitleBar.value = false
                  }
                  if (label === 'HasTitleBar' && next) {
                    hasBorder.value = true
                  }
                }}
              />
            ))}
          </UI.StackPanel>
        }
      >
        <UI.StackPanel spacing={8}>
          <UI.InfoBar
            isOpen
            isClosable={false}
            severity={InfoBarSeverity.Warning}
            title="Warning"
            message="If HasTitleBar is true, HasBorder must also be true. The options enforce this native constraint."
          />
          <UI.Button
            automationId="GalleryWindowingAppWindowShowOverlapped"
            onClick={() => runNative('OverlappedPresenter sample', () => {
              const presenter = OverlappedPresenter.create()
              presenter.isAlwaysOnTop = isAlwaysOnTop.value
              presenter.isMaximizable = isMaximizable.value
              presenter.isMinimizable = isMinimizable.value
              presenter.isResizable = isResizable.value
              presenter.setBorderAndTitleBar(
                hasBorder.value,
                hasTitleBar.value,
              )
              windows.openXamlWindow({
                title: 'OverlappedPresenter sample',
                configure(window) {
                  setIcon(window.appWindow)
                  window.appWindow.resize({
                    width: 600,
                    height: 440,
                  })
                  window.appWindow.setPresenter(presenter)
                },
                content: (window) => (
                  <UI.StackPanel
                    spacing={10}
                    horizontalAlignment={HorizontalAlignment.Center}
                    verticalAlignment={VerticalAlignment.Center}
                  >
                    <UI.Button
                      width={200}
                      onClick={() => {
                        if (
                          presenter.state ===
                          OverlappedPresenterState.Maximized
                        ) {
                          presenter.restore()
                        }
                        else {
                          presenter.maximize()
                        }
                      }}
                    >
                      Maximize / restore
                    </UI.Button>
                    <UI.Button
                      width={200}
                      onClick={() => presenter.minimize()}
                    >
                      Minimize
                    </UI.Button>
                    <WindowCloseButton
                      automationId="GalleryWindowingOverlappedChildClose"
                      close={() => window.close()}
                    />
                  </UI.StackPanel>
                ),
              })
            })}
          >
            Show window
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GalleryWindowingAppWindowSizeConstraintsSample"
        title="Preferred minimum and maximum size"
        description="Set preferred minimum and maximum dimensions on an OverlappedPresenter. Maximization is disabled when maximum dimensions are constrained."
        code={`const presenter = OverlappedPresenter.create()
presenter.preferredMinimumWidth = minWidth
presenter.preferredMinimumHeight = minHeight
presenter.preferredMaximumWidth = maxWidth
presenter.preferredMaximumHeight = maxHeight
presenter.isMaximizable = false`}
        options={
          <UI.StackPanel spacing={8} width={240}>
            {([
              ['PreferredMinimumWidth', minWidth],
              ['PreferredMinimumHeight', minHeight],
              ['PreferredMaximumWidth', maxWidth],
              ['PreferredMaximumHeight', maxHeight],
            ] as const).map(([header, value]) => (
              <UI.NumberBox
                header={header}
                value={value}
                onValueChanged={(sender) => {
                  value.value = sender.value
                }}
              />
            ))}
          </UI.StackPanel>
        }
      >
        <UI.Button
          automationId="GalleryWindowingAppWindowShowConstrained"
          onClick={() => runNative('Constrained AppWindow sample', () => {
            const presenter = OverlappedPresenter.create()
            presenter.preferredMinimumWidth =
              Math.round(minWidth.value)
            presenter.preferredMinimumHeight =
              Math.round(minHeight.value)
            presenter.preferredMaximumWidth =
              Math.round(maxWidth.value)
            presenter.preferredMaximumHeight =
              Math.round(maxHeight.value)
            presenter.isMaximizable = false
            windows.openXamlWindow({
              title: 'Constrained AppWindow sample',
              configure(window) {
                setIcon(window.appWindow)
                window.appWindow.resize({ width: 800, height: 500 })
                window.appWindow.setPresenter(presenter)
              },
              content: (window) => (
                <UI.StackPanel
                  spacing={10}
                  horizontalAlignment={HorizontalAlignment.Center}
                  verticalAlignment={VerticalAlignment.Center}
                >
                  <UI.Button
                    width={200}
                    onClick={() => presenter.minimize()}
                  >
                    Minimize
                  </UI.Button>
                  <WindowCloseButton
                    automationId="GalleryWindowingConstrainedChildClose"
                    close={() => window.close()}
                  />
                </UI.StackPanel>
              ),
            })
          })}
        >
          Show window
        </UI.Button>
      </SampleCard>

      <SampleCard
        automationId="GalleryWindowingAppWindowModalSample"
        title="Modal window"
        description="A modal window is a separate owned window that blocks interaction with its owner until it closes. This sample uses AppWindow.Create with the main AppWindow ID and an OverlappedPresenter configured as modal."
        code={`const presenter = OverlappedPresenter.createForDialog()
presenter.isModal = true
const modal = AppWindow.create(
  presenter,
  mainWindow.appWindow.id,
  mainWindow.dispatcherQueue,
)
modal.show()`}
      >
        <UI.Button
          automationId="GalleryWindowingAppWindowShowModal"
          onClick={() => runNative('Modal AppWindow sample', () => {
            const presenter = OverlappedPresenter.createForDialog()
            presenter.isModal = true
            windows.openAppWindow({
              create: () => AppWindow.create(
                presenter,
                context.window.appWindow.id,
                context.window.dispatcherQueue,
              ),
              title: 'Modal AppWindow sample — close to continue',
              width: 420,
              height: 260,
              onClosed() {
                status.value = 'Modal AppWindow sample closed.'
                context.window.activate()
              },
            })
          })}
        >
          Show modal window
        </UI.Button>
      </SampleCard>

      <SampleCard
        automationId="GalleryWindowingAppWindowFullScreenSample"
        title="FullScreenPresenter"
        description="FullScreenPresenter covers the display and removes the title bar and system UI. Always provide an obvious exit mechanism."
        code={`const presenter = FullScreenPresenter.create()
window.appWindow.setPresenter(presenter)`}
      >
        <UI.Button
          automationId="GalleryWindowingAppWindowShowFullScreen"
          onClick={() => runNative('FullScreenPresenter sample', () => {
            const presenter = FullScreenPresenter.create()
            windows.openXamlWindow({
              title: 'FullScreenPresenter sample',
              configure(window) {
                setIcon(window.appWindow)
                window.appWindow.setPresenter(presenter)
              },
              content: (window) => (
                <UI.StackPanel
                  spacing={12}
                  horizontalAlignment={HorizontalAlignment.Center}
                  verticalAlignment={VerticalAlignment.Center}
                >
                  <UI.TextBlock
                    {...styles.heading({ level: 'title' })}
                    text="This window is running in Fullscreen mode"
                    textAlignment={TextAlignment.Center}
                  />
                  <WindowCloseButton
                    automationId="GalleryWindowingFullScreenChildClose"
                    close={() => window.close()}
                  />
                </UI.StackPanel>
              ),
            })
          })}
        >
          Show window (Fullscreen mode)
        </UI.Button>
      </SampleCard>

      <SampleCard
        automationId="GalleryWindowingAppWindowCompactOverlaySample"
        title="CompactOverlayPresenter"
        description="CompactOverlayPresenter (Picture-in-Picture mode) keeps an AppWindow always on top while using minimal screen space."
        code={`const presenter = CompactOverlayPresenter.create()
presenter.initialSize = CompactOverlaySize.Small
window.appWindow.setPresenter(presenter)`}
        options={
          <UI.StackPanel spacing={8} width={260}>
            <GalleryComboBox
              ref={compactSizeBox}
              automationId="GalleryWindowingCompactOverlaySize"
              header="InitialSize"
              selectedIndex={compactSizeIndex}
              onSelectionChanged={() => {
                const index =
                  compactSizeBox.current?.selectedIndex
                if (index !== undefined && index >= 0) {
                  compactSizeIndex.value = index
                }
              }}
            >
              {compactSizeNames}
            </GalleryComboBox>
            <UI.TextBlock
              text={computed(() => {
                const percentages = ['5%', '15%', '25%']
                const name =
                  compactSizeNames[compactSizeIndex.value] ?? 'Small'
                return `${name}: Window size is approximately ${percentages[compactSizeIndex.value] ?? '5%'} of the display's work area.`
              })}
              textWrapping={TextWrapping.Wrap}
            />
          </UI.StackPanel>
        }
      >
        <UI.Button
          automationId="GalleryWindowingAppWindowShowCompactOverlay"
          onClick={() => runNative('CompactOverlayPresenter sample', () => {
            const presenter = CompactOverlayPresenter.create()
            presenter.initialSize = [
              CompactOverlaySize.Small,
              CompactOverlaySize.Medium,
              CompactOverlaySize.Large,
            ][compactSizeIndex.value] ?? CompactOverlaySize.Small
            windows.openXamlWindow({
              title: 'CompactOverlayPresenter sample',
              configure(window) {
                setIcon(window.appWindow)
                window.appWindow.setPresenter(presenter)
              },
              content: (window) => (
                <UI.StackPanel
                  padding={thickness(tokens.spacing.lg)}
                  spacing={8}
                  horizontalAlignment={HorizontalAlignment.Center}
                  verticalAlignment={VerticalAlignment.Center}
                >
                  <UI.TextBlock
                    text="This window is set to CompactOverlay (Picture-in-Picture) mode."
                    textAlignment={TextAlignment.Center}
                    textWrapping={TextWrapping.Wrap}
                  />
                  <WindowCloseButton
                    automationId="GalleryWindowingCompactOverlayChildClose"
                    close={() => window.close()}
                  />
                </UI.StackPanel>
              ),
            })
          })}
        >
          Show window (Picture-in-Picture mode)
        </UI.Button>
      </SampleCard>
    </Page>
  )
}
