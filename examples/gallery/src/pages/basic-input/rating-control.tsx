import {
  computed,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  type AppContext,
  type SliderInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function RatingControlPage(context: AppContext) {
  const placeholderSlider: RefObject<SliderInstance> = {
    current: null,
  }
  const rating = signal(0)
  const ratingChanged = signal(false)
  const clearEnabled = signal(false)
  const readOnly = signal(false)
  const placeholder = signal(2.5)

  return (
    <Page
      title="RatingControl"
      subtitle="Capture a star rating or show a configurable placeholder."
      automationId="RatingControlPageHeading"
      pageId="rating-control"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryBasicInputRatingControlSample"
        title="Rating and caption"
        description="ValueChanged updates the rating while clear and read-only behavior remain configurable."
        code={`
const rating = signal(3)
<UI.RatingControl
  value={rating}
  caption={computed(() => \`Your rating: \${rating.value}\`)}
  isClearEnabled={clearEnabled}
  isReadOnly={readOnly}
  onValueChanged={(sender) => rating.value = sender.value}
/>
        `}
      >
        <UI.StackPanel spacing={12}>
          <UI.RatingControl
            automationId="GalleryBasicInputRatingControlControl"
            automationName="Product rating"
            value={rating}
            caption={computed(() =>
              ratingChanged.value ? 'Your rating' : '312 ratings',
            )}
            isClearEnabled={clearEnabled}
            isReadOnly={readOnly}
            onValueChanged={(sender) => {
              if (sender.value !== rating.value) {
                rating.value = sender.value
                ratingChanged.value = true
                context.model.recordInteraction()
              }
            }}
          />
          <UI.TextBlock
            text={computed(() => `Value: ${rating.value}`)}
          />
          <UI.CheckBox
            isChecked={clearEnabled}
            onChecked={() => {
              clearEnabled.value = true
            }}
            onUnchecked={() => {
              clearEnabled.value = false
            }}
          >
            Allow clearing
          </UI.CheckBox>
          <UI.CheckBox
            isChecked={readOnly}
            onChecked={() => {
              readOnly.value = true
            }}
            onUnchecked={() => {
              readOnly.value = false
            }}
          >
            Read only
          </UI.CheckBox>
          <UI.TextBlock
            text={computed(() =>
              clearEnabled.value
                ? 'Swipe left or select the same rating again to clear it.'
                : 'Clearing the current rating is disabled.',
            )}
          />
        </UI.StackPanel>
      </SampleCard>
      <SampleCard
        title="Placeholder value"
        description="A Slider changes the preview rating shown before the user sets a value."
        code={`
<UI.RatingControl placeholderValue={placeholder} />
<UI.Slider value={placeholder} minimum={1} maximum={5} stepFrequency={0.5} />
        `}
      >
        <UI.StackPanel spacing={12}>
          <UI.RatingControl
            automationName="Rating with placeholder"
            placeholderValue={placeholder}
          />
          <UI.Slider
            automationId="GalleryBasicInputRatingPlaceholderSlider"
            ref={placeholderSlider}
            header="Placeholder value"
            value={placeholder}
            minimum={0}
            maximum={5}
            stepFrequency={0.5}
            onValueChanged={() => {
              const next = placeholderSlider.current?.value
              if (
                next !== undefined &&
                next !== placeholder.value
              ) {
                placeholder.value = next
                context.model.recordInteraction()
              }
            }}
          />
          <UI.TextBlock
            text={computed(
              () => `Placeholder: ${placeholder.value}`,
            )}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
