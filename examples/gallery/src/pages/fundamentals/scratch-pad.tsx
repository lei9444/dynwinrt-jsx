import {
  computed,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  type AppContext,
  type SliderInstance,
  type TextBoxInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function ScratchPadPage(context: AppContext) {
  const text = signal('Hello from the TSX scratch pad')
  const fontSize = signal(24)
  const textBox: RefObject<TextBoxInstance> = { current: null }
  const slider: RefObject<SliderInstance> = { current: null }

  return (
    <Page
      title="Scratch Pad"
      subtitle="Experiments with simple native TSX properties and live signals."
      automationId="ScratchPadPageHeading"
      pageId="scratch-pad"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryScratchPadSample"
        title="Live text and font-size playground"
        description="The scratch pad updates a real TextBlock directly from input signals."
        code={`
<UI.TextBlock text={text} fontSize={fontSize} />
        `}
        options={
          <UI.StackPanel spacing={10}>
            <UI.TextBox
              ref={textBox}
              automationId="GalleryScratchPadText"
              header="Preview text"
              text={text}
              onTextChanged={() => {
                const next = textBox.current?.text ?? ''
                if (next !== text.value) {
                  text.value = next
                  context.model.recordInteraction()
                }
              }}
            />
            <UI.Slider
              ref={slider}
              automationId="GalleryScratchPadFontSize"
              header="Font size"
              minimum={12}
              maximum={48}
              value={fontSize}
              onValueChanged={() => {
                const next = slider.current?.value
                if (
                  next !== undefined &&
                  Number.isFinite(next) &&
                  next !== fontSize.value
                ) {
                  fontSize.value = next
                  context.model.recordInteraction()
                }
              }}
            />
          </UI.StackPanel>
        }
        output={
          <UI.TextBlock
            automationId="GalleryScratchPadStatus"
            text={computed(
              () => `Preview font size: ${Math.round(fontSize.value)}`,
            )}
          />
        }
      >
        <UI.TextBlock
          automationId="GalleryScratchPadPreview"
          text={text}
          fontSize={fontSize}
        />
      </SampleCard>
    </Page>
  )
}
