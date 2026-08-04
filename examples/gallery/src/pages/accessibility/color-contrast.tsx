import {
  color,
  computed,
  createSolidColorBrush,
  effect,
  gridLength,
  onCleanup,
  signal,
  styles,
  theme,
  thickness,
  tokens,
  type ReadonlySignal,
  type RefObject,
  type WinUIColor,
} from 'dynwinrt-jsx'
import {
  AutomationLiveSetting,
  DispatcherQueuePriority,
  HorizontalAlignment,
  Orientation,
  Rectangle,
  SolidColorBrush,
  TextBox,
  TextWrapping,
  VerticalAlignment,
} from '#winapp/bindings'
import {
  type AppContext,
  GallerySplitButton,
  LayoutGrid,
  UI,
} from '../../gallery-ui'
import { Page } from '../../components/gallery-components'

function relativeLuminance(value: WinUIColor): number {
  const channel = (component: number) => {
    const srgb = component / 255
    return srgb <= 0.04045
      ? srgb / 12.92
      : ((srgb + 0.055) / 1.055) ** 2.4
  }
  return (
    0.2126 * channel(value.r) +
    0.7152 * channel(value.g) +
    0.0722 * channel(value.b)
  )
}

function contrastRatio(
  first: WinUIColor,
  second: WinUIColor,
): number {
  const firstLuminance = relativeLuminance(first)
  const secondLuminance = relativeLuminance(second)
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  )
}

function formatHex(value: WinUIColor): string {
  const channel = (component: number) =>
    component.toString(16).padStart(2, '0').toUpperCase()
  return `#${channel(value.r)}${channel(value.g)}${channel(value.b)}`
}

function parseHex(value: string): WinUIColor | null {
  const match = /^#?([0-9A-Fa-f]{6})$/.exec(value.trim())
  if (!match) {
    return null
  }
  const hex = match[1]!
  return color(
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  )
}

function colorsEqual(
  left: WinUIColor,
  right: WinUIColor,
): boolean {
  return (
    left.a === right.a &&
    left.r === right.r &&
    left.g === right.g &&
    left.b === right.b
  )
}

function InlineColorPicker(props: {
  readonly context: AppContext
  readonly header: string
  readonly automationId: string
  readonly color: ReadonlySignal<WinUIColor>
  readonly hex: ReadonlySignal<string>
  readonly brush: ReadonlySignal<SolidColorBrush>
  readonly onColorChange: (value: WinUIColor) => void
  readonly onHexChange: (value: string) => void
}) {
  const hexInput: RefObject<TextBox> = { current: null }
  let disposed = false
  onCleanup(() => {
    disposed = true
  })
  const swatch = props.context.createProjected(() => {
    const rectangle = new Rectangle()
    rectangle.width = 40
    rectangle.minHeight = 30
    rectangle.verticalAlignment = VerticalAlignment.Stretch
    rectangle.fill = props.brush.value
    return rectangle
  })
  effect(() => {
    swatch.fill = props.brush.value
    const nextHex = props.hex.value
    if (
      hexInput.current &&
      hexInput.current.text !== nextHex
    ) {
      hexInput.current.text = nextHex
    }
  })

  return (
    <LayoutGrid
      margin={thickness(12, 12, 0, 12)}
      rowDefinitions={[
        gridLength.auto(),
        gridLength.auto(),
      ]}
      columnDefinitions={[
        gridLength.auto(),
        gridLength.star(),
      ]}
      columnSpacing={2}
    >
      <UI.TextBlock
        {...styles.heading({ level: 'bodyStrong' })}
        gridColumnSpan={2}
        margin={thickness(0, 0, 0, 12)}
        text={props.header}
      />
      <GallerySplitButton
        automationId={`${props.automationId}Swatch`}
        automationName={`${props.header} color picker`}
        gridRow={1}
        padding={thickness(0)}
        verticalAlignment={VerticalAlignment.Stretch}
        content={swatch}
      >
        <UI.Flyout>
          <UI.ColorPicker
            color={props.color}
            isAlphaEnabled={false}
            isMoreButtonVisible={false}
            isHexInputVisible={false}
            isColorChannelTextInputVisible={false}
            onColorChanged={(sender) => {
              props.onColorChange(sender.color)
            }}
          />
        </UI.Flyout>
      </GallerySplitButton>
      <UI.TextBox
        ref={hexInput}
        automationId={props.automationId}
        automationName={`${props.header} hex value`}
        gridRow={1}
        gridColumn={1}
        minWidth={120}
        margin={thickness(4, 0, 0, 0)}
        text={props.hex.value}
        onTextChanged={() => {
          const queued =
            props.context.window.dispatcherQueue.tryEnqueue(
              DispatcherQueuePriority.Low,
              () => {
                if (!disposed && hexInput.current) {
                  props.onHexChange(hexInput.current.text)
                }
              },
            )
          if (!queued) {
            throw new Error(
              'Color hex update could not be queued.',
            )
          }
        }}
      />
    </LayoutGrid>
  )
}

