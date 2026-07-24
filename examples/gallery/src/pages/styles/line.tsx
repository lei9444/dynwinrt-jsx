import {
  color,
  computed,
  createSolidColorBrush,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  Line,
  SolidColorBrush,
} from '#winapp/bindings'
import {
  type AppContext,
  type SliderInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function LinePage(context: AppContext) {
  const strokeWidth = signal(4)
  const line: RefObject<Line> = { current: null }
  const nativeStrokeWidth = signal(4)
  const slider: RefObject<SliderInstance> = { current: null }
  const stroke = createSolidColorBrush(
    SolidColorBrush,
    color(0, 120, 212),
  )

  return (
    <Page
      title="Line"
      subtitle="Draws a native straight line between two points."
      automationId="LinePageHeading"
      pageId="line"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStylesLineSample"
        title="Adjustable line stroke"
        description="Line coordinates and stroke thickness are ordinary native properties."
        code={`<UI.Line x1={0} y1={0} x2={320} y2={100} stroke={brush} />`}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryStylesLineStatus"
              text={computed(
                () => `Stroke thickness: ${Math.round(strokeWidth.value)}`,
              )}
            />
            <UI.TextBlock
              automationId="GalleryStylesLineNativeStatus"
              text={computed(
                () => `Native stroke thickness: ${Math.round(nativeStrokeWidth.value)}`,
              )}
            />
          </UI.StackPanel>
        }
        options={
          <UI.Slider
            ref={slider}
            automationId="GalleryStylesLineThickness"
            header="Stroke thickness"
            minimum={1}
            maximum={16}
            value={4}
            onValueChanged={() => {
              const next = slider.current?.value
              if (
                next !== undefined &&
                Number.isFinite(next) &&
                next !== strokeWidth.value
              ) {
                strokeWidth.value = next
                nativeStrokeWidth.value =
                  line.current?.strokeThickness ?? -1
                context.model.recordInteraction()
              }
            }}
          />
        }
      >
        <UI.Line
          ref={line}
          automationId="GalleryStylesLineControl"
          width={360}
          height={120}
          x1={10}
          y1={100}
          x2={350}
          y2={20}
          stroke={stroke}
          strokeThickness={strokeWidth}
        />
      </SampleCard>
    </Page>
  )
}
