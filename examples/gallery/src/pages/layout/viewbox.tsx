import {
  computed,
  signal,
  styles,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  Orientation,
  Stretch,
  StretchDirection,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  type SliderInstance,
  UI,
} from '../../gallery-ui'
import { loadGalleryBitmap } from '../../gallery-assets'
import { Page, SampleCard } from '../../components/gallery-components'

const stretches = [
  { name: 'None', value: Stretch.None },
  { name: 'Fill', value: Stretch.Fill },
  { name: 'Uniform', value: Stretch.Uniform },
  { name: 'UniformToFill', value: Stretch.UniformToFill },
] as const

const directions = [
  { name: 'UpOnly', value: StretchDirection.UpOnly },
  { name: 'DownOnly', value: StretchDirection.DownOnly },
  { name: 'Both', value: StretchDirection.Both },
] as const

export function ViewboxPage(context: AppContext) {
  const width = signal(200)
  const height = signal(200)
  const stretchIndex = signal(2)
  const directionIndex = signal(2)
  const widthSlider: RefObject<SliderInstance> = { current: null }
  const heightSlider: RefObject<SliderInstance> = { current: null }

  return (
    <Page
      title="Viewbox"
      subtitle="Scales one child according to size, stretch, and direction."
      automationId="ViewboxPageHeading"
      pageId="viewbox"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryLayoutViewboxSample"
        title="Scale complex content inside a Viewbox"
        description="Resize the Viewbox and change how its child stretches up or down."
        code={`
<UI.Viewbox
  width={width}
  height={height}
  stretch={stretch}
  stretchDirection={stretchDirection}
>
  <ComplexContent />
</UI.Viewbox>
        `}
        options={
          <UI.StackPanel spacing={10}>
            <UI.Slider
              ref={widthSlider}
              automationId="GalleryViewboxWidth"
              header="Width"
              value={200}
              minimum={20}
              maximum={300}
              onValueChanged={() => {
                const next = widthSlider.current?.value
                if (next !== undefined && next !== width.value) {
                  width.value = next
                  context.model.recordInteraction()
                }
              }}
            />
            <UI.Slider
              ref={heightSlider}
              automationId="GalleryViewboxHeight"
              header="Height"
              value={200}
              minimum={20}
              maximum={300}
              onValueChanged={() => {
                const next = heightSlider.current?.value
                if (next !== undefined && next !== height.value) {
                  height.value = next
                  context.model.recordInteraction()
                }
              }}
            />
            <GalleryComboBox
              automationId="GalleryViewboxStretch"
              header={<UI.TextBlock text="Stretch" />}
              selectedIndex={stretchIndex}
              onSelectedIndexChange={(index) => {
                if (index !== stretchIndex.value) {
                  stretchIndex.value = index
                  context.model.recordInteraction()
                }
              }}
              width={180}
            >
              {stretches.map((item) => (
                <UI.TextBlock key={item.name} text={item.name} />
              ))}
            </GalleryComboBox>
            <GalleryComboBox
              automationId="GalleryViewboxStretchDirection"
              header={<UI.TextBlock text="StretchDirection" />}
              selectedIndex={directionIndex}
              onSelectedIndexChange={(index) => {
                if (index !== directionIndex.value) {
                  directionIndex.value = index
                  context.model.recordInteraction()
                }
              }}
              width={180}
            >
              {directions.map((item) => (
                <UI.TextBlock key={item.name} text={item.name} />
              ))}
            </GalleryComboBox>
          </UI.StackPanel>
        }
      >
        <UI.Viewbox
          automationId="GalleryViewboxControl"
          width={width}
          height={height}
          stretch={computed(
            () =>
              stretches[stretchIndex.value]?.value ??
              Stretch.Uniform,
          )}
          stretchDirection={computed(
            () =>
              directions[directionIndex.value]?.value ??
              StretchDirection.Both,
          )}
        >
          <UI.Border {...styles.card({ surface: 'layer' })}>
            <UI.StackPanel spacing={6}>
              <UI.StackPanel
                orientation={Orientation.Horizontal}
                spacing={4}
              >
                <UI.Border
                  {...styles.status({ tone: 'critical' })}
                  width={32}
                  height={32}
                />
                <UI.Border
                  {...styles.status({ tone: 'attention' })}
                  width={32}
                  height={32}
                />
                <UI.Border
                  {...styles.status({ tone: 'success' })}
                  width={32}
                  height={32}
                />
                <UI.Border
                  {...styles.status({ tone: 'caution' })}
                  width={32}
                  height={32}
                />
              </UI.StackPanel>
              <UI.Image
                width={160}
                height={80}
                source={loadGalleryBitmap(
                  'SampleMedia/Slices.png',
                  320,
                )}
                stretch={Stretch.Uniform}
              />
              <UI.TextBlock text="Viewbox content" />
            </UI.StackPanel>
          </UI.Border>
        </UI.Viewbox>
      </SampleCard>
    </Page>
  )
}