function ContrastCheck(props: {
  readonly passed: ReadonlySignal<boolean>
  readonly title: string
  readonly requirement: string
  readonly successBrush: SolidColorBrush
  readonly failureBrush: SolidColorBrush
  readonly iconBrush: SolidColorBrush
  readonly gridRow: number
}) {
  return (
    <>
      <LayoutGrid
        gridRow={props.gridRow}
        margin={thickness(12, 0, 0, 0)}
      >
        <UI.Ellipse
          width={30}
          height={30}
          fill={computed(() =>
            props.passed.value
              ? props.successBrush
              : props.failureBrush,
          )}
        />
        <UI.FontIcon
          foreground={props.iconBrush}
          glyph={computed(() =>
            props.passed.value ? '\uE73E' : '\uE711',
          )}
          horizontalAlignment={HorizontalAlignment.Center}
          verticalAlignment={VerticalAlignment.Center}
        />
      </LayoutGrid>
      <UI.TextBlock
        gridRow={props.gridRow}
        gridColumn={1}
        width={40}
        verticalAlignment={VerticalAlignment.Center}
        fontWeight={{ weight: 600 }}
        text={computed(() =>
          props.passed.value ? 'Pass' : 'Fail',
        )}
      />
      <UI.StackPanel
        gridRow={props.gridRow}
        gridColumn={2}
        padding={thickness(0, 0, 12, 0)}
        verticalAlignment={VerticalAlignment.Center}
      >
        <UI.TextBlock
          fontWeight={{ weight: 600 }}
          text={props.title}
          textWrapping={TextWrapping.WrapWholeWords}
        />
        <UI.TextBlock
          text={props.requirement}
          textWrapping={TextWrapping.WrapWholeWords}
        />
      </UI.StackPanel>
    </>
  )
}

