import {
  createUri,
  signal,
} from 'dynwinrt-jsx'
import {
  RectangleGeometry,
  Symbol,
  Uri,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import { loadGalleryBitmap } from '../../gallery-assets'

declare const process: {
  cwd(): string
}

export function IconElementPage(context: AppContext) {
  const monochrome = signal(false)
  const slicesUri = createUri(
    Uri,
    encodeURI(
      `file:///${process.cwd().replaceAll('\\', '/')}/Assets/SampleMedia/Slices.png`,
    ),
  )
  const slicesImage = loadGalleryBitmap('SampleMedia/Slices.png', 256)
  const pathGeometry = new RectangleGeometry()
  pathGeometry.rect = { x: 1, y: 2, width: 19, height: 14 }

  return (
    <Page
      title="IconElement"
      subtitle="Represents icon controls that use different image types as their content."
      automationId="IconElementPageHeading"
      pageId="icon-element"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStylesIconElementSample"
        title="BitmapIcon"
        description="ShowAsMonochrome is true by default; turn it off to preserve a multicolor bitmap."
        code={`
<UI.BitmapIcon
  uriSource={slicesUri}
  showAsMonochrome={false}
/>
        `}
        options={
          <UI.CheckBox
            automationId="GalleryStylesBitmapIconMonochrome"
            isChecked={monochrome}
            onChecked={() => {
              monochrome.value = true
              context.model.recordInteraction()
            }}
            onUnchecked={() => {
              monochrome.value = false
            }}
          >
            Monochrome
          </UI.CheckBox>
        }
      >
        <UI.BitmapIcon
          automationId="GalleryStylesBitmapIcon"
          width={50}
          uriSource={slicesUri}
          showAsMonochrome={monochrome}
        />
      </SampleCard>

      <SampleCard
        automationId="GalleryStylesFontIconSample"
        title="FontIcon"
        description="FontIcon displays a glyph from an icon font."
        code={`<UI.FontIcon glyph={'\\uE790'} />`}
      >
        <UI.Button automationName="FontIcon example">
          <UI.FontIcon glyph={'\uE790'} fontSize={32} />
        </UI.Button>
      </SampleCard>

      <SampleCard
        automationId="GalleryStylesImageIconSample"
        title="ImageIcon"
        description="ImageIcon accepts the same projected image sources as Image."
        code={`<UI.ImageIcon source={slicesImage} />`}
      >
        <UI.Button automationName="ImageIcon example">
          <UI.ImageIcon
            width={50}
            source={slicesImage}
          />
        </UI.Button>
      </SampleCard>

      <SampleCard
        automationId="GalleryStylesPathIconSample"
        title="PathIcon"
        description="PathIcon renders connected line and curve geometry."
        code={`<UI.PathIcon data={pathGeometry} />`}
      >
        <UI.Button automationName="PathIcon example">
          <UI.PathIcon data={pathGeometry} />
        </UI.Button>
      </SampleCard>

      <SampleCard
        automationId="GalleryStylesSymbolIconSample"
        title="SymbolIcon"
        description="SymbolIcon selects a glyph by enum value."
        code={`<UI.SymbolIcon symbol={Symbol.Accept} />`}
      >
        <UI.Button automationName="Accept">
          <UI.StackPanel spacing={4}>
            <UI.SymbolIcon symbol={Symbol.Accept} />
            <UI.TextBlock text="Accept" />
          </UI.StackPanel>
        </UI.Button>
      </SampleCard>
    </Page>
  )
}
