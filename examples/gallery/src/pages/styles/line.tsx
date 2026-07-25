import {
  color,
  createSolidColorBrush,
  signal,
  type RefObject,
  type Signal,
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
import { NativeXamlPreview } from '../fundamentals/shared'

export function LinePage(context: AppContext) {
  const stroke = createSolidColorBrush(
    SolidColorBrush,
    color(70, 130, 180),
  )
  const x1 = signal(10)
  const y1 = signal(100)
  const x2 = signal(250)
  const y2 = signal(20)
  const lineStroke = signal(5)
  const nativeLineStatus = signal('Native line not measured.')
  const line: RefObject<Line> = { current: null }
  const sliders = Array.from(
    { length: 5 },
    (): RefObject<SliderInstance> => ({ current: null }),
  )
  const lineSliderConfigs: readonly {
    readonly header: string
    readonly target: Signal<number>
    readonly minimum: number
    readonly maximum: number
    readonly value: number
    readonly automationId?: string
  }[] = [
    { header: 'Start point X', target: x1, minimum: 0, maximum: 100, value: 10 },
    { header: 'Start point Y', target: y1, minimum: 0, maximum: 100, value: 100 },
    { header: 'End point X', target: x2, minimum: 200, maximum: 300, value: 250 },
    { header: 'End point Y', target: y2, minimum: 0, maximum: 100, value: 20 },
    {
      header: 'Stroke Thickness',
      target: lineStroke,
      minimum: 5,
      maximum: 10,
      value: 5,
      automationId: 'GalleryStylesLineThickness',
    },
  ]
  const refreshLineStatus = () => {
    const current = line.current
    if (!current) {
      return
    }
    nativeLineStatus.value =
      `Native line: (${current.x1},${current.y1}) to (${current.x2},${current.y2}); stroke ${current.strokeThickness}`
  }
  return (
    <Page
      title="Line"
      subtitle="Draws Line, Polyline, Path, and composite geometry."
      automationId="LinePageHeading"
      pageId="line"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStylesLineSample"
        title="Line"
        description="Adjust both endpoints and native stroke thickness."
        code={`<UI.Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={brush} />`}
        output={
          <UI.TextBlock
            automationId="GalleryStylesLineNativeStatus"
            text={nativeLineStatus}
          />
        }
        options={
          <UI.StackPanel width={220}>
            {lineSliderConfigs.map((config, index) => (
              <UI.Slider
                key={config.header}
                ref={sliders[index]!}
                {...(config.automationId
                  ? { automationId: config.automationId }
                  : {})}
                header={config.header}
                minimum={config.minimum}
                maximum={config.maximum}
                value={config.value}
                onValueChanged={() => {
                  config.target.value =
                    sliders[index]?.current?.value ?? config.target.value
                  if (line.current) {
                    if (index === 0) line.current.x1 = config.target.value
                    if (index === 1) line.current.y1 = config.target.value
                    if (index === 2) line.current.x2 = config.target.value
                    if (index === 3) line.current.y2 = config.target.value
                    if (index === 4) {
                      line.current.strokeThickness = config.target.value
                    }
                    refreshLineStatus()
                  }
                  context.model.recordInteraction()
                }}
              />
            ))}
            <UI.Button
              automationId="GalleryStylesLineThicknessPreset"
              onClick={() => {
                lineStroke.value = 8
                if (sliders[4]?.current) {
                  sliders[4].current.value = 8
                }
                if (line.current) {
                  line.current.strokeThickness = 8
                  refreshLineStatus()
                }
                context.model.recordInteraction()
              }}
            >
              Set stroke thickness to 8
            </UI.Button>
          </UI.StackPanel>
        }
      >
        <UI.Canvas width={320} height={200}>
          <UI.Line
            ref={line}
            automationId="GalleryStylesLineControl"
            canvasTop={50}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={stroke}
            strokeThickness={lineStroke}
            onLoaded={() => {
              refreshLineStatus()
            }}
          />
        </UI.Canvas>
      </SampleCard>

      <SampleCard
        automationId="GalleryStylesPolylineSample"
        title="Polyline"
        description="The native Polyline closes no area and renders an open PointCollection with joined segments."
        code={`<NativeXamlPreview xaml={polylineXaml} />`}
      >
        <NativeXamlPreview
          automationId="GalleryStylesNativePolyline"
          xaml={`
<Canvas
  xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  Width="320" Height="170">
  <TextBlock Text="Draws a series of connected straight lines." />
  <Polyline
    Canvas.Top="24"
    Points="10,100 60,40 200,40 250,100"
    Stroke="Black"
    StrokeThickness="4" />
</Canvas>
          `}
        />
      </SampleCard>

      <SampleCard
        automationId="GalleryStylesGeometryGroupSample"
        title="Path with GeometryGroup"
        description="A native Path fills and strokes a composite GeometryGroup containing line, ellipse, and rectangle geometry."
        code={`<NativeXamlPreview xaml={geometryGroupXaml} />`}
      >
        <NativeXamlPreview
          automationId="GalleryStylesNativeGeometryGroup"
          xaml={`
<Canvas
  xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  Width="320" Height="170">
  <TextBlock Text="Composite GeometryGroup" />
  <Path
    Canvas.Top="32"
    Fill="#CCCCFF"
    Stroke="Black"
    StrokeThickness="4">
    <Path.Data>
      <GeometryGroup FillRule="EvenOdd">
        <LineGeometry StartPoint="10,10" EndPoint="50,30" />
        <EllipseGeometry Center="80,70" RadiusX="35" RadiusY="40" />
        <RectangleGeometry Rect="70,55,100,30" />
      </GeometryGroup>
    </Path.Data>
  </Path>
</Canvas>
          `}
        />
      </SampleCard>
    </Page>
  )
}
