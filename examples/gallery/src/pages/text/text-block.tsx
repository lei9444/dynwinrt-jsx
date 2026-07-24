import {
  computed,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  TextTrimming,
  TextWrapping,
} from '#winapp/bindings'
import {
  type AppContext,
  type SliderInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function TextBlockPage(context: AppContext) {
  const fontSize = signal(18)
  const slider: RefObject<SliderInstance> = { current: null }

  return (
    <Page
      title="TextBlock"
      subtitle="Displays lightweight text with wrapping, trimming, sizing, and selection."
      automationId="TextBlockPageHeading"
      pageId="text-block"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryTextBlockSample"
        title="Wrapped and selectable text"
        description="TextBlock properties can be driven directly by signals without remounting the native control."
        code={`
<UI.TextBlock
  fontSize={fontSize}
  textWrapping={TextWrapping.Wrap}
  textTrimming={TextTrimming.CharacterEllipsis}
  isTextSelectionEnabled
/>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryTextBlockStatus"
            text={computed(
              () => `Font size: ${Math.round(fontSize.value)}`,
            )}
          />
        }
        options={
          <UI.Slider
            ref={slider}
            automationId="GalleryTextBlockFontSize"
            header="Font size"
            minimum={12}
            maximum={36}
            value={18}
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
        }
      >
        <UI.TextBlock
          automationId="GalleryTextBlockControl"
          width={520}
          fontSize={fontSize}
          text="TextBlock is optimized for displaying lightweight text. It supports wrapping, trimming, selection, alignment, and theme-aware typography."
          textWrapping={TextWrapping.Wrap}
          textTrimming={TextTrimming.CharacterEllipsis}
          isTextSelectionEnabled
        />
      </SampleCard>
    </Page>
  )
}
