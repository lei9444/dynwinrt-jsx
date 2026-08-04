import {
  color,
  createNativeResourceOwner,
  createSolidColorBrush,
  gridLength,
  styles,
  thickness,
} from 'dynwinrt-jsx'
import {
  HorizontalAlignment,
  ItemsPanelTemplate,
  projectAs,
  releaseProjected,
  SolidColorBrush,
  Stretch,
  VerticalAlignment,
  XamlReader,
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

function createVerticalItemsPanel(): ItemsPanelTemplate {
  return projectAs(
    XamlReader.load(`
      <ItemsPanelTemplate
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation">
        <VirtualizingStackPanel Orientation="Vertical" />
      </ItemsPanelTemplate>
    `),
    ItemsPanelTemplate,
  )
}

export function FlipViewPage(context: AppContext) {
  const photos = createCollectionPhotos()
  const nativeResources = createNativeResourceOwner({
    releaseProjected,
  })
  const borderBrush = nativeResources.ownProjected(
    createSolidColorBrush(
      SolidColorBrush,
      color(0, 0, 0),
    ),
  )
  const captionBrush = nativeResources.ownProjected(
    createSolidColorBrush(
      SolidColorBrush,
      color(255, 255, 255, 165),
    ),
  )
  const verticalItemsPanel = nativeResources.ownProjected(
    createVerticalItemsPanel(),
  )

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
        title="A simple FlipView"
        description="Move the pointer over the image to use FlipView's native previous and next buttons."
        code={`
<UI.FlipView height={270} maxWidth={400}>
  <UI.Image source={cliff} />
  <UI.Image source={grapes} />
  <UI.Image source={rainier} />
  <UI.Image source={sunset} />
  <UI.Image source={valley} />
</UI.FlipView>
        `}
      >
        <UI.FlipView
          automationId="GalleryCollectionsFlipViewControl"
          height={270}
          maxWidth={400}
          horizontalAlignment={HorizontalAlignment.Left}
          onSelectionChanged={() => {
            context.model.recordInteraction()
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
      </SampleCard>

      <SampleCard
        title="Showing bound data"
        description="Each data item is rendered as an image with a bordered caption area, matching the original bound-data template."
        code={`
<UI.FlipView
  borderBrush={blackBrush}
  borderThickness={thickness(1)}
>
  {photos.map((photo) => (
    <LayoutGrid>
      <UI.Image source={photo.source} />
      <UI.Border gridRow={1}>
        <UI.TextBlock text={photo.title} />
      </UI.Border>
    </LayoutGrid>
  ))}
</UI.FlipView>
        `}
      >
        <UI.FlipView
          height={180}
          maxWidth={400}
          horizontalAlignment={HorizontalAlignment.Left}
          borderBrush={borderBrush}
          borderThickness={thickness(1)}
          onSelectionChanged={() => {
            context.model.recordInteraction()
          }}
        >
          {photos.map((photo) => (
            <LayoutGrid
              key={photo.id}
              automationName={photo.title}
              rowDefinitions={[
                gridLength.star(),
                gridLength.pixel(60),
              ]}
            >
              <UI.Image
                source={photo.source}
                horizontalAlignment={HorizontalAlignment.Stretch}
                verticalAlignment={VerticalAlignment.Stretch}
                stretch={Stretch.UniformToFill}
              />
              <UI.Border
                gridRow={1}
                height={60}
                background={captionBrush}
              >
                <UI.TextBlock
                  {...styles.heading({ level: 'bodyStrong' })}
                  padding={thickness(12)}
                  horizontalAlignment={HorizontalAlignment.Center}
                  verticalAlignment={VerticalAlignment.Center}
                  foreground={borderBrush}
                  text={photo.title}
                />
              </UI.Border>
            </LayoutGrid>
          ))}
        </UI.FlipView>
      </SampleCard>

      <SampleCard
        title="Vertical FlipView"
        description="A vertical VirtualizingStackPanel changes the native navigation direction to up and down."
        code={`
const itemsPanel = XamlReader.load(
  '<ItemsPanelTemplate ...>' +
  '<VirtualizingStackPanel Orientation="Vertical" />' +
  '</ItemsPanelTemplate>',
)

<UI.FlipView itemsPanel={itemsPanel}>
  {photos.map((photo) => <UI.Image source={photo.source} />)}
</UI.FlipView>
        `}
      >
        <UI.FlipView
          height={270}
          maxWidth={400}
          horizontalAlignment={HorizontalAlignment.Left}
          itemsPanel={verticalItemsPanel}
          onSelectionChanged={() => {
            context.model.recordInteraction()
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
      </SampleCard>
    </Page>
  )
}
