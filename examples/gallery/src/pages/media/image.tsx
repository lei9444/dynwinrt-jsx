import {
  Show,
  computed,
  onCleanup,
  signal,
  thickness,
} from 'dynwinrt-jsx'
import {
  BitmapImage,
  HorizontalAlignment,
  Stretch,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import {
  createGalleryAssetUri,
  loadGalleryBitmap,
  loadGallerySvg,
} from '../../gallery-assets'

const stretchModes = [
  ['None', Stretch.None],
  ['Fill', Stretch.Fill],
  ['Uniform', Stretch.Uniform],
  ['UniformToFill', Stretch.UniformToFill],
] as const

export function ImagePage(context: AppContext) {
  const basicImage = loadGalleryBitmap('SampleMedia/treetops.jpg', 800)
  const decodedImage = new BitmapImage(
    createGalleryAssetUri('SampleMedia/treetops.jpg'),
  )
  decodedImage.decodePixelHeight = 100
  const valleyImage = loadGalleryBitmap('SampleMedia/valley.jpg', 800)
  const nineGridImage = loadGalleryBitmap('SampleMedia/ninegrid.gif', 400)
  const svgImage = loadGallerySvg('SampleMedia/MirrorPCConsent.svg')
  const autoGif = new BitmapImage(
    createGalleryAssetUri('SampleMedia/animated.gif'),
  )
  const stoppedGif = new BitmapImage(
    createGalleryAssetUri('SampleMedia/animated.gif'),
  )
  stoppedGif.autoPlay = false
  const manualGif = new BitmapImage(
    createGalleryAssetUri('SampleMedia/animated.gif'),
  )
  manualGif.autoPlay = false
  const stretch = signal<Stretch>(Stretch.None)
  const manualReady = signal(false)
  const gifStatus = signal('Waiting for the animated GIF to decode.')
  const unsubscribeOpened = manualGif.onImageOpened(() => {
    manualReady.value = manualGif.isAnimatedBitmap
    gifStatus.value = manualGif.isAnimatedBitmap
      ? 'Animated GIF ready for manual playback.'
      : 'The selected image is not animated.'
  })
  onCleanup(() => {
    unsubscribeOpened()
    manualGif.stop()
  })

  return (
    <Page
      title="Image"
      subtitle="A control to display image content."
      automationId="ImagePageHeading"
      pageId="image"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryMediaImageLocalSample"
        title="Basic image from a local file"
        description="Image displays a local bitmap source."
        code={`<UI.Image height={100} source={treetops} />`}
      >
        <UI.Image height={100} source={basicImage} />
      </SampleCard>

      <SampleCard
        automationId="GalleryMediaImageDecodeSample"
        title="Decoded rendering size"
        description="DecodePixelHeight avoids decoding a larger bitmap than the rendered size requires."
        code={`const source = new BitmapImage(uri)
source.decodePixelHeight = 100
<UI.Image height={100} source={source} />`}
      >
        <UI.Image height={100} source={decodedImage} />
      </SampleCard>

      <SampleCard
        automationId="GalleryMediaImageStretchSample"
        title="Image stretching"
        description="Choose how the source is stretched into a fixed 100 by 100 destination."
        code={`<UI.Image
  width={100}
  height={100}
  source={valley}
  stretch={stretch}
/>`}
        output={
          <UI.TextBlock
            automationId="GalleryMediaImageStretchStatus"
            text={computed(() => `Stretch: ${
              stretchModes.find((item) => item[1] === stretch.value)?.[0]
                ?? 'None'
            }`)}
          />
        }
        options={
          <UI.StackPanel spacing={4}>
            {stretchModes.map(([name, value]) => (
              <UI.RadioButton
                key={name}
                automationId={`GalleryMediaImageStretch${name}`}
                groupName="GalleryMediaImageStretch"
                isChecked={computed(() => stretch.value === value)}
                onChecked={() => {
                  stretch.value = value
                  context.model.recordInteraction()
                }}
              >
                {name}
              </UI.RadioButton>
            ))}
          </UI.StackPanel>
        }
      >
        <UI.Image
          width={100}
          height={100}
          source={valleyImage}
          stretch={stretch}
        />
      </SampleCard>

      <SampleCard
        automationId="GalleryMediaImageNineGridSample"
        title="Nine-grid images"
        description="NineGrid preserves corners and edges while stretching the center regions."
        code={`<UI.Image
  height={164}
  nineGrid={thickness(30, 20, 30, 20)}
  source={nineGrid}
/>`}
      >
        <UI.StackPanel spacing={8}>
          <UI.TextBlock text="The normal image" />
          <UI.Image height={82} source={nineGridImage} />
          <UI.TextBlock text="Image stretched evenly" />
          <UI.Image
            height={164}
            nineGrid={thickness(3)}
            source={nineGridImage}
          />
          <UI.TextBlock text="Image stretched using nine grid" />
          <UI.Image
            height={164}
            nineGrid={thickness(30, 20, 30, 20)}
            source={nineGridImage}
          />
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GalleryMediaImageSvgSample"
        title="SVG image"
        description="SvgImageSource keeps vector artwork sharp at different display sizes."
        code={`const source = new SvgImageSource(svgUri)
<UI.Image height={100} source={source} />`}
      >
        <UI.Image height={100} source={svgImage} />
      </SampleCard>

      <SampleCard
        automationId="GalleryMediaImageGifSample"
        title="Animated GIF"
        description="Animated GIF sources can autoplay, remain stopped, or be controlled through BitmapImage.Play and Stop."
        code={`const source = new BitmapImage(gifUri)
source.autoPlay = false
source.play()
source.stop()`}
        output={
          <UI.TextBlock
            automationId="GalleryMediaImageGifStatus"
            text={gifStatus}
          />
        }
        options={
          <Show when={manualReady}>
            <UI.StackPanel spacing={8}>
              <UI.Button
                automationId="GalleryMediaImageGifPlay"
                onClick={() => {
                  manualGif.play()
                  gifStatus.value = 'Animated GIF playing.'
                  context.model.recordInteraction()
                }}
              >
                Play
              </UI.Button>
              <UI.Button
                automationId="GalleryMediaImageGifStop"
                onClick={() => {
                  manualGif.stop()
                  gifStatus.value = 'Animated GIF stopped.'
                  context.model.recordInteraction()
                }}
              >
                Stop
              </UI.Button>
            </UI.StackPanel>
          </Show>
        }
      >
        <UI.StackPanel spacing={12}>
          <UI.TextBlock text="An Image automatically plays an animated GIF." />
          <UI.Image
            height={40}
            horizontalAlignment={HorizontalAlignment.Left}
            source={autoGif}
          />
          <UI.TextBlock text="AutoPlay false keeps the GIF on its initial frame." />
          <UI.Image
            height={40}
            horizontalAlignment={HorizontalAlignment.Left}
            source={stoppedGif}
          />
          <UI.TextBlock text="Control playback manually with Play and Stop." />
          <UI.Image
            height={40}
            horizontalAlignment={HorizontalAlignment.Left}
            source={manualGif}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
