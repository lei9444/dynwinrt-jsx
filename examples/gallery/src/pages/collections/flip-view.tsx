import {
  computed,
  gridLength,
  signal,
  styles,
  theme,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  FlipView,
  HorizontalAlignment,
  Orientation,
  Stretch,
  VerticalAlignment,
} from '#winapp/bindings'
import {
  type AppContext,
  LayoutGrid,
  UI,
} from '../../gallery-ui'
import {
  Page,
  SampleCard,
} from '../../components/gallery-components'
import { createCollectionPhotos } from './shared'

export function FlipViewPage(context: AppContext) {
  const photos = createCollectionPhotos()
  const declaredFlipView:
    RefObject<InstanceType<typeof FlipView>> = {
      current: null,
    }
  const dataFlipView:
    RefObject<InstanceType<typeof FlipView>> = {
      current: null,
    }
  const declaredIndex = signal(0)
  const dataIndex = signal(0)

  return (
    <Page
      title="FlipView"
      subtitle="Flip through a collection of items one page at a time."
      automationId="FlipViewPageHeading"
      pageId="flip-view"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryCollectionsFlipViewSample"
        title="Images declared as items"
        description="FlipView supplies native previous and next affordances while selectedIndex reports the current page."
        code={`
const selectedIndex = signal(0)
<UI.FlipView
  ref={declaredFlipView}
  selectedIndex={selectedIndex}
  onSelectionChanged={(
    sender: InstanceType<typeof FlipView>,
  ) => {
    selectedIndex.value = sender.selectedIndex
  }}
>
  {photos.map((photo) => (
    <UI.Image key={photo.id} source={photo.source} />
  ))}
</UI.FlipView>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryCollectionsFlipViewStatus"
            text={computed(() =>
              `Current item: ${photos[declaredIndex.value]?.title ?? 'None'}`,
            )}
          />
        }
      >
        <UI.StackPanel spacing={10}>
          <UI.FlipView
            ref={declaredFlipView}
            automationId="GalleryCollectionsFlipViewControl"
            height={270}
            maxWidth={400}
            horizontalAlignment={HorizontalAlignment.Left}
            selectedIndex={declaredIndex}
            onSelectionChanged={() => {
              const index =
                declaredFlipView.current?.selectedIndex
              if (index !== undefined && index >= 0) {
                declaredIndex.value = index
                context.model.recordInteraction()
              }
            }}
          >
            {photos.map((photo) => (
              <UI.Image
                key={photo.id}
                automationName={photo.title}
                source={photo.source}
                stretch={Stretch.UniformToFill}
              />
            ))}
          </UI.FlipView>
          <UI.StackPanel
            orientation={Orientation.Horizontal}
            spacing={8}
          >
            <UI.Button
              onClick={() => {
                declaredIndex.value =
                  (declaredIndex.value + photos.length - 1) %
                  photos.length
                context.model.recordInteraction()
              }}
            >
              Previous item
            </UI.Button>
            <UI.Button
              automationId="GalleryCollectionsFlipViewNext"
              onClick={() => {
                declaredIndex.value =
                  (declaredIndex.value + 1) % photos.length
                context.model.recordInteraction()
              }}
            >
              Next item
            </UI.Button>
          </UI.StackPanel>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        title="Data-driven item content"
        description="JSX maps application data into composed image and caption pages without a XAML DataTemplate."
        code={`
<UI.FlipView selectedIndex={dataIndex}>
  {photos.map((photo) => (
    <LayoutGrid key={photo.id}>
      <UI.Image source={photo.source} />
      <UI.Border verticalAlignment={VerticalAlignment.Bottom}>
        <UI.TextBlock text={photo.title} />
      </UI.Border>
    </LayoutGrid>
  ))}
</UI.FlipView>
        `}
      >
        <UI.StackPanel spacing={10}>
          <UI.FlipView
            ref={dataFlipView}
            height={220}
            maxWidth={400}
            horizontalAlignment={HorizontalAlignment.Left}
            selectedIndex={dataIndex}
            onSelectionChanged={() => {
              const index = dataFlipView.current?.selectedIndex
              if (index !== undefined && index >= 0) {
                dataIndex.value = index
                context.model.recordInteraction()
              }
            }}
          >
            {photos.map((photo) => (
              <LayoutGrid
                key={photo.id}
                rowDefinitions={[
                  gridLength.star(),
                  gridLength.auto(),
                ]}
              >
                <UI.Image
                  source={photo.source}
                  stretch={Stretch.UniformToFill}
                />
                <UI.Border
                  gridRow={1}
                  padding={thickness(12)}
                  background={theme.cardBackground}
                  verticalAlignment={VerticalAlignment.Bottom}
                >
                  <UI.StackPanel spacing={2}>
                    <UI.TextBlock
                      {...styles.heading({
                        level: 'bodyStrong',
                      })}
                      text={photo.title}
                    />
                    <UI.TextBlock
                      foreground={theme.secondaryText}
                      text={photo.detail}
                    />
                  </UI.StackPanel>
                </UI.Border>
              </LayoutGrid>
            ))}
          </UI.FlipView>
          <UI.TextBlock
            text={computed(() =>
              `${dataIndex.value + 1} of ${photos.length}`,
            )}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
