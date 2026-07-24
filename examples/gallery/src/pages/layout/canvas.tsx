import {
  computed,
  signal,
  styles,
  theme,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  type AppContext,
  type SliderInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function CanvasPage(context: AppContext) {
  const left = signal(20)
  const top = signal(20)
  const zIndex = signal(3)
  const leftSlider: RefObject<SliderInstance> = { current: null }
  const topSlider: RefObject<SliderInstance> = { current: null }
  const zSlider: RefObject<SliderInstance> = { current: null }

  return (
    <Page
      title="Canvas"
      subtitle="Absolute child positioning and z-order through attached properties."
      automationId="CanvasPageHeading"
      pageId="canvas"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryLayoutCanvasSample"
        title="Position children in a Canvas"
        description="Move the attention tile and change its z-order over three fixed siblings."
        code={`
<UI.Canvas width={140} height={140}>
  <UI.Border canvasLeft={left} canvasTop={top} canvasZIndex={zIndex} />
</UI.Canvas>
        `}
        options={
          <UI.StackPanel spacing={12}>
            <UI.Slider
              ref={leftSlider}
              automationId="GalleryCanvasLeft"
              header="Canvas.Left"
              value={20}
              minimum={0}
              maximum={100}
              onValueChanged={() => {
                const next = leftSlider.current?.value
                if (next !== undefined && next !== left.value) {
                  left.value = next
                  context.model.recordInteraction()
                }
              }}
            />
            <UI.Slider
              ref={topSlider}
              automationId="GalleryCanvasTop"
              header="Canvas.Top"
              value={20}
              minimum={0}
              maximum={100}
              onValueChanged={() => {
                const next = topSlider.current?.value
                if (next !== undefined && next !== top.value) {
                  top.value = next
                  context.model.recordInteraction()
                }
              }}
            />
            <UI.Slider
              ref={zSlider}
              automationId="GalleryCanvasZIndex"
              header="Canvas.ZIndex"
              value={3}
              minimum={0}
              maximum={4}
              stepFrequency={1}
              onValueChanged={() => {
                const next = zSlider.current?.value
                if (next !== undefined && next !== zIndex.value) {
                  zIndex.value = next
                  context.model.recordInteraction()
                }
              }}
            />
          </UI.StackPanel>
        }
      >
        <UI.Canvas
          automationId="GalleryCanvasControl"
          width={140}
          height={140}
          background={theme.ref('ControlFillColorSecondaryBrush')}
        >
          <UI.Border
            {...styles.status({ tone: 'critical' })}
            width={60}
            height={60}
            canvasLeft={left}
            canvasTop={top}
            canvasZIndex={computed(() => Math.round(zIndex.value))}
          />
          <UI.Border
            {...styles.status({ tone: 'attention' })}
            width={60}
            height={60}
            canvasLeft={70}
            canvasTop={10}
            canvasZIndex={1}
          />
          <UI.Border
            {...styles.status({ tone: 'success' })}
            width={60}
            height={60}
            canvasLeft={10}
            canvasTop={70}
            canvasZIndex={2}
          />
          <UI.Border
            {...styles.status({ tone: 'caution' })}
            width={60}
            height={60}
            canvasLeft={70}
            canvasTop={70}
            canvasZIndex={0}
          />
        </UI.Canvas>
      </SampleCard>
    </Page>
  )
}
