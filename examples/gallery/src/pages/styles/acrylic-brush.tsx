import {
  color,
  computed,
  signal,
  theme,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  AcrylicBrush,
  HorizontalAlignment,
  VerticalAlignment,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  type SliderInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import { GuidanceText } from '../fundamentals/shared'

const tintColors = [
  ['Black', color(0, 0, 0)],
  ['Red', color(196, 43, 28)],
  ['Blue', color(0, 120, 212)],
] as const
const fallbackColors = [
  ['Green', color(16, 124, 16)],
  ['Yellow', color(255, 185, 0)],
] as const

function AcrylicScene(props: {
  readonly brush: AcrylicBrush | ReturnType<typeof theme.ref>
}) {
  return (
    <UI.Grid minWidth={320} height={200}>
      <UI.Rectangle
        width={100}
        height={200}
        horizontalAlignment={HorizontalAlignment.Left}
        verticalAlignment={VerticalAlignment.Top}
        fill={theme.systemAttention}
      />
      <UI.Ellipse
        width={152}
        height={152}
        horizontalAlignment={HorizontalAlignment.Center}
        verticalAlignment={VerticalAlignment.Center}
        fill={theme.accent}
      />
      <UI.Rectangle
        width={80}
        height={100}
        horizontalAlignment={HorizontalAlignment.Right}
        verticalAlignment={VerticalAlignment.Bottom}
        fill={theme.systemCaution}
      />
      <UI.Rectangle margin={thickness(12)} fill={props.brush} />
    </UI.Grid>
  )
}

export function AcrylicBrushPage(context: AppContext) {
  const fallback = signal(false)
  const nativeStatus = signal('Native fallback: off')
  const customBrush = new AcrylicBrush()
  customBrush.tintColor = tintColors[0]![1]
  customBrush.fallbackColor = fallbackColors[0]![1]
  customBrush.tintOpacity = 0.8
  const luminosityBrush = new AcrylicBrush()
  luminosityBrush.tintColor = color(135, 206, 235)
  luminosityBrush.fallbackColor = color(135, 206, 235)
  luminosityBrush.tintOpacity = 0.8
  luminosityBrush.tintLuminosityOpacity = 0.5
  const tintOpacity = signal(0.8)
  const luminosityTintOpacity = signal(0.8)
  const luminosityOpacity = signal(0.5)
  const tintIndex = signal(0)
  const fallbackIndex = signal(0)
  const tintSlider: RefObject<SliderInstance> = { current: null }
  const luminosityTintSlider: RefObject<SliderInstance> = { current: null }
  const luminositySlider: RefObject<SliderInstance> = { current: null }

  return (
    <Page
      title="AcrylicBrush"
      subtitle="A translucent material recommended for panel backgrounds."
      automationId="AcrylicBrushPageHeading"
      pageId="acrylic-brush"
      model={context.model}
    >
      <GuidanceText text="AcrylicBrush can fall back to SolidColorBrush in power-saving, transparency-disabled, or unsupported scenarios. In-app acrylic is separate from a window Desktop Acrylic backdrop." />

      <SampleCard
        automationId="GalleryStylesAcrylicSample"
        title="Default in-app acrylic brush"
        description="The built-in AcrylicInAppFillColorDefaultBrush layers acrylic over colorful content."
        code={`<UI.Rectangle fill={theme.ref('AcrylicInAppFillColorDefaultBrush')} />`}
      >
        <AcrylicScene
          brush={theme.ref('AcrylicInAppFillColorDefaultBrush')}
        />
      </SampleCard>

      <SampleCard
        automationId="GalleryStylesCustomAcrylicSample"
        title="Custom acrylic brush"
        description="Adjust tint opacity, tint color, fallback color, and force the solid fallback for adaptability testing."
        code={`
const brush = new AcrylicBrush()
brush.tintColor = color(0, 0, 0)
brush.fallbackColor = color(16, 124, 16)
brush.tintOpacity = .8
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryStylesAcrylicStatus"
              text={computed(() =>
                fallback.value
                  ? 'Solid fallback enabled.'
                  : 'Acrylic material enabled.',
              )}
            />
            <UI.TextBlock
              automationId="GalleryStylesAcrylicNativeStatus"
              text={nativeStatus}
            />
          </UI.StackPanel>
        }
        options={
          <UI.StackPanel spacing={8}>
            <UI.Slider
              ref={tintSlider}
              header="Tint opacity"
              minimum={0}
              maximum={1}
              stepFrequency={0.01}
              value={0.8}
              onValueChanged={() => {
                const next =
                  tintSlider.current?.value ?? tintOpacity.value
                tintOpacity.value = next
                customBrush.tintOpacity = next
                context.model.recordInteraction()
              }}
            />
            <GalleryComboBox
              header="Tint color"
              selectedIndex={tintIndex}
              onSelectedIndexChange={(index) => {
                tintIndex.value = index
                customBrush.tintColor =
                  tintColors[index]?.[1] ?? tintColors[0]![1]
              }}
            >
              {tintColors.map(([name]) => (
                <UI.TextBlock key={name} text={name} />
              ))}
            </GalleryComboBox>
            <GalleryComboBox
              header="Fallback color"
              selectedIndex={fallbackIndex}
              onSelectedIndexChange={(index) => {
                fallbackIndex.value = index
                customBrush.fallbackColor =
                  fallbackColors[index]?.[1] ?? fallbackColors[0]![1]
              }}
            >
              {fallbackColors.map(([name]) => (
                <UI.TextBlock key={name} text={name} />
              ))}
            </GalleryComboBox>
            <UI.Button
              automationId="GalleryStylesAcrylicToggle"
              onClick={() => {
                fallback.value = !fallback.value
                customBrush.alwaysUseFallback = fallback.value
                nativeStatus.value =
                  `Native fallback: ${customBrush.alwaysUseFallback ? 'on' : 'off'}`
                context.model.recordInteraction()
              }}
            >
              Toggle fallback
            </UI.Button>
          </UI.StackPanel>
        }
      >
        <AcrylicScene brush={customBrush} />
      </SampleCard>

      <SampleCard
        automationId="GalleryStylesAcrylicLuminositySample"
        title="Tint luminosity opacity"
        description="TintLuminosityOpacity controls how much luminosity from the acrylic effect contributes to the final material."
        code={`
brush.tintOpacity = tintOpacity
brush.tintLuminosityOpacity = luminosityOpacity
        `}
        output={
          <UI.TextBlock
            text={computed(
              () =>
                `Tint ${luminosityTintOpacity.value.toFixed(2)}; luminosity ${luminosityOpacity.value.toFixed(2)}`,
            )}
          />
        }
        options={
          <UI.StackPanel spacing={8}>
            <UI.Slider
              ref={luminosityTintSlider}
              header="Tint opacity"
              minimum={0}
              maximum={1}
              stepFrequency={0.01}
              value={0.8}
              onValueChanged={() => {
                const next =
                  luminosityTintSlider.current?.value ?? 0.8
                luminosityTintOpacity.value = next
                luminosityBrush.tintOpacity = next
              }}
            />
            <UI.Slider
              ref={luminositySlider}
              header="Tint luminosity opacity"
              minimum={0}
              maximum={1}
              stepFrequency={0.01}
              value={0.5}
              onValueChanged={() => {
                const next =
                  luminositySlider.current?.value ?? luminosityOpacity.value
                luminosityOpacity.value = next
                luminosityBrush.tintLuminosityOpacity = next
              }}
            />
          </UI.StackPanel>
        }
      >
        <AcrylicScene brush={luminosityBrush} />
      </SampleCard>
    </Page>
  )
}
