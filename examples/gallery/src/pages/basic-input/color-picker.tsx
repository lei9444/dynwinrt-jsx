import {
  color,
  computed,
  createSolidColorBrush,
  signal,
} from 'dynwinrt-jsx'
import {
  ColorSpectrumShape,
  SolidColorBrush,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function ColorPickerPage(context: AppContext) {
  const ringSpectrum = signal(false)
  const colorInputsVisible = signal(true)
  const alphaEnabled = signal(false)
  const selectedColor = color(0, 120, 212)
  const previewBrush = createSolidColorBrush(
    SolidColorBrush,
    selectedColor,
  )
  const colorText = signal('#FF0078D4')

  const channelHex = (value: number) =>
    Math.round(value).toString(16).padStart(2, '0').toUpperCase()

  return (
    <Page
      title="ColorPicker"
      subtitle="Choose a color and configure its spectrum and input channels."
      automationId="ColorPickerPageHeading"
      pageId="color-picker"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryBasicInputColorPickerSample"
        title="Color and display options"
        description="ColorChanged updates a live brush preview while signals configure the picker."
        code={`
const preview = createSolidColorBrush(SolidColorBrush, color(0, 120, 212))
<UI.ColorPicker
  colorSpectrumShape={computed(() => ringSpectrum.value
    ? ColorSpectrumShape.Ring
    : ColorSpectrumShape.Box)}
  isAlphaEnabled={alphaEnabled}
  onColorChanged={(sender) => preview.color = sender.color}
/>
        `}
      >
        <UI.StackPanel spacing={14}>
          <UI.ColorPicker
            automationId="GalleryBasicInputColorPickerControl"
            color={selectedColor}
            colorSpectrumShape={computed(() =>
              ringSpectrum.value
                ? ColorSpectrumShape.Ring
                : ColorSpectrumShape.Box,
            )}
            isColorSliderVisible={colorInputsVisible}
            isColorChannelTextInputVisible={colorInputsVisible}
            isAlphaEnabled={alphaEnabled}
            isAlphaSliderVisible={alphaEnabled}
            isAlphaTextInputVisible={alphaEnabled}
            onColorChanged={(sender) => {
              const next = sender.color
              previewBrush.color = next
              colorText.value = `#${channelHex(next.a)}${channelHex(next.r)}${channelHex(next.g)}${channelHex(next.b)}`
              context.model.recordInteraction()
            }}
          />
          <UI.Border
            width={180}
            height={72}
            background={previewBrush}
            automationName="Selected color preview"
          />
          <UI.TextBlock
            text={computed(() => `Selected color: ${colorText.value}`)}
          />
          <UI.TextBlock
            text={computed(() =>
              `Spectrum: ${ringSpectrum.value ? 'Ring' : 'Box'}`,
            )}
          />
          <UI.CheckBox
            automationId="GalleryBasicInputColorPickerRing"
            isChecked={ringSpectrum}
            onChecked={() => {
              ringSpectrum.value = true
            }}
            onUnchecked={() => {
              ringSpectrum.value = false
            }}
          >
            Ring spectrum
          </UI.CheckBox>
          <UI.CheckBox
            isChecked={colorInputsVisible}
            onChecked={() => {
              colorInputsVisible.value = true
            }}
            onUnchecked={() => {
              colorInputsVisible.value = false
            }}
          >
            Show color sliders and channel inputs
          </UI.CheckBox>
          <UI.CheckBox
            isChecked={alphaEnabled}
            onChecked={() => {
              alphaEnabled.value = true
            }}
            onUnchecked={() => {
              alphaEnabled.value = false
            }}
          >
            Enable alpha
          </UI.CheckBox>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