export function ColorContrastPage(context: AppContext) {
  const textColor = signal<WinUIColor>(color(0, 0, 0))
  const backgroundColor = signal<WinUIColor>(
    color(255, 255, 255),
  )
  const textHex = signal('#000000')
  const backgroundHex = signal('#FFFFFF')
  let textBrushOwner = context.createProjectedOwner(
    createSolidColorBrush(
      SolidColorBrush,
      textColor.value,
    ),
  )
  let backgroundBrushOwner = context.createProjectedOwner(
    createSolidColorBrush(
      SolidColorBrush,
      backgroundColor.value,
    ),
  )
  const textBrush = signal(textBrushOwner.value)
  const backgroundBrush = signal(backgroundBrushOwner.value)
  onCleanup(() => textBrushOwner.dispose())
  onCleanup(() => backgroundBrushOwner.dispose())
  const successBrush = context.createProjected(
    () =>
      createSolidColorBrush(
        SolidColorBrush,
        color(0, 100, 0),
      ),
  )
  const failureBrush = context.createProjected(
    () =>
      createSolidColorBrush(
        SolidColorBrush,
        color(139, 0, 0),
      ),
  )
  const whiteBrush = context.createProjected(
    () =>
      createSolidColorBrush(
        SolidColorBrush,
        color(255, 255, 255),
      ),
  )
  const ratio = computed(() =>
    contrastRatio(textColor.value, backgroundColor.value),
  )
  const displayedRatio = computed(
    () => Math.round(ratio.value * 100) / 100,
  )
  const ratioText = computed(
    () => `${displayedRatio.value}:1`,
  )
  const normalTextPasses = computed(() => ratio.value >= 4.5)
  const largeTextPasses = computed(() => ratio.value >= 3)
  const componentPasses = computed(() => ratio.value >= 3)

  const setTextColor = (
    value: WinUIColor,
    syncHex = true,
  ) => {
    if (colorsEqual(textColor.value, value)) {
      if (syncHex) {
        textHex.value = formatHex(value)
      }
      return
    }
    const nextOwner = context.createProjectedOwner(
      createSolidColorBrush(SolidColorBrush, value),
    )
    const previousOwner = textBrushOwner
    textBrushOwner = nextOwner
    textColor.value = value
    try {
      textBrush.value = nextOwner.value
    }
    catch (error) {
      textBrushOwner = previousOwner
      nextOwner.dispose()
      throw error
    }
    previousOwner.dispose()
    if (syncHex) {
      textHex.value = formatHex(value)
    }
    context.model.recordInteraction()
  }
  const setBackgroundColor = (
    value: WinUIColor,
    syncHex = true,
  ) => {
    if (colorsEqual(backgroundColor.value, value)) {
      if (syncHex) {
        backgroundHex.value = formatHex(value)
      }
      return
    }
    const nextOwner = context.createProjectedOwner(
      createSolidColorBrush(SolidColorBrush, value),
    )
    const previousOwner = backgroundBrushOwner
    backgroundBrushOwner = nextOwner
    backgroundColor.value = value
    try {
      backgroundBrush.value = nextOwner.value
    }
    catch (error) {
      backgroundBrushOwner = previousOwner
      nextOwner.dispose()
      throw error
    }
    previousOwner.dispose()
    if (syncHex) {
      backgroundHex.value = formatHex(value)
    }
    context.model.recordInteraction()
  }

  return (
    <Page
      title="Color Contrast"
      subtitle="High contrast design ensures accessibility for all users."
      automationId="ColorContrastPageHeading"
      pageId="color-contrast"
      model={context.model}
    >
      <UI.StackPanel spacing={12}>
        <UI.TextBlock
          text="Accessibility is about building experiences that make your Windows application usable by people of all abilities."
          textWrapping={TextWrapping.WrapWholeWords}
        />
        <UI.TextBlock
          text="To ensure optimal accessibility and usability, apps should strive to use high-contrast and easy-to-read color combinations for text and its background. This benefits users with lower visual acuity and improves legibility across lighting conditions, screens, and device settings."
          textWrapping={TextWrapping.WrapWholeWords}
        />
        <UI.TextBlock
          {...styles.heading({ level: 'subtitle' })}
          margin={thickness(0, 20, 0, 0)}
          text="Color Contrast Checker"
        />
        <UI.TextBlock
          margin={thickness(0, 0, 0, 10)}
          text="Use this tool to calculate the contrast ratio of two colors and measure them against the Web Content Accessibility Guidelines (WCAG)."
          textWrapping={TextWrapping.Wrap}
        />

        <UI.Border
          automationId="GalleryAccessibilityContrastSample"
          {...styles.card({ surface: 'layer' })}
          padding={thickness(8)}
        >
          <LayoutGrid
            rowDefinitions={[
              gridLength.auto(),
              gridLength.auto(),
              gridLength.auto(),
            ]}
            columnDefinitions={[
              gridLength.auto(),
              gridLength.auto(),
              gridLength.auto(),
              gridLength.star(),
            ]}
            rowSpacing={8}
            columnSpacing={8}
          >
            <UI.Border gridRowSpan={2}>
              <InlineColorPicker
                context={context}
                header="Text Color"
                automationId="GalleryAccessibilityTextColorHex"
                color={textColor}
                hex={textHex}
                brush={textBrush}
                onColorChange={setTextColor}
                onHexChange={(value) => {
                  textHex.value = value
                  const parsed = parseHex(value)
                  if (parsed) {
                    setTextColor(parsed, false)
                  }
                }}
              />
            </UI.Border>
            <UI.Border gridRowSpan={2} gridColumn={1}>
              <InlineColorPicker
                context={context}
                header="Background Color"
                automationId="GalleryAccessibilityBackgroundColorHex"
                color={backgroundColor}
                hex={backgroundHex}
                brush={backgroundBrush}
                onColorChange={setBackgroundColor}
                onHexChange={(value) => {
                  backgroundHex.value = value
                  const parsed = parseHex(value)
                  if (parsed) {
                    setBackgroundColor(parsed, false)
                  }
                }}
              />
            </UI.Border>
            <UI.TextBlock
              gridColumn={3}
              margin={thickness(12, 0, 0, 0)}
              verticalAlignment={VerticalAlignment.Center}
              fontWeight={{ weight: 600 }}
              text="Contrast Ratio"
            />
            <UI.TextBlock
              {...styles.heading({ level: 'subtitle' })}
              automationId="GalleryAccessibilityContrastStatus"
              automationLiveSetting={AutomationLiveSetting.Polite}
              gridRow={1}
              gridColumn={3}
              margin={thickness(12, -4, 0, 0)}
              text={ratioText}
            />

            <LayoutGrid
              gridRow={2}
              gridColumnSpan={4}
              minHeight={300}
              margin={thickness(12, 0, 12, 12)}
              columnDefinitions={[
                gridLength.star(),
                gridLength.star(),
              ]}
              cornerRadius={tokens.radius.control}
            >
              <LayoutGrid
                padding={thickness(8)}
                background={theme.controlFill}
                rowDefinitions={[
                  gridLength.star(),
                  gridLength.star(),
                  gridLength.star(),
                ]}
                columnDefinitions={[
                  gridLength.auto(),
                  gridLength.auto(),
                  gridLength.star(),
                ]}
                rowSpacing={16}
                columnSpacing={8}
              >
                <ContrastCheck
                  passed={normalTextPasses}
                  title="Regular text"
                  requirement="Requires at least 4.5:1"
                  successBrush={successBrush}
                  failureBrush={failureBrush}
                  iconBrush={whiteBrush}
                  gridRow={0}
                />
                <ContrastCheck
                  passed={largeTextPasses}
                  title="Large text (14 pt. bold or 18 pt. regular)"
                  requirement="Requires at least 3:1"
                  successBrush={successBrush}
                  failureBrush={failureBrush}
                  iconBrush={whiteBrush}
                  gridRow={1}
                />
                <ContrastCheck
                  passed={componentPasses}
                  title="Graphical objects and UI components"
                  requirement="Requires at least 3:1"
                  successBrush={successBrush}
                  failureBrush={failureBrush}
                  iconBrush={whiteBrush}
                  gridRow={2}
                />
              </LayoutGrid>

              <LayoutGrid
                gridColumn={1}
                automationId="GalleryAccessibilityContrastPreview"
                padding={thickness(8)}
                background={backgroundBrush}
                rowDefinitions={[
                  gridLength.star(),
                  gridLength.star(),
                  gridLength.star(),
                ]}
              >
                <UI.TextBlock
                  padding={thickness(12, 0)}
                  verticalAlignment={VerticalAlignment.Center}
                  foreground={textBrush}
                  text="The quick brown fox jumped over the lazy fox."
                  textWrapping={TextWrapping.WrapWholeWords}
                />
                <UI.StackPanel
                  gridRow={1}
                  padding={thickness(12, 0)}
                  verticalAlignment={VerticalAlignment.Center}
                >
                  <UI.TextBlock
                    fontSize={56 / 3}
                    fontWeight={{ weight: 600 }}
                    foreground={textBrush}
                    text="The quick brown fox jumped over the lazy fox."
                    textWrapping={TextWrapping.WrapWholeWords}
                  />
                  <UI.TextBlock
                    fontSize={24}
                    foreground={textBrush}
                    text="The quick brown fox jumped over the lazy fox."
                    textWrapping={TextWrapping.WrapWholeWords}
                  />
                </UI.StackPanel>
                <UI.StackPanel
                  gridRow={2}
                  padding={thickness(12, 0)}
                  orientation={Orientation.Horizontal}
                  spacing={8}
                  verticalAlignment={VerticalAlignment.Center}
                >
                  <LayoutGrid>
                    <UI.Rectangle
                      width={30}
                      height={30}
                      fill={textBrush}
                      radiusX={4}
                      radiusY={4}
                    />
                    <UI.FontIcon
                      foreground={whiteBrush}
                      glyph={'\uE73E'}
                    />
                  </LayoutGrid>
                  <LayoutGrid>
                    <UI.Rectangle
                      width={50}
                      height={30}
                      fill={textBrush}
                      radiusX={15}
                      radiusY={50}
                    />
                    <UI.Ellipse
                      width={15}
                      height={15}
                      margin={thickness(0, 0, 5, 0)}
                      horizontalAlignment={HorizontalAlignment.Right}
                      verticalAlignment={VerticalAlignment.Center}
                      fill={whiteBrush}
                    />
                  </LayoutGrid>
                  <UI.FontIcon
                    fontSize={20}
                    foreground={textBrush}
                    glyph={'\uE735'}
                  />
                </UI.StackPanel>
              </LayoutGrid>
            </LayoutGrid>
          </LayoutGrid>
        </UI.Border>
      </UI.StackPanel>
    </Page>
  )
}
