import {
  color,
  computed,
  createScrollViewerController,
  createSolidColorBrush,
  onCleanup,
  signal,
  thickness,
} from 'dynwinrt-jsx'
import {
  ScrollBarVisibility,
  ScrollMode,
  SolidColorBrush,
} from '#winapp/bindings'
import {
  type AppContext,
  type ScrollViewerInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function ScrollViewerPage(context: AppContext) {
  const controller =
    createScrollViewerController<ScrollViewerInstance>()
  onCleanup(() => controller.dispose())
  const action = signal('Ready.')
  const brushes = [
    createSolidColorBrush(
      SolidColorBrush,
      color(232, 240, 254),
    ),
    createSolidColorBrush(
      SolidColorBrush,
      color(238, 232, 255),
    ),
  ] as const

  return (
    <Page
      title="ScrollViewer"
      subtitle="Provides classic content scrolling and zooming with reactive boundary state."
      automationId="ScrollViewerPageHeading"
      pageId="scroll-viewer"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryScrollViewerSample"
        title="Track offsets and page through content"
        description="The ScrollViewer controller owns native event subscriptions and exposes reactive offsets and boundaries."
        code={`
const scroller = createScrollViewerController<ScrollViewer>()

<UI.ScrollViewer ref={scroller}>
  <LongContent />
</UI.ScrollViewer>
<UI.Button
  isEnabled={scroller.canScrollDown}
  onClick={() => scroller.scrollVerticalByViewport(1)}
/>
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock text={action} />
            <UI.TextBlock
              automationId="GalleryScrollViewerStatus"
              text={computed(
                () =>
                  `Offset: ${Math.round(controller.verticalOffset.value)}; Can scroll up: ${controller.canScrollUp.value ? 'yes' : 'no'}; can scroll down: ${controller.canScrollDown.value ? 'yes' : 'no'}.`,
              )}
            />
          </UI.StackPanel>
        }
        options={
          <UI.StackPanel spacing={10}>
            <UI.Button
              automationId="GalleryScrollViewerDown"
              isEnabled={controller.canScrollDown}
              onClick={() => {
                const accepted =
                  controller.scrollVerticalByViewport(1, true)
                action.value = accepted
                  ? 'Paged down.'
                  : 'Page-down request was rejected.'
                context.model.recordInteraction()
              }}
            >
              Page down
            </UI.Button>
            <UI.Button
              automationId="GalleryScrollViewerTop"
              isEnabled={controller.canScrollUp}
              onClick={() => {
                const accepted =
                  controller.scrollToVerticalOffset(0, true)
                action.value = accepted
                  ? 'Returned to the top.'
                  : 'Top request was rejected.'
                context.model.recordInteraction()
              }}
            >
              Back to top
            </UI.Button>
          </UI.StackPanel>
        }
      >
        <UI.ScrollViewer
          ref={controller}
          automationId="GalleryScrollViewerControl"
          width={500}
          height={300}
          verticalScrollMode={ScrollMode.Enabled}
          verticalScrollBarVisibility={ScrollBarVisibility.Auto}
          horizontalScrollMode={ScrollMode.Disabled}
          horizontalScrollBarVisibility={
            ScrollBarVisibility.Disabled
          }
        >
          <UI.StackPanel spacing={8}>
            {Array.from({ length: 12 }, (_, index) => (
              <UI.Border
                key={index}
                height={72}
                padding={thickness(18)}
                background={brushes[index % brushes.length]!}
              >
                <UI.TextBlock
                  fontSize={20}
                  text={`Scrollable row ${index + 1}`}
                />
              </UI.Border>
            ))}
          </UI.StackPanel>
        </UI.ScrollViewer>
      </SampleCard>
    </Page>
  )
}
