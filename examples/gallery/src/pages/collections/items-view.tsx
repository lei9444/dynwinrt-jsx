import {
  computed,
  signal,
  styles,
  theme,
  thickness,
} from 'dynwinrt-jsx'
import {
  HorizontalAlignment,
  ItemsViewSelectionMode,
  LinedFlowLayout,
  Orientation,
  StackLayout,
  Stretch,
  TextWrapping,
  UniformGridLayout,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  GalleryItemsView,
  UI,
} from '../../gallery-ui'
import {
  Page,
  SampleCard,
} from '../../components/gallery-components'
import { createCollectionPhotos } from './shared'

const selectionModes = [
  ['None', ItemsViewSelectionMode.None],
  ['Single', ItemsViewSelectionMode.Single],
  ['Multiple', ItemsViewSelectionMode.Multiple],
  ['Extended', ItemsViewSelectionMode.Extended],
] as const

export function ItemsViewPage(context: AppContext) {
  const photos = createCollectionPhotos(320)
  const items = [
    ...photos,
    ...photos.map((photo) => ({
      ...photo,
      id: photo.id + photos.length,
      title: `${photo.title} collection`,
    })),
  ]
  const basicLayout = new StackLayout()
  basicLayout.spacing = 6

  const linedFlowLayout = new LinedFlowLayout()
  linedFlowLayout.lineHeight = 160
  linedFlowLayout.lineSpacing = 5
  linedFlowLayout.minItemSpacing = 5
  const uniformGridLayout = new UniformGridLayout()
  uniformGridLayout.minItemWidth = 150
  uniformGridLayout.minItemHeight = 150
  uniformGridLayout.minColumnSpacing = 5
  uniformGridLayout.minRowSpacing = 5
  uniformGridLayout.maximumRowsOrColumns = 3
  const stackLayout = new StackLayout()
  stackLayout.orientation = Orientation.Vertical
  stackLayout.spacing = 5
  const layouts = [
    linedFlowLayout,
    uniformGridLayout,
    stackLayout,
  ] as const
  const layoutIndex = signal(0)
  const basicOutput = signal('Invoke an item with Enter or double-click.')
  const selectionModeIndex = signal(2)
  const itemInvokedEnabled = signal(false)
  const invocationOutput = signal('No item invoked.')
  const selectionOutput = signal('Selected items: 0')

  return (
    <Page
      title="ItemsView"
      subtitle="Present virtualized items with swappable native layouts, invocation, and selection."
      automationId="ItemsViewPageHeading"
      pageId="items-view"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryCollectionsItemsViewSample"
        title="Basic ItemsView"
        description="ItemsView uses an ItemContainer element factory so invocation and keyboard selection remain native."
        code={`
<GalleryItemsView
  each={photos}
  key={(photo) => photo.id}
  layout={basicLayout}
  isItemInvokedEnabled
  onItemInvoked={(sender) => {
    const item = photos[sender.currentItemIndex]
  }}
>
  {(photo) => <PhotoRow photo={photo} />}
</GalleryItemsView>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryCollectionsItemsViewStatus"
            text={basicOutput}
            textWrapping={TextWrapping.Wrap}
          />
        }
      >
        <GalleryItemsView
          automationId="GalleryCollectionsItemsViewControl"
          each={photos}
          key={(photo) => photo.id}
          layout={basicLayout}
          isItemInvokedEnabled
          width={320}
          height={360}
          horizontalAlignment={HorizontalAlignment.Left}
          onItemInvoked={(sender) => {
            const item = photos[sender.currentItemIndex]
            basicOutput.value = item
              ? `Invoked: ${item.title}`
              : 'Invoked an item.'
            context.model.recordInteraction()
          }}
        >
          {(photo) => (
            <UI.Border
              {...styles.card({ surface: 'layer' })}
              automationName={photo.title}
              width={300}
              padding={thickness(8)}
            >
              <UI.StackPanel spacing={6}>
                <UI.Image
                  source={photo.source}
                  width={284}
                  height={110}
                  stretch={Stretch.UniformToFill}
                />
                <UI.TextBlock
                  {...styles.heading({
                    level: 'bodyStrong',
                  })}
                  text={photo.title}
                />
              </UI.StackPanel>
            </UI.Border>
          )}
        </GalleryItemsView>
      </SampleCard>

      <SampleCard
        title="Swappable layouts"
        description="The same item source can move between LinedFlowLayout, UniformGridLayout, and StackLayout while layout-specific options update native dependency properties."
        code={`
<GalleryItemsView
  each={items}
  key={(item) => item.id}
  layout={computed(() => layouts[layoutIndex.value])}
>
  {(item) => <PhotoTile item={item} />}
</GalleryItemsView>
        `}
        options={
          <UI.StackPanel spacing={12}>
            <GalleryComboBox
              header={<UI.TextBlock text="Layout" />}
              selectedIndex={layoutIndex}
              onSelectedIndexChange={(index) => {
                layoutIndex.value = index
                context.model.recordInteraction()
              }}
              minWidth={210}
            >
              <UI.TextBlock text="LinedFlowLayout" />
              <UI.TextBlock text="UniformGridLayout" />
              <UI.TextBlock text="StackLayout" />
            </GalleryComboBox>
            <UI.NumberBox
              header="Item spacing"
              minimum={0}
              maximum={40}
              smallChange={1}
              value={5}
              onValueChanged={(sender) => {
                if (!Number.isFinite(sender.value)) {
                  return
                }
                linedFlowLayout.minItemSpacing = sender.value
                uniformGridLayout.minColumnSpacing = sender.value
                uniformGridLayout.minRowSpacing = sender.value
                stackLayout.spacing = sender.value
              }}
            />
            <UI.NumberBox
              header="Maximum items per row"
              minimum={1}
              maximum={6}
              smallChange={1}
              value={3}
              onValueChanged={(sender) => {
                if (Number.isFinite(sender.value)) {
                  uniformGridLayout.maximumRowsOrColumns =
                    Math.round(sender.value)
                }
              }}
            />
          </UI.StackPanel>
        }
      >
        <GalleryItemsView
          each={items}
          key={(item) => item.id}
          layout={computed(
            () => layouts[layoutIndex.value] ?? linedFlowLayout,
          )}
          height={400}
          horizontalAlignment={HorizontalAlignment.Stretch}
        >
          {(item) => (
            <UI.Border
              {...styles.card({ surface: 'layer' })}
              automationName={item.title}
              width={computed(() =>
                layoutIndex.value === 2 ? 440 : 150,
              )}
              padding={thickness(8)}
            >
              <UI.StackPanel spacing={6}>
                <UI.Image
                  source={item.source}
                  width={computed(() =>
                    layoutIndex.value === 2 ? 420 : 134,
                  )}
                  height={computed(() =>
                    layoutIndex.value === 0 ? 112 : 90,
                  )}
                  stretch={Stretch.UniformToFill}
                />
                <UI.TextBlock
                  {...styles.heading({
                    level: 'bodyStrong',
                  })}
                  text={item.title}
                />
              </UI.StackPanel>
            </UI.Border>
          )}
        </GalleryItemsView>
      </SampleCard>

      <SampleCard
        automationId="GalleryCollectionsItemsViewSelectionSample"
        title="Invocation and selection modes"
        description="None, Single, Multiple, and Extended selection are native ItemsView modes and SelectedItems reports the live selection."
        code={`
<GalleryItemsView
  selectionMode={selectionMode}
  isItemInvokedEnabled={itemInvokedEnabled}
  onSelectionChanged={(sender) => {
    selectedCount.value = sender.selectedItems.size
  }}
/>
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock text={invocationOutput} />
            <UI.TextBlock
              automationId="GalleryCollectionsItemsViewSelectionStatus"
              text={selectionOutput}
            />
          </UI.StackPanel>
        }
        options={
          <UI.StackPanel spacing={12}>
            <GalleryComboBox
              header={<UI.TextBlock text="SelectionMode" />}
              selectedIndex={selectionModeIndex}
              onSelectedIndexChange={(index) => {
                selectionModeIndex.value = index
              }}
              minWidth={180}
            >
              {selectionModes.map(([name]) => (
                <UI.TextBlock key={name} text={name} />
              ))}
            </GalleryComboBox>
            <UI.CheckBox
              isChecked={itemInvokedEnabled}
              onChecked={() => {
                itemInvokedEnabled.value = true
              }}
              onUnchecked={() => {
                itemInvokedEnabled.value = false
              }}
            >
              IsItemInvokedEnabled
            </UI.CheckBox>
          </UI.StackPanel>
        }
      >
        <GalleryItemsView
          each={items}
          key={(item) => item.id}
          layout={uniformGridLayout}
          height={400}
          selectionMode={computed(
            () =>
              selectionModes[selectionModeIndex.value]?.[1] ??
              ItemsViewSelectionMode.Multiple,
          )}
          isItemInvokedEnabled={itemInvokedEnabled}
          onItemInvoked={(sender) => {
            const item = items[sender.currentItemIndex]
            invocationOutput.value = item
              ? `Invoked: ${item.title}`
              : 'Invoked an item.'
            context.model.recordInteraction()
          }}
          onSelectionChanged={(sender) => {
            selectionOutput.value =
              `Selected items: ${sender.selectedItems.size}`
            context.model.recordInteraction()
          }}
        >
          {(item) => (
            <UI.Border
              automationName={item.title}
              width={150}
              padding={thickness(8)}
              background={theme.cardBackground}
            >
              <UI.StackPanel spacing={6}>
                <UI.Image
                  source={item.source}
                  width={134}
                  height={90}
                  stretch={Stretch.UniformToFill}
                />
                <UI.TextBlock
                  text={item.title}
                  textWrapping={TextWrapping.Wrap}
                />
              </UI.StackPanel>
            </UI.Border>
          )}
        </GalleryItemsView>
      </SampleCard>
    </Page>
  )
}
