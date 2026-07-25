import {
  color,
  computed,
  gridLength,
  signal,
  type RefObject,
  type Signal,
} from 'dynwinrt-jsx'
import {
  BrushMappingMode,
  GradientSpreadMethod,
  GradientStop,
  RadialGradientBrush,
} from '#winapp/bindings'
import {
  type AppContext,
  LayoutGrid,
  type SliderInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import { gradientStopCollection } from '../../gradient-stop-collection'

export function RadialGradientBrushPage(context: AppContext) {
  const mappingMode = signal<BrushMappingMode>(
    BrushMappingMode.RelativeToBoundingBox,
  )
  const spreadMethod = signal<GradientSpreadMethod>(
    GradientSpreadMethod.Pad,
  )
  const centerX = signal(0.25)
  const centerY = signal(0.25)
  const radiusX = signal(0.5)
  const radiusY = signal(0.5)
  const originX = signal(0.5)
  const originY = signal(0.25)
  const nativeStatus = signal('Native gradient configured.')
  const createBrush = () => {
    const brush = new RadialGradientBrush()
    const yellow = new GradientStop()
    yellow.color = color(255, 225, 0)
    yellow.offset = 0
    const blue = new GradientStop()
    blue.color = color(0, 90, 180)
    blue.offset = 1
    const stops = gradientStopCollection(brush.gradientStops)
    stops.append(yellow)
    stops.append(blue)
    brush.mappingMode = mappingMode.peek()
    brush.spreadMethod = spreadMethod.peek()
    brush.center = { x: centerX.peek(), y: centerY.peek() }
    brush.radiusX = radiusX.peek()
    brush.radiusY = radiusY.peek()
    brush.gradientOrigin = {
      x: originX.peek(),
      y: originY.peek(),
    }
    return brush
  }
  const previewRevision = signal(0)
  const preview = computed(() => {
    previewRevision.value
    return (
      <UI.Rectangle
        automationId="GalleryStylesRadialGradientControl"
        width={240}
        height={240}
        fill={createBrush()}
      />
    )
  })
  const sliders = Array.from(
    { length: 6 },
    (): RefObject<SliderInstance> => ({ current: null }),
  )
  const sliderConfigs: readonly {
    readonly header: string
    readonly target: Signal<number>
    readonly initial: number
    readonly automationId?: string
  }[] = [
    { header: 'Center.X', target: centerX, initial: 0.25 },
    { header: 'Center.Y', target: centerY, initial: 0.25 },
    {
      header: 'RadiusX',
      target: radiusX,
      initial: 0.5,
      automationId: 'GalleryStylesRadialGradientRadius',
    },
    { header: 'RadiusY', target: radiusY, initial: 0.5 },
    { header: 'GradientOrigin.X', target: originX, initial: 0.5 },
    { header: 'GradientOrigin.Y', target: originY, initial: 0.25 },
  ]
  const syncSliderValues = () => {
    for (const [index, config] of sliderConfigs.entries()) {
      const current = sliders[index]?.current
      if (current) {
        current.value = config.target.value
      }
    }
  }
  const apply = () => {
    previewRevision.value += 1
    nativeStatus.value =
      `Native center ${centerX.peek().toFixed(2)},${centerY.peek().toFixed(2)}; radius ${radiusX.peek().toFixed(2)},${radiusY.peek().toFixed(2)}`
  }
  const updateSlider = (
    index: number,
    target: Signal<number>,
  ) => {
    target.value = sliders[index]?.current?.value ?? target.value
    context.model.recordInteraction()
  }

  return (
    <Page
      title="RadialGradientBrush"
      subtitle="A brush to show radial gradients."
      automationId="RadialGradientBrushPageHeading"
      pageId="radial-gradient-brush"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStylesRadialGradientSample"
        title="Configure a radial gradient"
        description="MappingMode, SpreadMethod, center, radius, gradient origin, and GradientStops update the same native brush."
        code={`
brush.mappingMode = BrushMappingMode.RelativeToBoundingBox
brush.center = { x: .25, y: .25 }
brush.gradientOrigin = { x: .5, y: .25 }
brush.radiusX = .5
brush.radiusY = .5
        `}
        output={
          <UI.TextBlock
            automationId="GalleryStylesRadialGradientNativeStatus"
            text={nativeStatus}
          />
        }
        options={
          <UI.StackPanel spacing={8}>
            <UI.TextBlock text="MappingMode" />
            <UI.StackPanel spacing={4}>
              <UI.Button
                onClick={() => {
                  mappingMode.value =
                    BrushMappingMode.RelativeToBoundingBox
                  centerX.value = 0.25
                  centerY.value = 0.25
                  radiusX.value = 0.5
                  radiusY.value = 0.5
                  originX.value = 0.5
                  originY.value = 0.25
                  syncSliderValues()
                  context.model.recordInteraction()
                }}
              >
                RelativeToBoundingBox
              </UI.Button>
              <UI.Button
                onClick={() => {
                  mappingMode.value = BrushMappingMode.Absolute
                  centerX.value = 50
                  centerY.value = 50
                  radiusX.value = 100
                  radiusY.value = 100
                  originX.value = 100
                  originY.value = 50
                  syncSliderValues()
                  context.model.recordInteraction()
                }}
              >
                Absolute
              </UI.Button>
            </UI.StackPanel>
            <LayoutGrid
              columnDefinitions={[
                gridLength.star(),
                gridLength.star(),
              ]}
              columnSpacing={8}
            >
              {sliderConfigs.map((config, index) => (
                <UI.Slider
                  key={config.header}
                  ref={sliders[index]!}
                  {...(config.automationId
                    ? { automationId: config.automationId }
                    : {})}
                  gridRow={Math.floor(index / 2)}
                  gridColumn={index % 2}
                  header={config.header}
                  minimum={0}
                  maximum={computed(() =>
                    mappingMode.value === BrushMappingMode.Absolute
                      ? 200
                      : 1,
                  )}
                  stepFrequency={computed(() =>
                    mappingMode.value === BrushMappingMode.Absolute
                      ? 1
                      : 0.05,
                  )}
                  value={config.initial}
                  onValueChanged={() =>
                    updateSlider(index, config.target)}
                />
              ))}
            </LayoutGrid>
            <UI.Button
              automationId="GalleryStylesRadialGradientApply"
              onClick={() => {
                apply()
                context.model.recordInteraction()
              }}
            >
              Apply gradient settings
            </UI.Button>
            <UI.TextBlock text="SpreadMethod" />
            <UI.StackPanel spacing={4}>
              {([
                ['Pad', GradientSpreadMethod.Pad],
                ['Reflect', GradientSpreadMethod.Reflect],
                ['Repeat', GradientSpreadMethod.Repeat],
              ] as const).map(([label, value]) => (
                <UI.Button
                  key={label}
                  onClick={() => {
                    spreadMethod.value = value
                    context.model.recordInteraction()
                  }}
                >
                  {label}
                </UI.Button>
              ))}
            </UI.StackPanel>
          </UI.StackPanel>
        }
      >
        <UI.StackPanel spacing={8}>
          {preview}
          <UI.Button
            automationId="GalleryStylesRadialGradientRadiusPreset"
            onClick={() => {
              radiusX.value = 0.8
              radiusY.value = 0.8
              syncSliderValues()
              apply()
              context.model.recordInteraction()
            }}
          >
            Set radius to 0.8
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
