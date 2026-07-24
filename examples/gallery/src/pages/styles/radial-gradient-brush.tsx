import {
  color,
  computed,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  GradientStop,
  RadialGradientBrush,
} from '#winapp/bindings'
import {
  type AppContext,
  type SliderInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import { gradientStopCollection } from '../../gradient-stop-collection'

export function RadialGradientBrushPage(context: AppContext) {
  const radius = signal(0.5)
  const nativeRadius = signal(0.5)
  const slider: RefObject<SliderInstance> = { current: null }
  const brush = new RadialGradientBrush()
  const yellow = new GradientStop()
  yellow.color = color(255, 225, 0)
  yellow.offset = 0
  const blue = new GradientStop()
  blue.color = color(0, 90, 180)
  blue.offset = 1
  brush.center = { x: 0.25, y: 0.25 }
  brush.gradientOrigin = { x: 0.5, y: 0.25 }
  brush.radiusX = 0.5
  brush.radiusY = 0.5
  const stops = gradientStopCollection(brush.gradientStops)
  stops.append(yellow)
  stops.append(blue)

  return (
    <Page
      title="RadialGradientBrush"
      subtitle="Paints an area from a center point through radial color stops."
      automationId="RadialGradientBrushPageHeading"
      pageId="radial-gradient-brush"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStylesRadialGradientSample"
        title="Adjust the gradient radius"
        description="A projected GradientStop collection defines the native radial brush."
        code={`
const brush = new RadialGradientBrush()
const stops = gradientStopCollection(brush.gradientStops)
stops.append(yellow)
stops.append(blue)
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryStylesRadialGradientStatus"
              text={computed(
                () => `Gradient radius: ${radius.value.toFixed(2)}`,
              )}
            />
            <UI.TextBlock
              automationId="GalleryStylesRadialGradientNativeStatus"
              text={computed(
                () => `Native gradient radius: ${nativeRadius.value.toFixed(2)}`,
              )}
            />
          </UI.StackPanel>
        }
        options={
          <UI.Slider
            ref={slider}
            automationId="GalleryStylesRadialGradientRadius"
            header="Radius"
            minimum={0.1}
            maximum={1}
            stepFrequency={0.05}
            value={0.5}
            onValueChanged={() => {
              const next = slider.current?.value
              if (
                next !== undefined &&
                Number.isFinite(next) &&
                next !== radius.value
              ) {
                radius.value = next
                brush.radiusX = next
                brush.radiusY = next
                nativeRadius.value = brush.radiusX
                context.model.recordInteraction()
              }
            }}
          />
        }
      >
        <UI.Rectangle
          automationId="GalleryStylesRadialGradientControl"
          width={240}
          height={240}
          fill={brush}
        />
      </SampleCard>
    </Page>
  )
}
