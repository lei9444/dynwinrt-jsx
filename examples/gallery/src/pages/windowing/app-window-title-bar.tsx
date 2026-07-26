import {
  color,
  computed,
  signal,
  styles,
  thickness,
  type RefObject,
  type Signal,
} from 'dynwinrt-jsx'
import {
  AppWindowTitleBar,
  HorizontalAlignment,
  OverlappedPresenter,
  TextAlignment,
  TextWrapping,
  TitleBarHeightOption,
  TitleBarTheme,
  VerticalAlignment,
} from '#winapp/bindings'
import {
  type AppContext,
  type ComboBoxInstance,
  GalleryComboBox,
  UI,
} from '../../gallery-ui'
import {
  Page,
  SampleCard,
} from '../../components/gallery-components'
import {
  createSecondaryWindowManager,
  formatNativeError,
} from './shared'

type NativeColor = ReturnType<typeof color>

function CompactColorOption(props: {
  readonly label: string
  readonly value: Signal<NativeColor>
  readonly onChanged: (value: NativeColor) => void
}) {
  return (
    <UI.StackPanel spacing={4}>
      <UI.TextBlock text={props.label} />
      <UI.ColorPicker
        automationName={props.label}
        width={220}
        color={props.value}
        isAlphaEnabled
        isColorSpectrumVisible={false}
        isColorSliderVisible={false}
        isColorChannelTextInputVisible={false}
        isAlphaSliderVisible={false}
        isAlphaTextInputVisible={false}
        isHexInputVisible
        onColorChanged={(sender) => {
          props.value.value = sender.color
          props.onChanged(sender.color)
        }}
      />
    </UI.StackPanel>
  )
}

function TitleBarWindowContent(props: {
  readonly text: string
  readonly close: () => void
  readonly closeAutomationId: string
}) {
  return (
    <UI.StackPanel
      spacing={16}
      margin={thickness(20)}
      horizontalAlignment={HorizontalAlignment.Center}
      verticalAlignment={VerticalAlignment.Center}
    >
      <UI.TextBlock
        text={props.text}
        fontSize={16}
        textAlignment={TextAlignment.Center}
        textWrapping={TextWrapping.Wrap}
      />
      <UI.Button
        automationId={props.closeAutomationId}
        width={180}
        onClick={props.close}
      >
        Close window
      </UI.Button>
    </UI.StackPanel>
  )
}

