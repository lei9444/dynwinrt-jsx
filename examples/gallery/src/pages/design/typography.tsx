import {
  computed,
  signal,
  styles,
  type RefObject,
} from 'dynwinrt-jsx'
import { TextBlock } from '#winapp/bindings'
import {
  type AppContext,
  type SliderInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function TypographyPage(context: AppContext) {
  const bodySize = signal(16)
  const bodyText: RefObject<TextBlock> = { current: null }
  const nativeBodySize = signal(16)
  const slider: RefObject<SliderInstance> = { current: null }

  return (
    <Page
      title="Typography"
      subtitle="Type scale and weight guide attention through clear hierarchy."
      automationId="TypographyPageHeading"
      pageId="typography"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryDesignTypographySample"
        title="A native type hierarchy"
        description="Heading recipes and signal-backed font sizes produce native TextBlock properties."
        code={`
<UI.TextBlock {...styles.heading({ level: 'title' })} />
<UI.TextBlock fontSize={bodySize} />
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryDesignTypographyStatus"
              text={computed(
                () => `Body font size: ${Math.round(bodySize.value)}`,
              )}
            />
            <UI.TextBlock
              automationId="GalleryDesignTypographyNativeStatus"
              text={computed(
                () =>
                  `Native body font size: ${Math.round(nativeBodySize.value)}`,
              )}
            />
          </UI.StackPanel>
        }
        options={
          <UI.Slider
            ref={slider}
            automationId="GalleryDesignTypographySize"
            header="Body font size"
            minimum={12}
            maximum={28}
            value={16}
            onValueChanged={() => {
              const next = slider.current?.value
              if (
                next !== undefined &&
                Number.isFinite(next) &&
                next !== bodySize.value
              ) {
                bodySize.value = next
                nativeBodySize.value =
                  bodyText.current?.fontSize ?? -1
                context.model.recordInteraction()
              }
            }}
          />
        }
      >
        <UI.StackPanel spacing={10}>
          <UI.TextBlock
            {...styles.heading({ level: 'title' })}
            text="Title"
          />
          <UI.TextBlock
            {...styles.heading({ level: 'subtitle' })}
            text="Subtitle"
          />
          <UI.TextBlock
            ref={bodyText}
            fontSize={bodySize}
            text="Body text scales independently while preserving the native font family and theme."
          />
          <UI.TextBlock
            {...styles.heading({ level: 'bodyStrong' })}
            text="Body strong"
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
