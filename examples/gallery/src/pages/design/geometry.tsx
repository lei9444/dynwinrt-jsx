import {
  cornerRadius,
  signal,
  theme,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  Clipboard,
  DataPackage,
  HorizontalAlignment,
  Orientation,
  ScrollBarVisibility,
  ScrollMode,
  TextWrapping,
  VerticalAlignment,
} from '#winapp/bindings'
import {
  type AppContext,
  type BorderInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import {
  GuidanceText,
} from '../fundamentals/shared'
import {
  DesignTableHeader,
  DesignTableRow,
  DesignTableScroller,
  DesignThemeImage,
} from './shared'

const tableWidths = [148, 400, 180, 56] as const

function copyResourceName(value: string): void {
  const data = new DataPackage()
  data.setText(value)
  Clipboard.setContent(data)
  Clipboard.flush()
}

export function GeometryPage(context: AppContext) {
  const selectedGeometry = signal(
    'Select a marker to inspect a corner-radius role.',
  )
  const nativeRadius = signal('Native corner radius: not inspected')
  const overlaySurface: RefObject<BorderInstance> = { current: null }
  const controlSurface: RefObject<BorderInstance> = { current: null }
  const straightSurface: RefObject<BorderInstance> = { current: null }
  const inspect = (
    label: string,
    target: RefObject<BorderInstance>,
  ) => {
    selectedGeometry.value = label
    nativeRadius.value =
      `Native corner radius: ${target.current?.cornerRadius.topLeft ?? -1}`
    context.model.recordInteraction()
  }

  return (
    <Page
      title="Geometry"
      subtitle="Clear geometric design ensures visual coherence and structure."
      automationId="GeometryPageHeading"
      pageId="geometry"
      model={context.model}
    >
      <GuidanceText text="Geometry describes the shape, size, and position of UI elements. WinUI uses three levels of rounding based on the component and how it meets neighboring elements." />
      <GuidanceText text="WinUI names these roles OverlayCornerRadius and ControlCornerRadius. The TSX sample applies their current 8px and 4px values explicitly because projected struct resources are not yet assignable to CornerRadius properties." />

      <SampleCard
        automationId="GalleryDesignGeometrySample"
        title="WinUI corner geometry"
        description="The original guidance illustration identifies overlay, control, and intersecting-edge geometry. Select a marker to inspect the matching native Border."
        code={`
<UI.Border
  cornerRadius={cornerRadius(4)}
/>
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryDesignGeometryStatus"
              text={selectedGeometry}
            />
            <UI.TextBlock
              automationId="GalleryDesignGeometryNativeStatus"
              text={nativeRadius}
            />
          </UI.StackPanel>
        }
      >
        <UI.StackPanel spacing={24}>
          <UI.ScrollViewer
            horizontalScrollBarVisibility={ScrollBarVisibility.Auto}
            horizontalScrollMode={ScrollMode.Auto}
          >
            <UI.Canvas width={505} height={271}>
              <DesignThemeImage
                lightPath="Design/Geometry.light.png"
                darkPath="Design/Geometry.dark.png"
                isDark={context.model.darkTheme}
                automationName="Examples of WinUI corner geometry"
                width={505}
                height={271}
              />
              <UI.Button
                automationId="GalleryDesignGeometryOverlay"
                automationName="Show 8px OverlayCornerRadius guidance"
                canvasLeft={16}
                canvasTop={16}
                padding={thickness(4)}
                toolTip="8px OverlayCornerRadius"
                onClick={() =>
                  inspect('8px · OverlayCornerRadius', overlaySurface)}
              >
                <UI.FontIcon glyph={'\uE946'} fontSize={16} />
              </UI.Button>
              <UI.Button
                automationId="GalleryDesignGeometryStraight"
                automationName="Show 0px straight-edge guidance"
                canvasLeft={16}
                canvasTop={148}
                padding={thickness(4)}
                toolTip="0px straight edge"
                onClick={() =>
                  inspect('0px · straight intersecting edges', straightSurface)}
              >
                <UI.FontIcon glyph={'\uE946'} fontSize={16} />
              </UI.Button>
              <UI.Button
                automationId="GalleryDesignGeometryControl"
                automationName="Show 4px ControlCornerRadius guidance"
                canvasLeft={240}
                canvasTop={168}
                padding={thickness(4)}
                toolTip="4px ControlCornerRadius"
                onClick={() =>
                  inspect('4px · ControlCornerRadius', controlSurface)}
              >
                <UI.FontIcon glyph={'\uE946'} fontSize={16} />
              </UI.Button>
            </UI.Canvas>
          </UI.ScrollViewer>

          <DesignTableScroller minWidth={850}>
            <DesignTableHeader
              columns={['Corner radius', 'Usage', 'Style', '']}
              widths={tableWidths}
            />
            <DesignTableRow
              automationId="GalleryDesignGeometryOverlayRow"
              widths={tableWidths}
              columns={[
                <UI.StackPanel
                  orientation={Orientation.Horizontal}
                  spacing={12}
                >
                  <UI.Border
                    ref={overlaySurface}
                    width={20}
                    height={20}
                    background={theme.accent}
                    cornerRadius={cornerRadius(8)}
                  />
                  <UI.TextBlock
                    verticalAlignment={VerticalAlignment.Center}
                    text="8px"
                  />
                </UI.StackPanel>,
                <UI.TextBlock
                  text="Top-level containers such as app windows, flyouts, cards, and dialogs."
                  textWrapping={TextWrapping.Wrap}
                />,
                <UI.TextBlock
                  text="OverlayCornerRadius"
                />,
                <UI.Button
                  automationId="GalleryDesignGeometryCopyOverlay"
                  automationName="Copy OverlayCornerRadius"
                  onClick={() => {
                    copyResourceName('OverlayCornerRadius')
                    context.model.recordInteraction()
                  }}
                >
                  <UI.FontIcon glyph={'\uE8C8'} />
                </UI.Button>,
              ]}
            />
            <DesignTableRow
              alternate
              automationId="GalleryDesignGeometryControlRow"
              widths={tableWidths}
              columns={[
                <UI.StackPanel
                  orientation={Orientation.Horizontal}
                  spacing={12}
                >
                  <UI.Border
                    ref={controlSurface}
                    width={20}
                    height={20}
                    background={theme.accent}
                    cornerRadius={cornerRadius(4)}
                  />
                  <UI.TextBlock
                    verticalAlignment={VerticalAlignment.Center}
                    text="4px"
                  />
                </UI.StackPanel>,
                <UI.TextBlock
                  text="In-page elements such as controls and list backplates."
                  textWrapping={TextWrapping.Wrap}
                />,
                <UI.TextBlock
                  text="ControlCornerRadius"
                />,
                <UI.Button
                  automationId="GalleryDesignGeometryCopyControl"
                  automationName="Copy ControlCornerRadius"
                  onClick={() => {
                    copyResourceName('ControlCornerRadius')
                    context.model.recordInteraction()
                  }}
                >
                  <UI.FontIcon glyph={'\uE8C8'} />
                </UI.Button>,
              ]}
            />
            <DesignTableRow
              automationId="GalleryDesignGeometryStraightRow"
              widths={tableWidths}
              columns={[
                <UI.StackPanel
                  orientation={Orientation.Horizontal}
                  spacing={12}
                >
                  <UI.Border
                    ref={straightSurface}
                    width={20}
                    height={20}
                    background={theme.accent}
                    cornerRadius={cornerRadius(0)}
                  />
                  <UI.TextBlock
                    verticalAlignment={VerticalAlignment.Center}
                    text="0px"
                  />
                </UI.StackPanel>,
                <UI.TextBlock
                  text="Straight edges that intersect with other straight edges."
                  textWrapping={TextWrapping.Wrap}
                />,
                <UI.TextBlock text="N/A" />,
                <UI.Border
                  horizontalAlignment={HorizontalAlignment.Center}
                />,
              ]}
            />
          </DesignTableScroller>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
