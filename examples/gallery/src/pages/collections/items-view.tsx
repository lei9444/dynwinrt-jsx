import {
  Show,
  computed,
  createNativeResourceOwner,
  gridLength,
  signal,
  styles,
  theme,
  thickness,
  type ReadonlySignal,
} from 'dynwinrt-jsx'
import {
  HorizontalAlignment,
  ItemsViewSelectionMode,
  LinedFlowLayout,
  LinedFlowLayoutItemsStretch,
  Orientation,
  releaseProjected,
  StackLayout,
  Stretch,
  TextTrimming,
  TextWrapping,
  UniformGridLayout,
  VerticalAlignment,
  Visibility,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  GalleryItemsView,
  LayoutGrid,
  UI,
} from '../../gallery-ui'
import {
  Page,
  SampleCard,
} from '../../components/gallery-components'
import {
  type CollectionPhoto,
  createCollectionPhotos,
} from './shared'

interface ItemsViewPhoto extends CollectionPhoto {
  readonly likes: number
}

const selectionModes = [
  ['None', ItemsViewSelectionMode.None],
  ['Single', ItemsViewSelectionMode.Single],
  ['Multiple', ItemsViewSelectionMode.Multiple],
  ['Extended', ItemsViewSelectionMode.Extended],
] as const

function OverlayCaption(props: {
  readonly item: ItemsViewPhoto
}) {
  return (
    <UI.Border
      height={40}
      padding={thickness(5, 1)}
      verticalAlignment={VerticalAlignment.Bottom}
      background={theme.smokeFill}
      opacity={0.88}
    >
      <UI.StackPanel spacing={0}>
        <UI.TextBlock
          foreground={theme.textOnAccent}
          text={props.item.title}
        />
        <UI.TextBlock
          foreground={theme.textOnAccent}
          fontSize={12}
          text={`${props.item.likes} Likes`}
        />
      </UI.StackPanel>
    </UI.Border>
  )
}

function SwappableItemsViewItem(props: {
  readonly item: ItemsViewPhoto
  readonly layoutIndex: ReadonlySignal<number>
  readonly lineHeightIndex: ReadonlySignal<number>
}) {
  const visibleWhen = (index: number) =>
    computed(() =>
      props.layoutIndex.value === index
        ? Visibility.Visible
        : Visibility.Collapsed,
    )

  return (
    <LayoutGrid automationName={props.item.title}>
      <LayoutGrid
        visibility={visibleWhen(0)}
        width={150}
        height={computed(() =>
          props.lineHeightIndex.value === 0 ? 80 : 160,
        )}
      >
        <UI.Image
          minWidth={70}
          horizontalAlignment={HorizontalAlignment.Center}
          verticalAlignment={VerticalAlignment.Center}
          source={props.item.source}
          stretch={Stretch.UniformToFill}
        />
        <OverlayCaption item={props.item} />
      </LayoutGrid>

      <LayoutGrid
        visibility={visibleWhen(1)}
        width={150}
        height={120}
      >
        <UI.Image
          horizontalAlignment={HorizontalAlignment.Center}
          verticalAlignment={VerticalAlignment.Center}
          source={props.item.source}
          stretch={Stretch.UniformToFill}
        />
        <OverlayCaption item={props.item} />
      </LayoutGrid>

      <LayoutGrid
        visibility={visibleWhen(2)}
        width={480}
        minHeight={80}
        maxHeight={100}
        columnDefinitions={[
          gridLength.pixel(24),
          gridLength.star(),
        ]}
        rowDefinitions={[
          gridLength.auto(),
          gridLength.star(),
        ]}
        columnSpacing={8}
      >
        <UI.Image
          width={24}
          height={16}
          margin={thickness(0, 4, 0, 0)}
          horizontalAlignment={HorizontalAlignment.Center}
          verticalAlignment={VerticalAlignment.Center}
          source={props.item.source}
          stretch={Stretch.UniformToFill}
        />
        <UI.TextBlock
          gridColumn={1}
          {...styles.heading({ level: 'bodyStrong' })}
          text={props.item.title}
        />
        <UI.TextBlock
          gridRow={1}
          gridColumnSpan={2}
          margin={thickness(0, 4, 8, 4)}
          foreground={theme.secondaryText}
          text={props.item.detail}
          textTrimming={TextTrimming.WordEllipsis}
          textWrapping={TextWrapping.Wrap}
        />
      </LayoutGrid>
    </LayoutGrid>
  )
}