export function AppWindowTitleBarPage(context: AppContext) {
  const windows = createSecondaryWindowManager(context.renderer)
  const customizationSupported =
    AppWindowTitleBar.isCustomizationSupported()
  const status = signal(
    customizationSupported
      ? 'AppWindowTitleBar customization is supported.'
      : 'AppWindowTitleBar customization is not supported on this system.',
  )
  const colorWindowOpen = signal(false)
  const extendWindowOpen = signal(false)
  const themeWindowOpen = signal(false)
  let colorTitleBar: AppWindowTitleBar | null = null
  let extendTitleBar: AppWindowTitleBar | null = null
  let themeTitleBar: AppWindowTitleBar | null = null

  const background = signal(color(242, 246, 250))
  const foreground = signal(color(30, 41, 51))
  const buttonBackground = signal(color(59, 130, 246))
  const buttonForeground = signal(color(255, 255, 255))
  const buttonHoverBackground = signal(color(37, 99, 235))
  const buttonHoverForeground = signal(color(255, 255, 255))
  const inactiveBackground = signal(color(229, 234, 240))
  const inactiveForeground = signal(color(107, 114, 128))
  const buttonInactiveBackground = signal(color(203, 213, 225))
  const buttonInactiveForeground = signal(color(71, 85, 105))
  const buttonPressedBackground = signal(color(29, 78, 216))
  const buttonPressedForeground = signal(color(255, 255, 255))
  const extendsContent = signal(true)
  const heightIndex = signal(0)
  const themeIndex = signal(1)
  const heightBox: RefObject<ComboBoxInstance> = {
    current: null,
  }
  const themeBox: RefObject<ComboBoxInstance> = {
    current: null,
  }
  const heightOptions = [
    TitleBarHeightOption.Standard,
    TitleBarHeightOption.Tall,
    TitleBarHeightOption.Collapsed,
  ] as const
  const themeOptions = [
    TitleBarTheme.Legacy,
    TitleBarTheme.UseDefaultAppMode,
    TitleBarTheme.Light,
    TitleBarTheme.Dark,
  ] as const

  const runNative = (label: string, action: () => void) => {
    if (!customizationSupported) {
      status.value =
        `${label} is unavailable because title-bar customization is not supported.`
      return
    }
    try {
      action()
      status.value = `${label} opened.`
      context.model.recordInteraction()
    }
    catch (error) {
      status.value = `${label} is unavailable: ${formatNativeError(error)}`
    }
  }

  const applyColor = (
    value: NativeColor,
    setter: (
      titleBar: AppWindowTitleBar,
      next: NativeColor,
    ) => void,
  ) => {
    if (colorTitleBar) {
      setter(colorTitleBar, value)
    }
  }

  const createFixedPresenter = () => {
    const presenter = OverlappedPresenter.create()
    presenter.isAlwaysOnTop = true
    presenter.isResizable = false
    return presenter
  }

  return (
    <Page
      title="AppWindowTitleBar"
      subtitle="Provides control over the app window title bar."
      automationId="AppWindowTitleBarPageHeading"
      pageId="app-window-title-bar"
      model={context.model}
    >
      <UI.TextBlock
        text="For the default title bar and basic scenarios, use the TitleBar control. AppWindowTitleBar exposes deeper system-caption customization."
        textWrapping={TextWrapping.Wrap}
      />
      <UI.InfoBar
        automationId="GalleryWindowingAppWindowTitleBarCapability"
        isOpen
        isClosable={false}
        title={customizationSupported ? 'Supported' : 'Unsupported'}
        message={status}
      />

      <SampleCard
        automationId="GalleryWindowingAppWindowTitleBarColorsSample"
        title="Title-bar color customization"
        description="Customize active, inactive, hover, and pressed caption colors. Changes apply live while the sample window remains open."
        code={`const titleBar = window.appWindow.titleBar
titleBar.backgroundColor = background
titleBar.foregroundColor = foreground
titleBar.buttonBackgroundColor = buttonBackground
titleBar.buttonForegroundColor = buttonForeground
titleBar.buttonHoverBackgroundColor = buttonHoverBackground
titleBar.buttonHoverForegroundColor = buttonHoverForeground
titleBar.buttonInactiveBackgroundColor = buttonInactiveBackground
titleBar.buttonInactiveForegroundColor = buttonInactiveForeground
titleBar.inactiveBackgroundColor = inactiveBackground
titleBar.inactiveForegroundColor = inactiveForeground
titleBar.buttonPressedBackgroundColor = buttonPressedBackground
titleBar.buttonPressedForegroundColor = buttonPressedForeground`}
        options={
          <UI.StackPanel spacing={8} width={250}>
            <CompactColorOption
              label="BackgroundColor"
              value={background}
              onChanged={(value) => applyColor(
                value,
                (titleBar, next) => {
                  titleBar.backgroundColor = next
                },
              )}
            />
            <CompactColorOption
              label="ForegroundColor"
              value={foreground}
              onChanged={(value) => applyColor(
                value,
                (titleBar, next) => {
                  titleBar.foregroundColor = next
                },
              )}
            />
            <CompactColorOption
              label="ButtonBackgroundColor"
              value={buttonBackground}
              onChanged={(value) => applyColor(
                value,
                (titleBar, next) => {
                  titleBar.buttonBackgroundColor = next
                },
              )}
            />
            <CompactColorOption
              label="ButtonForegroundColor"
              value={buttonForeground}
              onChanged={(value) => applyColor(
                value,
                (titleBar, next) => {
                  titleBar.buttonForegroundColor = next
                },
              )}
            />
            <CompactColorOption
              label="ButtonHoverBackgroundColor"
              value={buttonHoverBackground}
              onChanged={(value) => applyColor(
                value,
                (titleBar, next) => {
                  titleBar.buttonHoverBackgroundColor = next
                },
              )}
            />
            <CompactColorOption
              label="ButtonHoverForegroundColor"
              value={buttonHoverForeground}
              onChanged={(value) => applyColor(
                value,
                (titleBar, next) => {
                  titleBar.buttonHoverForegroundColor = next
                },
              )}
            />
            <CompactColorOption
              label="InactiveBackgroundColor"
              value={inactiveBackground}
              onChanged={(value) => applyColor(
                value,
                (titleBar, next) => {
                  titleBar.inactiveBackgroundColor = next
                },
              )}
            />
            <CompactColorOption
              label="InactiveForegroundColor"
              value={inactiveForeground}
              onChanged={(value) => applyColor(
                value,
                (titleBar, next) => {
                  titleBar.inactiveForegroundColor = next
                },
              )}
            />
            <CompactColorOption
              label="ButtonInactiveBackgroundColor"
              value={buttonInactiveBackground}
              onChanged={(value) => applyColor(
                value,
                (titleBar, next) => {
                  titleBar.buttonInactiveBackgroundColor = next
                },
              )}
            />
            <CompactColorOption
              label="ButtonInactiveForegroundColor"
              value={buttonInactiveForeground}
              onChanged={(value) => applyColor(
                value,
                (titleBar, next) => {
                  titleBar.buttonInactiveForegroundColor = next
                },
              )}
            />
            <CompactColorOption
              label="ButtonPressedBackgroundColor"
              value={buttonPressedBackground}
              onChanged={(value) => applyColor(
                value,
                (titleBar, next) => {
                  titleBar.buttonPressedBackgroundColor = next
                },
              )}
            />
            <CompactColorOption
              label="ButtonPressedForegroundColor"
              value={buttonPressedForeground}
              onChanged={(value) => applyColor(
                value,
                (titleBar, next) => {
                  titleBar.buttonPressedForegroundColor = next
                },
              )}
            />
          </UI.StackPanel>
        }
      >
        <UI.Button
          automationId="GalleryWindowingAppWindowTitleBarShowColors"
          isEnabled={computed(() =>
            customizationSupported && !colorWindowOpen.value,
          )}
          onClick={() => runNative('Color customization sample', () => {
            const presenter = createFixedPresenter()
            windows.openXamlWindow({
              title: 'AppWindowTitleBar color customization',
              configure(window) {
                const appWindow = window.appWindow
                appWindow.setPresenter(presenter)
                appWindow.resize({ width: 600, height: 400 })
                colorTitleBar = appWindow.titleBar
                colorTitleBar.backgroundColor = background.value
                colorTitleBar.foregroundColor = foreground.value
                colorTitleBar.buttonBackgroundColor =
                  buttonBackground.value
                colorTitleBar.buttonForegroundColor =
                  buttonForeground.value
                colorTitleBar.buttonHoverBackgroundColor =
                  buttonHoverBackground.value
                colorTitleBar.buttonHoverForegroundColor =
                  buttonHoverForeground.value
                colorTitleBar.buttonInactiveBackgroundColor =
                  buttonInactiveBackground.value
                colorTitleBar.buttonInactiveForegroundColor =
                  buttonInactiveForeground.value
                colorTitleBar.inactiveBackgroundColor =
                  inactiveBackground.value
                colorTitleBar.inactiveForegroundColor =
                  inactiveForeground.value
                colorTitleBar.buttonPressedBackgroundColor =
                  buttonPressedBackground.value
                colorTitleBar.buttonPressedForegroundColor =
                  buttonPressedForeground.value
              },
              content: (window) => (
                <TitleBarWindowContent
                  text="This sample window demonstrates AppWindowTitleBar color customization."
                  closeAutomationId="GalleryWindowingTitleBarColorsChildClose"
                  close={() => window.close()}
                />
              ),
              onClosed() {
                colorTitleBar = null
                colorWindowOpen.value = false
              },
            })
            colorWindowOpen.value = true
          })}
        >
          Show window
        </UI.Button>
      </SampleCard>

      <SampleCard
        automationId="GalleryWindowingAppWindowTitleBarExtendSample"
        title="Extend content into the title-bar area"
        description="Extend app content into the system title-bar area and choose a preferred caption height."
        code={`const titleBar = window.appWindow.titleBar
titleBar.extendsContentIntoTitleBar = extendsContent
if (titleBar.extendsContentIntoTitleBar) {
  titleBar.preferredHeightOption = TitleBarHeightOption.Tall
}`}
        options={
          <UI.StackPanel spacing={8} width={250}>
            <UI.CheckBox
              automationId="GalleryWindowingExtendContentCheckBox"
              isChecked={extendsContent}
              onChecked={() => {
                extendsContent.value = true
                if (extendTitleBar) {
                  extendTitleBar.extendsContentIntoTitleBar = true
                  extendTitleBar.preferredHeightOption =
                    heightOptions[heightIndex.value] ??
                    TitleBarHeightOption.Standard
                }
              }}
              onUnchecked={() => {
                extendsContent.value = false
                if (extendTitleBar) {
                  extendTitleBar.extendsContentIntoTitleBar = false
                }
              }}
            >
              Extend content into title bar
            </UI.CheckBox>
            <GalleryComboBox
              ref={heightBox}
              automationId="GalleryWindowingTitleBarHeightOption"
              header="TitleBarHeightOption"
              selectedIndex={heightIndex}
              onSelectionChanged={() => {
                const index = heightBox.current?.selectedIndex
                if (index === undefined || index < 0) {
                  return
                }
                heightIndex.value = index
                if (
                  extendTitleBar?.extendsContentIntoTitleBar
                ) {
                  extendTitleBar.preferredHeightOption =
                    heightOptions[index] ??
                    TitleBarHeightOption.Standard
                }
              }}
            >
              {['Standard', 'Tall', 'Collapsed']}
            </GalleryComboBox>
          </UI.StackPanel>
        }
      >
        <UI.Button
          automationId="GalleryWindowingAppWindowTitleBarShowExtend"
          isEnabled={computed(() =>
            customizationSupported && !extendWindowOpen.value,
          )}
          onClick={() => runNative('Extended title-bar sample', () => {
            const presenter = createFixedPresenter()
            windows.openXamlWindow({
              title: 'AppWindowTitleBar extend-content sample',
              configure(window) {
                const appWindow = window.appWindow
                appWindow.setPresenter(presenter)
                appWindow.resize({ width: 600, height: 400 })
                extendTitleBar = appWindow.titleBar
                extendTitleBar.buttonBackgroundColor =
                  color(0, 0, 0, 0)
                extendTitleBar.extendsContentIntoTitleBar =
                  extendsContent.value
                if (extendsContent.value) {
                  extendTitleBar.preferredHeightOption =
                    heightOptions[heightIndex.value] ??
                    TitleBarHeightOption.Standard
                }
              },
              content: (window) => (
                <TitleBarWindowContent
                  text="This sample demonstrates content extending into the title-bar area and title-bar height options."
                  closeAutomationId="GalleryWindowingTitleBarExtendChildClose"
                  close={() => window.close()}
                />
              ),
              onClosed() {
                extendTitleBar = null
                extendWindowOpen.value = false
              },
            })
            extendWindowOpen.value = true
          })}
        >
          Show window
        </UI.Button>
      </SampleCard>

      <SampleCard
        automationId="GalleryWindowingAppWindowTitleBarThemeSample"
        title="Preferred title-bar theme"
        description="Set the preferred system-caption theme independently from the app content theme."
        code={`window.appWindow.titleBar.preferredTheme =
  TitleBarTheme.UseDefaultAppMode`}
        options={
          <GalleryComboBox
            ref={themeBox}
            automationId="GalleryWindowingTitleBarThemeOption"
            width={220}
            header="TitleBarTheme"
            selectedIndex={themeIndex}
            onSelectionChanged={() => {
              const index = themeBox.current?.selectedIndex
              if (index === undefined || index < 0) {
                return
              }
              themeIndex.value = index
              if (themeTitleBar) {
                themeTitleBar.preferredTheme =
                  themeOptions[index] ??
                  TitleBarTheme.UseDefaultAppMode
              }
            }}
          >
            {['Legacy', 'UseDefaultAppMode', 'Light', 'Dark']}
          </GalleryComboBox>
        }
      >
        <UI.Button
          automationId="GalleryWindowingAppWindowTitleBarShowTheme"
          isEnabled={computed(() =>
            customizationSupported && !themeWindowOpen.value,
          )}
          onClick={() => runNative('Title-bar theme sample', () => {
            const presenter = createFixedPresenter()
            windows.openXamlWindow({
              title: 'AppWindowTitleBar theme sample',
              configure(window) {
                const appWindow = window.appWindow
                appWindow.setPresenter(presenter)
                appWindow.resize({ width: 600, height: 400 })
                themeTitleBar = appWindow.titleBar
                themeTitleBar.preferredTheme =
                  themeOptions[themeIndex.value] ??
                  TitleBarTheme.UseDefaultAppMode
              },
              content: (window) => (
                <TitleBarWindowContent
                  text="This sample window demonstrates AppWindowTitleBar preferred theme customization."
                  closeAutomationId="GalleryWindowingTitleBarThemeChildClose"
                  close={() => window.close()}
                />
              ),
              onClosed() {
                themeTitleBar = null
                themeWindowOpen.value = false
              },
            })
            themeWindowOpen.value = true
          })}
        >
          Show window
        </UI.Button>
      </SampleCard>
    </Page>
  )
}
