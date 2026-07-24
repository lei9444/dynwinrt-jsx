import {
  computed,
  cornerRadius,
  signal,
  styles,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import { Border } from '#winapp/bindings'
import {
  type AppContext,
  type SliderInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function GeometryPage(context: AppContext) {
  const radius = signal(8)
  const surface: RefObject<Border> = { current: null }
  const nativeRadius = signal(8)
  const slider: RefObject<SliderInstance> = { current: null }

  return (
    <Page
      title="Geometry"
      subtitle="Consistent corner geometry creates visual structure and hierarchy."
      automationId="GeometryPageHeading"
      pageId="geometry"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryDesignGeometrySample"
        title="Corner-radius scale"
        description="One signal updates native CornerRadius structs across several surfaces."
        code={`
<UI.Border cornerRadius={computed(() => cornerRadius(radius.value))} />
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryDesignGeometryStatus"
              text={computed(
                () => `Corner radius: ${Math.round(radius.value)}`,
              )}
            />
            <UI.TextBlock
              automationId="GalleryDesignGeometryNativeStatus"
              text={computed(
                () =>
                  `Native corner radius: ${Math.round(nativeRadius.value)}`,
              )}
            />
          </UI.StackPanel>
        }
        options={
          <UI.Slider
            ref={slider}
            automationId="GalleryDesignGeometryRadius"
            header="Corner radius"
            minimum={0}
            maximum={32}
            value={8}
            onValueChanged={() => {
              const next = slider.current?.value
              if (
                next !== undefined &&
                Number.isFinite(next) &&
                next !== radius.value
              ) {
                radius.value = next
                nativeRadius.value =
                  surface.current?.cornerRadius.topLeft ?? -1
                context.model.recordInteraction()
              }
            }}
          />
        }
      >
        <UI.StackPanel spacing={14}>
          {[120, 180, 240].map((width, index) => (
            <UI.Border
              key={width}
              {...styles.card({ surface: 'layer' })}
              {...(index === 0 ? { ref: surface } : {})}
              width={width}
              height={72}
              padding={thickness(16)}
              cornerRadius={computed(() =>
                cornerRadius(radius.value),
              )}
            >
              <UI.TextBlock text={`${width}px surface`} />
            </UI.Border>
          ))}
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
