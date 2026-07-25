import {
  color,
  computed,
  cornerRadius,
  createSolidColorBrush,
  gridLength,
  signal,
  theme,
  thickness,
  type ReadonlySignal,
  type RefObject,
  type WinUIColor,
} from 'dynwinrt-jsx'
import {
  ColorPicker,
  HorizontalAlignment,
  Orientation,
  SolidColorBrush,
  TextWrapping,
  VerticalAlignment,
} from '#winapp/bindings'
import {
  type AppContext,
  LayoutGrid,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import { GuidanceText } from '../fundamentals/shared'

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

function ContrastCheck(props: {
  readonly passed: ReadonlySignal<boolean>
  readonly title: string
  readonly requirement: string
}) {
  return (
    <LayoutGrid
      columnDefinitions={[
        gridLength.pixel(42),
        gridLength.pixel(52),
        gridLength.star(),
      ]}
      columnSpacing={8}
    >
      <UI.Ellipse
        width={30}
        height={30}
        fill={computed(() =>
          props.passed.value
            ? theme.systemSuccess
            : theme.systemCritical,
        )}
      />
      <UI.FontIcon
        glyph={computed(() =>
          props.passed.value ? '\uE73E' : '\uE711',
        )}
        horizontalAlignment={HorizontalAlignment.Center}
        verticalAlignment={VerticalAlignment.Center}
      />
      <UI.TextBlock
        gridColumn={1}
        fontWeight={{ weight: 600 }}
        text={computed(() =>
          props.passed.value ? 'Pass' : 'Fail',
        )}
        verticalAlignment={VerticalAlignment.Center}
      />
      <UI.StackPanel gridColumn={2}>
        <UI.TextBlock
          fontWeight={{ weight: 600 }}
          text={props.title}
          textWrapping={TextWrapping.Wrap}
        />
        <UI.TextBlock
          text={props.requirement}
          textWrapping={TextWrapping.Wrap}
        />
      </UI.StackPanel>
    </LayoutGrid>
  )
}

export function ColorContrastPage(context: AppContext) {
  const textPicker: RefObject<ColorPicker> = { current: null }
  const backgroundPicker: RefObject<ColorPicker> = { current: null }
  const textColor = signal<WinUIColor>(color(0, 0, 0))
  const backgroundColor = signal<WinUIColor>(color(255, 255, 255))
  const textBrush = createSolidColorBrush(
    SolidColorBrush,
    textColor.value,
  )
  const backgroundBrush = createSolidColorBrush(
    SolidColorBrush,
    backgroundColor.value,
  )
  const ratio = computed(() =>
    contrastRatio(textColor.value, backgroundColor.value),
  )
  const displayedRatio = computed(
    () => Math.floor(ratio.value * 100) / 100,
  )
  const normalTextPasses = computed(() => ratio.value >= 4.5)
  const largeTextPasses = computed(() => ratio.value >= 3)
  const componentPasses = computed(() => ratio.value >= 3)
  const setColors = (
    nextText: WinUIColor,
    nextBackground: WinUIColor,
  ) => {
    textColor.value = nextText
    backgroundColor.value = nextBackground
    textBrush.color = nextText
    backgroundBrush.color = nextBackground
    if (textPicker.current) {
      textPicker.current.color = nextText
    }
    if (backgroundPicker.current) {
      backgroundPicker.current.color = nextBackground
    }
  }

  return (
    <Page
      title="Color Contrast"
      subtitle="High contrast design ensures accessibility for all users."
      automationId="ColorContrastPageHeading"
      pageId="color-contrast"
      model={context.model}
    >
      <GuidanceText text="Accessible apps use high-contrast, easy-to-read combinations for text and backgrounds. This benefits users with low vision and improves legibility across lighting conditions, displays, and device settings." />

      <SampleCard
        automationId="GalleryAccessibilityContrastSample"
        title="Color Contrast Checker"
        description="Choose text and background colors and compare their native preview against WCAG thresholds."
        code={`
const ratio = contrastRatio(textColor, backgroundColor)
const normalTextPasses = ratio >= 4.5
const largeTextPasses = ratio >= 3
        `}
        output={
          <UI.TextBlock
            automationId="GalleryAccessibilityContrastStatus"
            text={computed(
              () =>
                `Contrast ratio: ${displayedRatio.value.toFixed(2)}:1`,
            )}
          />
        }
      >
        <UI.StackPanel spacing={16}>
          <UI.Button
            automationId="GalleryAccessibilityContrastToggle"
            horizontalAlignment={HorizontalAlignment.Left}
            onClick={() => {
              setColors(
                color(255, 255, 255),
                color(170, 170, 170),
              )
              context.model.recordInteraction()
            }}
          >
            Use low-contrast preset
          </UI.Button>
          <LayoutGrid
            columnDefinitions={[
              gridLength.auto(),
              gridLength.auto(),
              gridLength.star(),
            ]}
            columnSpacing={16}
          >
            <UI.ColorPicker
              ref={textPicker}
              automationId="GalleryAccessibilityTextColorPicker"
              width={240}
              color={color(0, 0, 0)}
              isAlphaEnabled={false}
              onColorChanged={(sender) => {
                textColor.value = sender.color
                textBrush.color = sender.color
                context.model.recordInteraction()
              }}
            />
            <UI.ColorPicker
              ref={backgroundPicker}
              automationId="GalleryAccessibilityBackgroundColorPicker"
              gridColumn={1}
              width={240}
              color={color(255, 255, 255)}
              isAlphaEnabled={false}
              onColorChanged={(sender) => {
                backgroundColor.value = sender.color
                backgroundBrush.color = sender.color
                context.model.recordInteraction()
              }}
            />
            <UI.StackPanel
              gridColumn={2}
              spacing={8}
              verticalAlignment={VerticalAlignment.Center}
            >
              <UI.TextBlock
                fontWeight={{ weight: 600 }}
                text="Contrast Ratio"
              />
              <UI.TextBlock
                fontSize={20}
                text={computed(
                  () => `${displayedRatio.value.toFixed(2)}:1`,
                )}
              />
            </UI.StackPanel>
          </LayoutGrid>

          <LayoutGrid
            minHeight={300}
            columnDefinitions={[
              gridLength.star(),
              gridLength.star(),
            ]}
          >
            <UI.StackPanel
              padding={thickness(16)}
              spacing={16}
              background={theme.controlFill}
            >
              <ContrastCheck
                passed={normalTextPasses}
                title="Regular text"
                requirement="Requires at least 4.5:1"
              />
              <ContrastCheck
                passed={largeTextPasses}
                title="Large text (14pt bold or 18pt regular)"
                requirement="Requires at least 3:1"
              />
              <ContrastCheck
                passed={componentPasses}
                title="Graphical objects and UI components"
                requirement="Requires at least 3:1"
              />
            </UI.StackPanel>

            <UI.StackPanel
              gridColumn={1}
              automationId="GalleryAccessibilityContrastPreview"
              padding={thickness(20)}
              spacing={20}
              background={backgroundBrush}
              cornerRadius={cornerRadius(4)}
            >
              <UI.TextBlock
                foreground={textBrush}
                text="The quick brown fox jumped over the lazy dog."
                textWrapping={TextWrapping.Wrap}
              />
              <UI.TextBlock
                fontSize={24}
                foreground={textBrush}
                text="Large text preview"
              />
              <UI.StackPanel
                orientation={Orientation.Horizontal}
                spacing={12}
              >
                <UI.Rectangle
                  width={30}
                  height={30}
                  fill={textBrush}
                  radiusX={4}
                  radiusY={4}
                />
                <UI.Ellipse
                  width={30}
                  height={30}
                  fill={textBrush}
                />
                <UI.FontIcon
                  fontSize={20}
                  foreground={textBrush}
                  glyph={'\uE735'}
                />
              </UI.StackPanel>
            </UI.StackPanel>
          </LayoutGrid>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