function UniformItemsViewItem(props: {
  readonly item: ItemsViewPhoto
}) {
  return (
    <LayoutGrid
      automationName={props.item.title}
      width={150}
      height={120}
    >
      <UI.Image
        horizontalAlignment={HorizontalAlignment.Center}
        verticalAlignment={VerticalAlignment.Center}
        source={props.item.source}
        stretch={Stretch.UniformToFill}
      />
      <OverlayCaption item={props.item} />
    </LayoutGrid>
  )
}

export function ItemsViewPage(context: AppContext) {
  const nativeResources = createNativeResourceOwner({
    releaseProjected,
  })
  const photos: readonly ItemsViewPhoto[] =
    createCollectionPhotos(320).map((photo, index) => ({
      ...photo,
      likes: 42 + index * 19,
    }))
  const items: readonly ItemsViewPhoto[] = [
    ...photos,
    ...photos.map((photo) => ({
      ...photo,
      id: photo.id + photos.length,
      title: `${photo.title} collection`,
      likes: photo.likes + 67,
    })),
  ]

  const basicLayout = nativeResources.ownProjected(
    new StackLayout(),
  )
  const linedFlowLayout = nativeResources.ownProjected(
    new LinedFlowLayout(),
  )
  linedFlowLayout.itemsStretch = LinedFlowLayoutItemsStretch.Fill
  linedFlowLayout.lineHeight = 160
  linedFlowLayout.lineSpacing = 5
  linedFlowLayout.minItemSpacing = 5

  const uniformGridLayout = nativeResources.ownProjected(
    new UniformGridLayout(),
  )
  uniformGridLayout.minItemWidth = 150
  uniformGridLayout.minItemHeight = 120
  uniformGridLayout.minColumnSpacing = 5
  uniformGridLayout.minRowSpacing = 5
  uniformGridLayout.maximumRowsOrColumns = 3

  const stackLayout = nativeResources.ownProjected(
    new StackLayout(),
  )
  stackLayout.orientation = Orientation.Vertical
  stackLayout.spacing = 5

  const selectionLayout = nativeResources.ownProjected(
    new UniformGridLayout(),
  )
  selectionLayout.minItemWidth = 150
  selectionLayout.minItemHeight = 120
  selectionLayout.minColumnSpacing = 5
  selectionLayout.minRowSpacing = 5
  selectionLayout.maximumRowsOrColumns = 3

  const layouts = [
    linedFlowLayout,
    uniformGridLayout,
    stackLayout,
  ] as const
  const layoutIndex = signal(0)
  const lineHeightIndex = signal(1)
  const lineSpacing = signal(5)
  const lineItemSpacing = signal(5)
  const gridColumnSpacing = signal(5)
  const gridRowSpacing = signal(5)
  const gridMaximum = signal(3)
  const stackSpacing = signal(5)
  const basicOutput = signal('')
  const selectionModeIndex = signal(2)
  const itemInvokedEnabled = signal(false)
  const invocationOutput = signal('')
  const selectionOutput = signal('')

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
        description="The default StackLayout presents simple ItemContainer visuals. Press Enter, double-click, or double-tap to invoke an item."
        code={`
<GalleryItemsView
  each={items}
  key={(item) => item.id}
  layout={new StackLayout()}
  isItemInvokedEnabled
  onItemInvoked={showInvokedItem}
>
  {(item) => <UI.Image width={200} height={140} />}
</GalleryItemsView>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryCollectionsItemsViewStatus"
            text={basicOutput}
          />
        }
      >
        <GalleryItemsView
          automationId="GalleryCollectionsItemsViewControl"
          each={photos}
          key={(photo) => photo.id}
          layout={basicLayout}
          isItemInvokedEnabled
          width={220}
          height={400}
          horizontalAlignment={HorizontalAlignment.Left}
          onItemInvoked={(sender) => {
            const item = photos[sender.currentItemIndex]
            basicOutput.value = item
              ? `You invoked ${item.title}.`
              : 'You invoked an item.'
            context.model.recordInteraction()
          }}
        >
          {(photo) => (
            <UI.Image
              automationName={photo.title}
              width={200}
              height={140}
              margin={thickness(4)}
              horizontalAlignment={HorizontalAlignment.Center}
              verticalAlignment={VerticalAlignment.Center}
              source={photo.source}
              stretch={Stretch.UniformToFill}
            />
          )}
        </GalleryItemsView>
      </SampleCard>

      <SampleCard
        title="Swappable layouts"
        description="Switch between LinedFlowLayout, UniformGridLayout, and StackLayout, then tune the settings for the active layout."
        code={`
<GalleryItemsView
  each={items}
  key={(item) => item.id}
  layout={computed(() => layouts[layoutIndex.value])}
>
  {(item) => <LayoutSpecificItem item={item} />}
</GalleryItemsView>
        `}
        options={
          <UI.StackPanel minWidth={300} spacing={12}>
            <GalleryComboBox
              header={<UI.TextBlock text="Layout" />}
              selectedIndex={layoutIndex}
              onSelectedIndexChange={(index) => {
                layoutIndex.value = index
                context.model.recordInteraction()
              }}
              minWidth={220}
            >
              <UI.TextBlock text="LinedFlowLayout" />
              <UI.TextBlock text="UniformGridLayout" />
              <UI.TextBlock text="StackLayout" />
            </GalleryComboBox>

            <Show when={computed(() => layoutIndex.value === 0)}>
              {() => (
                <UI.StackPanel minHeight={260} spacing={12}>
                  <UI.TextBlock
                    margin={thickness(0, 3, 0, 0)}
                    fontWeight={{ weight: 600 }}
                    text="LinedFlowLayout settings"
                  />
                  <UI.NumberBox
                    header="Space between lines"
                    minimum={0}
                    maximum={100}
                    smallChange={1}
                    value={lineSpacing}
                    onValueChanged={(sender) => {
                      if (Number.isFinite(sender.value)) {
                        lineSpacing.value = sender.value
                        linedFlowLayout.lineSpacing = sender.value
                        context.model.recordInteraction()
                      }
                    }}
                  />
                  <UI.NumberBox
                    header="Minimum space between items on a line"
                    minimum={0}
                    maximum={100}
                    smallChange={1}
                    value={lineItemSpacing}
                    onValueChanged={(sender) => {
                      if (Number.isFinite(sender.value)) {
                        lineItemSpacing.value = sender.value
                        linedFlowLayout.minItemSpacing = sender.value
                        context.model.recordInteraction()
                      }
                    }}
                  />
                  <GalleryComboBox
                    header={<UI.TextBlock text="Line height" />}
                    selectedIndex={lineHeightIndex}
                    onSelectedIndexChange={(index) => {
                      lineHeightIndex.value = index
                      linedFlowLayout.lineHeight =
                        index === 0 ? 80 : 160
                      context.model.recordInteraction()
                    }}
                    minWidth={180}
                  >
                    <UI.TextBlock text="Small" />
                    <UI.TextBlock text="Large" />
                  </GalleryComboBox>
                </UI.StackPanel>
              )}
            </Show>

            <Show when={computed(() => layoutIndex.value === 1)}>
              {() => (
                <UI.StackPanel minHeight={260} spacing={12}>
                  <UI.TextBlock
                    margin={thickness(0, 3, 0, 0)}
                    fontWeight={{ weight: 600 }}
                    text="UniformGridLayout settings"
                  />
                  <UI.NumberBox
                    header="Minimum space between columns"
                    minimum={0}
                    maximum={100}
                    smallChange={1}
                    value={gridColumnSpacing}
                    onValueChanged={(sender) => {
                      if (Number.isFinite(sender.value)) {
                        gridColumnSpacing.value = sender.value
                        uniformGridLayout.minColumnSpacing =
                          sender.value
                        context.model.recordInteraction()
                      }
                    }}
                  />
                  <UI.NumberBox
                    header="Minimum space between rows"
                    minimum={0}
                    maximum={100}
                    smallChange={1}
                    value={gridRowSpacing}
                    onValueChanged={(sender) => {
                      if (Number.isFinite(sender.value)) {
                        gridRowSpacing.value = sender.value
                        uniformGridLayout.minRowSpacing =
                          sender.value
                        context.model.recordInteraction()
                      }
                    }}
                  />
                  <UI.NumberBox
                    header="Maximum number of items per row before wrapping"
                    minimum={1}
                    maximum={8}
                    smallChange={1}
                    value={gridMaximum}
                    onValueChanged={(sender) => {
                      if (Number.isFinite(sender.value)) {
                        const next = Math.round(sender.value)
                        gridMaximum.value = next
                        uniformGridLayout.maximumRowsOrColumns = next
                        context.model.recordInteraction()
                      }
                    }}
                  />
                </UI.StackPanel>
              )}
            </Show>

            <Show when={computed(() => layoutIndex.value === 2)}>
              {() => (
                <UI.StackPanel minHeight={260} spacing={12}>
                  <UI.TextBlock
                    margin={thickness(0, 3, 0, 0)}
                    fontWeight={{ weight: 600 }}
                    text="StackLayout settings"
                  />
                  <UI.NumberBox
                    header="Space between rows"
                    minimum={0}
                    maximum={100}
                    smallChange={1}
                    value={stackSpacing}
                    onValueChanged={(sender) => {
                      if (Number.isFinite(sender.value)) {
                        stackSpacing.value = sender.value
                        stackLayout.spacing = sender.value
                        context.model.recordInteraction()
                      }
                    }}
                  />
                </UI.StackPanel>
              )}
            </Show>
          </UI.StackPanel>
        }
      >
        <UI.StackPanel spacing={15}>
          <UI.TextBlock
            text="Use the options to control layout customizations for the ItemsView below."
            textWrapping={TextWrapping.Wrap}
          />
          <GalleryItemsView
            each={items}
            key={(item) => item.id}
            layout={computed(
              () => layouts[layoutIndex.value] ?? linedFlowLayout,
            )}
            width={500}
            height={400}
            horizontalAlignment={HorizontalAlignment.Left}
          >
            {(item) => (
              <SwappableItemsViewItem
                item={item}
                layoutIndex={layoutIndex}
                lineHeightIndex={lineHeightIndex}
              />
            )}
          </GalleryItemsView>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GalleryCollectionsItemsViewSelectionSample"
        title="Item invocation and selection"
        description="Choose None, Single, Multiple, or Extended selection, and independently enable item invocation."
        code={`
<GalleryItemsView
  selectionMode={selectionMode}
  isItemInvokedEnabled={itemInvokedEnabled}
  onItemInvoked={showInvokedItem}
  onSelectionChanged={showSelectedCount}
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
          <LayoutGrid
            minWidth={220}
            columnDefinitions={[
              gridLength.auto(),
              gridLength.star(),
            ]}
            rowDefinitions={[
              gridLength.auto(),
              gridLength.auto(),
            ]}
            columnSpacing={10}
            rowSpacing={10}
          >
            <UI.TextBlock
              verticalAlignment={VerticalAlignment.Center}
              text="SelectionMode"
            />
            <GalleryComboBox
              gridColumn={1}
              selectedIndex={selectionModeIndex}
              onSelectedIndexChange={(index) => {
                selectionModeIndex.value = index
                context.model.recordInteraction()
              }}
              minWidth={150}
            >
              {selectionModes.map(([name]) => (
                <UI.TextBlock key={name} text={name} />
              ))}
            </GalleryComboBox>
            <UI.TextBlock
              gridRow={1}
              verticalAlignment={VerticalAlignment.Center}
              text="IsItemInvokedEnabled"
            />
            <UI.CheckBox
              gridRow={1}
              gridColumn={1}
              horizontalAlignment={HorizontalAlignment.Left}
              isChecked={itemInvokedEnabled}
              onChecked={() => {
                itemInvokedEnabled.value = true
                invocationOutput.value = ''
                context.model.recordInteraction()
              }}
              onUnchecked={() => {
                itemInvokedEnabled.value = false
                invocationOutput.value = ''
                context.model.recordInteraction()
              }}
            />
          </LayoutGrid>
        }
      >
        <UI.StackPanel spacing={15}>
          <UI.TextBlock
            text="None disables selection. Single selects one item. Multiple shows check boxes. Extended supports Ctrl+Click and Shift+Click ranges."
            textWrapping={TextWrapping.Wrap}
          />
          <GalleryItemsView
            each={items}
            key={(item) => item.id}
            layout={selectionLayout}
            width={500}
            height={400}
            horizontalAlignment={HorizontalAlignment.Left}
            selectionMode={computed(
              () =>
                selectionModes[selectionModeIndex.value]?.[1] ??
                ItemsViewSelectionMode.Multiple,
            )}
            isItemInvokedEnabled={itemInvokedEnabled}
            onItemInvoked={(sender) => {
              const item = items[sender.currentItemIndex]
              invocationOutput.value = item
                ? `You invoked ${item.title}.`
                : 'You invoked an item.'
              context.model.recordInteraction()
            }}
            onSelectionChanged={(sender) => {
              selectionOutput.value =
                `You have selected ${sender.selectedItems.size} item(s).`
              context.model.recordInteraction()
            }}
          >
            {(item) => <UniformItemsViewItem item={item} />}
          </GalleryItemsView>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
