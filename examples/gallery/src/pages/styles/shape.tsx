import {
  color,
  computed,
  createSolidColorBrush,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  Ellipse,
  PointCollection,
  Rectangle,
  SolidColorBrush,
  Visibility,
} from '#winapp/bindings'
import {
  type AppContext,
  type SliderInstance,
  type ToggleInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function ShapePage(context: AppContext) {
  const fill = createSolidColorBrush(
    SolidColorBrush,
    color(70, 130, 180),
  )
  const stroke = createSolidColorBrush(
    SolidColorBrush,
    color(0, 0, 0),
  )
  const ellipseHeight = signal(120)
  const ellipseWidth = signal(120)
  const ellipseStroke = signal(4)
  const rectangleHeight = signal(120)
  const rectangleWidth = signal(140)
  const rectangleStroke = signal(4)
  const radiusX = signal(8)
  const radiusY = signal(8)
  const polygonStroke = signal(4)
  const showPoints = signal(false)
  const ellipseNativeStatus = signal('Native ellipse not measured.')
  const ellipse: RefObject<Ellipse> = { current: null }
  const rectangle: RefObject<Rectangle> = { current: null }
  const ellipseHeightSlider: RefObject<SliderInstance> = { current: null }
  const ellipseWidthSlider: RefObject<SliderInstance> = { current: null }
  const ellipseStrokeSlider: RefObject<SliderInstance> = { current: null }
  const rectangleHeightSlider: RefObject<SliderInstance> = { current: null }
  const rectangleWidthSlider: RefObject<SliderInstance> = { current: null }
  const rectangleStrokeSlider: RefObject<SliderInstance> = { current: null }
  const radiusXSlider: RefObject<SliderInstance> = { current: null }
  const radiusYSlider: RefObject<SliderInstance> = { current: null }
  const polygonStrokeSlider: RefObject<SliderInstance> = { current: null }
  const pointsToggle: RefObject<ToggleInstance> = { current: null }
  const polygonPoints = new PointCollection()
  for (const point of [
    { x: 10, y: 100 },
    { x: 60, y: 40 },
    { x: 200, y: 40 },
    { x: 250, y: 100 },
  ]) {
    polygonPoints.append(point)
  }
  const refreshEllipseStatus = () => {
    const current = ellipse.current
    if (!current) {
      return
    }
    ellipseNativeStatus.value =
      `Native ellipse: ${Math.round(current.actualWidth)} × ${Math.round(current.actualHeight)}; stroke ${current.strokeThickness}`
  }

  return (
    <Page
      title="Shape"
      subtitle="How to draw shapes, such as ellipses, rectangles, and polygons."
      automationId="ShapePageHeading"
      pageId="shape"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStylesShapeSample"
        title="Ellipse"
        description="Adjust the native height, width, and stroke thickness."
        code={`
<UI.Ellipse
  width={width}
  height={height}
  fill={fill}
  stroke={stroke}
  strokeThickness={strokeThickness}
/>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryStylesEllipseNativeStatus"
            text={ellipseNativeStatus}
          />
        }
        options={
          <UI.StackPanel width={220}>
            <UI.Slider
              ref={ellipseHeightSlider}
              header="Height"
              minimum={100}
              maximum={150}
              value={120}
              onValueChanged={() => {
                ellipseHeight.value =
                  ellipseHeightSlider.current?.value ?? ellipseHeight.value
                if (ellipse.current) {
                  ellipse.current.height = ellipseHeight.value
                }
                context.model.recordInteraction()
              }}
            />
            <UI.Slider
              ref={ellipseWidthSlider}
              header="Width"
              minimum={100}
              maximum={150}
              value={120}
              onValueChanged={() => {
                ellipseWidth.value =
                  ellipseWidthSlider.current?.value ?? ellipseWidth.value
                if (ellipse.current) {
                  ellipse.current.width = ellipseWidth.value
                }
              }}
            />
            <UI.Slider
              ref={ellipseStrokeSlider}
              header="Stroke Thickness"
              minimum={2}
              maximum={10}
              value={4}
              onValueChanged={() => {
                ellipseStroke.value =
                  ellipseStrokeSlider.current?.value ?? ellipseStroke.value
                if (ellipse.current) {
                  ellipse.current.strokeThickness = ellipseStroke.value
                  refreshEllipseStatus()
                }
              }}
            />
          </UI.StackPanel>
        }
      >
        <UI.Ellipse
          ref={ellipse}
          automationId="GalleryStylesEllipse"
          width={ellipseWidth}
          height={ellipseHeight}
          fill={fill}
          stroke={stroke}
          strokeThickness={ellipseStroke}
          onLoaded={refreshEllipseStatus}
          onSizeChanged={refreshEllipseStatus}
        />
      </SampleCard>

      <SampleCard
        automationId="GalleryStylesRectangleSample"
        title="Rectangle"
        description="Rectangle adds independent RadiusX and RadiusY values to the same shape properties."
        code={`
<UI.Rectangle
  radiusX={radiusX}
  radiusY={radiusY}
/>
        `}
        options={
          <UI.StackPanel width={220}>
            <UI.Slider
              ref={rectangleHeightSlider}
              header="Height"
              minimum={100}
              maximum={150}
              value={120}
              onValueChanged={() => {
                rectangleHeight.value =
                  rectangleHeightSlider.current?.value ?? rectangleHeight.value
              }}
            />
            <UI.Slider
              ref={rectangleWidthSlider}
              header="Width"
              minimum={100}
              maximum={150}
              value={140}
              onValueChanged={() => {
                rectangleWidth.value =
                  rectangleWidthSlider.current?.value ?? rectangleWidth.value
              }}
            />
            <UI.Slider
              ref={rectangleStrokeSlider}
              header="Stroke Thickness"
              minimum={2}
              maximum={10}
              value={4}
              onValueChanged={() => {
                rectangleStroke.value =
                  rectangleStrokeSlider.current?.value ?? rectangleStroke.value
              }}
            />
            <UI.Slider
              ref={radiusYSlider}
              header="Radius Y"
              minimum={0}
              maximum={100}
              value={8}
              onValueChanged={() => {
                radiusY.value =
                  radiusYSlider.current?.value ?? radiusY.value
              }}
            />
            <UI.Slider
              ref={radiusXSlider}
              header="Radius X"
              minimum={0}
              maximum={100}
              value={8}
              onValueChanged={() => {
                radiusX.value =
                  radiusXSlider.current?.value ?? radiusX.value
              }}
            />
          </UI.StackPanel>
        }
      >
        <UI.Rectangle
          ref={rectangle}
          automationId="GalleryStylesRectangle"
          width={rectangleWidth}
          height={rectangleHeight}
          fill={fill}
          stroke={stroke}
          strokeThickness={rectangleStroke}
          radiusX={radiusX}
          radiusY={radiusY}
        />
      </SampleCard>

      <SampleCard
        automationId="GalleryStylesPolygonSample"
        title="Polygon"
        description="A Polygon closes a mutable native PointCollection into one filled shape."
        code={`
const points = new PointCollection()
points.replaceAll([
  { x: 10, y: 100 },
  { x: 60, y: 40 },
  { x: 200, y: 40 },
  { x: 250, y: 100 },
])
<UI.Polygon points={points} />
        `}
        options={
          <UI.StackPanel width={220}>
            <UI.ToggleSwitch
              ref={pointsToggle}
              header="Show points"
              onToggled={() => {
                showPoints.value =
                  pointsToggle.current?.isOn ?? showPoints.value
              }}
            />
            <UI.Slider
              ref={polygonStrokeSlider}
              header="Stroke Thickness"
              minimum={2}
              maximum={10}
              value={4}
              onValueChanged={() => {
                polygonStroke.value =
                  polygonStrokeSlider.current?.value ?? polygonStroke.value
              }}
            />
          </UI.StackPanel>
        }
      >
        <UI.Canvas width={320} height={200}>
          <UI.TextBlock
            text="A polygon is a connected series of lines that form a closed shape."
          />
          <UI.Polygon
            canvasTop={24}
            points={polygonPoints}
            fill={fill}
            stroke={stroke}
            strokeThickness={polygonStroke}
          />
          {[
            ['Point #1: (10,100)', 0, 150],
            ['Point #2: (60,40)', 50, 40],
            ['Point #3: (200,40)', 200, 40],
            ['Point #4: (250,100)', 240, 150],
          ].map(([label, left, top]) => (
            <UI.TextBlock
              key={String(label)}
              canvasLeft={Number(left)}
              canvasTop={Number(top)}
              text={String(label)}
              visibility={computed(() =>
                showPoints.value
                  ? Visibility.Visible
                  : Visibility.Collapsed,
              )}
            />
          ))}
        </UI.Canvas>
      </SampleCard>
    </Page>
  )
}
