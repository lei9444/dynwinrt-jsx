import {
  color,
  computed,
  createSolidColorBrush,
  signal,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  SolidColorBrush,
  TextWrapping,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  type SliderInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

const colorNames = ['Green', 'Yellow', 'Blue', 'White'] as const

export function BorderPage(context: AppContext) {
  const thicknessValue = signal(2)
  const backgroundIndex = signal(3)
  const borderIndex = signal(2)
  const thicknessSlider: RefObject<SliderInstance> = {
    current: null,
  }
  const brushes = [
    createSolidColorBrush(SolidColorBrush, color(16, 124, 16)),
    createSolidColorBrush(SolidColorBrush, color(255, 185, 0)),
    createSolidColorBrush(SolidColorBrush, color(0, 120, 212)),
    createSolidColorBrush(SolidColorBrush, color(255, 255, 255)),
  ] as const

  return (
    <Page
      title="Border"
      subtitle="A background and border around one child element."
      automationId="BorderPageHeading"
      pageId="border"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryLayoutBorderSample"
        title="A Border around a TextBlock"
        description="Adjust thickness, background, and border brush while the single child remains owned."
        code={`
<UI.Border
  borderThickness={thickness(borderThickness.value)}
  borderBrush={borderBrush}
  background={background}
>
  <UI.TextBlock text="Text inside a Border" />
</UI.Border>
        `}
        options={
          <UI.StackPanel spacing={12}>
            <UI.Slider
              ref={thicknessSlider}
              automationId="GalleryBorderThickness"
              header="BorderThickness"
              value={2}
              minimum={0}
              maximum={10}
              stepFrequency={1}
              onValueChanged={() => {
                const next = thicknessSlider.current?.value
                if (
                  next !== undefined &&
                  next !== thicknessValue.value
                ) {
                  thicknessValue.value = next
                  context.model.recordInteraction()
                }
              }}
            />
            <GalleryComboBox
              automationId="GalleryBorderBackground"
              header={<UI.TextBlock text="Background" />}
              selectedIndex={backgroundIndex}
              onSelectedIndexChange={(index) => {
                if (index !== backgroundIndex.value) {
                  backgroundIndex.value = index
                  context.model.recordInteraction()
                }
              }}
              width={180}
            >
              {colorNames.map((name) => (
                <UI.TextBlock key={name} text={name} />
              ))}
            </GalleryComboBox>
            <GalleryComboBox
              automationId="GalleryBorderBrush"
              header={<UI.TextBlock text="BorderBrush" />}
              selectedIndex={borderIndex}
              onSelectedIndexChange={(index) => {
                if (index !== borderIndex.value) {
                  borderIndex.value = index
                  context.model.recordInteraction()
                }
              }}
              width={180}
            >
              {colorNames.map((name) => (
                <UI.TextBlock key={name} text={name} />
              ))}
            </GalleryComboBox>
          </UI.StackPanel>
        }
      >
        <UI.Border
          automationId="GalleryBorderControl"
          minWidth={280}
          minHeight={120}
          padding={thickness(24)}
          borderThickness={computed(() =>
            thickness(thicknessValue.value),
          )}
          borderBrush={computed(
            () => brushes[borderIndex.value] ?? brushes[2],
          )}
          background={computed(
            () => brushes[backgroundIndex.value] ?? brushes[3],
          )}
        >
          <UI.TextBlock
            text="Text inside a Border"
            textWrapping={TextWrapping.Wrap}
          />
        </UI.Border>
      </SampleCard>
    </Page>
  )
}
