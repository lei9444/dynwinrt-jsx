import {
  computed,
  signal,
  styles,
  thickness,
  tokens,
} from 'dynwinrt-jsx'
import {
  ElementTheme,
  HorizontalAlignment,
  TextAlignment,
  VerticalAlignment,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import {
  Page,
  SampleCard,
} from '../../components/gallery-components'
import {
  formatNativeError,
  useSecondaryWindowScope,
} from './shared'

export function MultipleWindowsPage(context: AppContext) {
  const windows = useSecondaryWindowScope(context)
  const openCount = signal(0)
  const status = signal('No child windows are open.')

  const createWindow = (cancelClose: boolean) => {
    try {
      windows.openXamlWindow({
        title: 'dynwinrt-jsx Gallery — child window',
        configure(window) {
          window.extendsContentIntoTitleBar = true
          window.appWindow.resizeClient({
            width: 500,
            height: 500,
          })
          window.appWindow.setIcon(
            'Assets/Tiles/GalleryIcon.ico',
          )
        },
        onClosing(_window, args) {
          if (cancelClose) {
            args.cancel = true
            status.value = 'The child Closing handler canceled the close.'
          }
        },
        content: (window) => (
          <UI.StackPanel
            automationId="GalleryWindowingMultipleChildRoot"
            requestedTheme={computed(() =>
              context.model.darkTheme.value
                ? ElementTheme.Dark
                : ElementTheme.Light,
            )}
            padding={thickness(tokens.spacing.xl)}
            spacing={16}
            horizontalAlignment={HorizontalAlignment.Center}
            verticalAlignment={VerticalAlignment.Center}
          >
            <UI.TextBlock
              {...styles.heading({ level: 'title' })}
              automationId="GalleryWindowingMultipleChildHeading"
              text="New child window!"
              textAlignment={TextAlignment.Center}
            />
            <UI.TextBlock
              text="This top-level XAML Window was created on the Gallery's existing WinUI STA and inherits the parent theme."
              textAlignment={TextAlignment.Center}
            />
            <UI.Button
              automationId="GalleryWindowingMultipleChildClose"
              width={180}
              onClick={() => window.close()}
            >
              Close child window
            </UI.Button>
          </UI.StackPanel>
        ),
        onClosed() {
          openCount.value = Math.max(0, openCount.value - 1)
          status.value = openCount.value === 0
            ? 'All child windows are closed.'
            : `${openCount.value} child window(s) remain open.`
        },
      })
      openCount.value += 1
      status.value = `${openCount.value} child window(s) open.`
      context.model.recordInteraction()
    }
    catch (error) {
      status.value =
        `Multiple windows are unavailable: ${formatNativeError(error)}`
    }
  }

  return (
    <Page
      title="Multiple windows"
      subtitle="An example showing the creation of single-threaded top-level XAML windows."
      automationId="MultipleWindowsPageHeading"
      pageId="multiple-windows"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryWindowingMultipleWindowsSample"
        title="Create single-threaded multiple windows"
        description="Windows App SDK supports multiple top-level XAML Windows on one UI thread. Each child Window, AppWindow, render handle, native root, and close subscription is retained until Closed and is forcibly closed during page or application teardown."
        code={`const pageWindows = secondaryWindows.createScope()
onCleanup(pageWindows.dispose)

pageWindows.openXamlWindow({
  title: "Child window",
  configure(window) {
    window.extendsContentIntoTitleBar = true
    window.appWindow.resizeClient({ width: 500, height: 500 })
  },
  content: (window) => <ChildContent window={window} />,
  onClosing(_window, args) {
    args.cancel = hasUnsavedWork
  },
})`}
        output={
          <UI.TextBlock
            automationId="GalleryWindowingMultipleWindowsStatus"
            text={status}
          />
        }
      >
        <UI.StackPanel spacing={8}>
          <UI.Button
            automationId="GalleryWindowingCreateNewWindow"
            onClick={() => createWindow(false)}
          >
            Create new Window
          </UI.Button>
          <UI.Button
            automationId="GalleryWindowingCreateCancelingWindow"
            onClick={() => createWindow(true)}
          >
            Create Window with canceling Closing handler
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
