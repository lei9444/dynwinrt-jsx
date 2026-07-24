import {
  computed,
  signal,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  ScrollingContentOrientation,
  ScrollingScrollBarVisibility,
  ScrollingScrollMode,
  ScrollingZoomMode,
  ScrollView,
  Stretch,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { loadGalleryBitmap } from '../../gallery-assets'
import { Page, SampleCard } from '../../components/gallery-components'

export function ScrollViewPage(context: AppContext) {
  const scrollView: RefObject<ScrollView> = { current: null }
  const status = signal('Ready.')
  const verticalOffset = signal(0)
  const zoomFactor = signal(1)
  const image = loadGalleryBitmap(
    'SampleMedia/cliff.jpg',
    1000,
  )
  const requireView = () => {
    const current = scrollView.current
    if (!current) {
      throw new Error('ScrollView is not mounted.')
    }
    return current
  }

  return (
    <Page
      title="ScrollView"
      subtitle="Provides modern scrolling, panning, zooming, and programmatic view changes."
      automationId="ScrollViewPageHeading"
      pageId="scroll-view"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryScrollViewSample"
        title="Pan and zoom large content"
        description="ScrollView exposes offsets, completion events, and direct ScrollBy and ZoomTo methods."
        code={`
<UI.ScrollView
  ref={scrollView}
  contentOrientation={ScrollingContentOrientation.Both}
  zoomMode={ScrollingZoomMode.Enabled}
  onScrollCompleted={(sender) => {
    status.value = \`Scroll completed at \${sender.verticalOffset}.\`
  }}
>
  <LargeImage />
</UI.ScrollView>
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryScrollViewStatus"
              text={status}
            />
            <UI.TextBlock
              text={computed(
                () =>
                  `Offset: ${Math.round(verticalOffset.value)}; zoom: ${zoomFactor.value.toFixed(1)}`,
              )}
            />
          </UI.StackPanel>
        }
        options={
          <UI.StackPanel spacing={10}>
            <UI.Button
              automationId="GalleryScrollViewDown"
              onClick={() => {
                requireView().scrollBy(0, 180)
                context.model.recordInteraction()
              }}
            >
              Scroll down
            </UI.Button>
            <UI.Button
              automationId="GalleryScrollViewZoom"
              onClick={() => {
                const current = requireView()
                current.zoomTo(
                  current.zoomFactor > 1.1 ? 1 : 1.6,
                  null,
                )
                context.model.recordInteraction()
              }}
            >
              Toggle zoom
            </UI.Button>
          </UI.StackPanel>
        }
      >
        <UI.ScrollView
          ref={scrollView}
          automationId="GalleryScrollViewControl"
          width={500}
          height={300}
          contentOrientation={ScrollingContentOrientation.Both}
          horizontalScrollMode={ScrollingScrollMode.Auto}
          verticalScrollMode={ScrollingScrollMode.Auto}
          horizontalScrollBarVisibility={
            ScrollingScrollBarVisibility.Auto
          }
          verticalScrollBarVisibility={
            ScrollingScrollBarVisibility.Auto
          }
          zoomMode={ScrollingZoomMode.Enabled}
          minZoomFactor={0.5}
          maxZoomFactor={3}
          onViewChanged={(sender) => {
            verticalOffset.value = sender.verticalOffset
            zoomFactor.value = sender.zoomFactor
          }}
          onScrollCompleted={(sender) => {
            status.value =
              `Scroll completed at ${Math.round(sender.verticalOffset)}.`
          }}
          onZoomCompleted={(sender) => {
            status.value =
              `Zoom completed at ${sender.zoomFactor.toFixed(1)}.`
          }}
        >
          <UI.Image
            source={image}
            width={900}
            height={600}
            stretch={Stretch.UniformToFill}
          />
        </UI.ScrollView>
      </SampleCard>
    </Page>
  )
}
