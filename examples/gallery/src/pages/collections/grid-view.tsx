import {
  computed,
  createNativeResourceOwner,
  gridLength,
  signal,
  styles,
  theme,
  thickness,
  type RefObject,
  type ReadonlySignal,
} from 'dynwinrt-jsx'
import {
  FlowDirection,
  GridView,
  HorizontalAlignment,
  IFrameworkElement,
  ItemsPanelTemplate,
  ItemClickEventArgs,
  ListViewSelectionMode,
  Orientation,
  projectAs,
  releaseProjected,
  Stretch,
  TextTrimming,
  TextWrapping,
  VerticalAlignment,
  Visibility,
  XamlReader,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
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

interface GridPhoto extends CollectionPhoto {
  readonly views: number
  readonly likes: number
}

const selectionModes = [
  ['None', ListViewSelectionMode.None],
  ['Single', ListViewSelectionMode.Single],
  ['Multiple', ListViewSelectionMode.Multiple],
  ['Extended', ListViewSelectionMode.Extended],
] as const

const templateNames = [
  'Image',
  'Icon/Text',
  'Image/Text',
  'Text',
] as const

function createItemsWrapGridPanel(
  maximumRowsOrColumns: number,
): ItemsPanelTemplate {
  return projectAs(
    XamlReader.load(`
      <ItemsPanelTemplate
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation">
        <ItemsWrapGrid
          Orientation="Horizontal"
          MaximumRowsOrColumns="${maximumRowsOrColumns}" />
      </ItemsPanelTemplate>
    `),
    ItemsPanelTemplate,
  )
}

function readClickedTitle(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }
  let eventArgs = value
  if (!Reflect.has(eventArgs, 'clickedItem')) {
    const fromNative = Reflect.get(ItemClickEventArgs, '_fromNative')
    if (typeof fromNative !== 'function') {
      return undefined
    }
    const projected = Reflect.apply(
      fromNative,
      ItemClickEventArgs,
      [eventArgs],
    )
    if (typeof projected !== 'object' || projected === null) {
      return undefined
    }
    eventArgs = projected
  }
  const clickedItem = Reflect.get(eventArgs, 'clickedItem')
  if (clickedItem === null || clickedItem === undefined) {
    return undefined
  }
  return IFrameworkElement.from(clickedItem).name
}

function ContentTemplate(props: {
  readonly item: GridPhoto
  readonly templateIndex: ReadonlySignal<number>
}) {
  const visibleWhen = (index: number) =>
    computed(() =>
      props.templateIndex.value === index
        ? Visibility.Visible
        : Visibility.Collapsed,
    )

  return (
    <LayoutGrid automationName={props.item.title}>
      <UI.Image
        visibility={visibleWhen(0)}
        width={190}
        height={130}
        source={props.item.source}
        stretch={Stretch.UniformToFill}
      />

      <UI.StackPanel
        visibility={visibleWhen(1)}
        width={280}
        minHeight={160}
        spacing={6}
      >
        <UI.StackPanel
          orientation={Orientation.Horizontal}
          spacing={8}
        >
          <UI.Image
            width={18}
            height={18}
            margin={thickness(0, 4, 0, 0)}
            source={props.item.source}
            stretch={Stretch.Uniform}
          />
          <UI.TextBlock
            {...styles.heading({ level: 'bodyStrong' })}
            text={props.item.title}
          />
        </UI.StackPanel>
        <UI.TextBlock
          margin={thickness(0, 4, 8, 0)}
          foreground={theme.secondaryText}
          text={props.item.detail}
          textTrimming={TextTrimming.WordEllipsis}
          textWrapping={TextWrapping.Wrap}
        />
      </UI.StackPanel>

      <LayoutGrid
        visibility={visibleWhen(2)}
        width={280}
        columnDefinitions={[
          gridLength.auto(),
          gridLength.star(),
        ]}
      >
        <UI.Image
          width={100}
          height={100}
          verticalAlignment={VerticalAlignment.Top}
          source={props.item.source}
          stretch={Stretch.Fill}
        />
        <UI.StackPanel
          gridColumn={1}
          margin={thickness(8, 0, 0, 8)}
          spacing={8}
        >
          <UI.TextBlock
            {...styles.heading({ level: 'subtitle' })}
            text={props.item.title}
          />
          <UI.TextBlock
            foreground={theme.secondaryText}
            text={`${props.item.views} Views`}
          />
          <UI.TextBlock
            foreground={theme.secondaryText}
            text={`${props.item.likes} Likes`}
          />
        </UI.StackPanel>
      </LayoutGrid>

      <UI.StackPanel
        visibility={visibleWhen(3)}
        width={240}
        orientation={Orientation.Horizontal}
      >
        <UI.TextBlock
          {...styles.heading({ level: 'title' })}
          margin={thickness(8, 0, 0, 0)}
          text={props.item.title}
        />
      </UI.StackPanel>
    </LayoutGrid>
  )
}

export function GridViewPage(context: AppContext) {
  const nativeResources = createNativeResourceOwner({
    releaseProjected,
  })
  const photos: readonly GridPhoto[] =
    createCollectionPhotos(320).map((photo, index) => ({
      ...photo,
      views: 1250 + index * 371,
      likes: 42 + index * 19,
    }))
  const items: readonly GridPhoto[] = [
    ...photos,
    ...photos.map((photo) => ({
      ...photo,
      id: photo.id + photos.length,
      title: `${photo.title} II`,
      views: photo.views + 2180,
      likes: photo.likes + 73,
    })),
  ]

  const basicOutput = signal('')
  const columnSpacing = signal(5)
  const rowSpacing = signal(5)
  const maximumRowsOrColumns = signal(3)
  const styledItemsPanel = signal<ItemsPanelTemplate>(
    nativeResources.ownProjected(
      createItemsWrapGridPanel(3),
    ),
  )

  const contentGrid:
    RefObject<InstanceType<typeof GridView>> = {
      current: null,
    }
  const templateIndex = signal(0)
  const rightToLeft = signal(false)
  const itemClickEnabled = signal(false)
  const canDragItems = signal(false)
  const canReorderItems = signal(false)
  const allowDrop = signal(false)
  const selectionModeIndex = signal(1)
  const invocationStatus = signal('')
  const selectionStatus = signal('')

  const updateMaximumRows = (value: number) => {
    const rounded = Math.max(1, Math.min(8, Math.round(value)))
    maximumRowsOrColumns.value = rounded
    const previous = styledItemsPanel.value
    styledItemsPanel.value = nativeResources.ownProjected(
      createItemsWrapGridPanel(rounded),
    )
    nativeResources.release(previous)
    context.model.recordInteraction()
  }

  return (
    <Page
      title="GridView"
      subtitle="Present a collection as selectable, invokable tiles arranged in rows and columns."
      automationId="GridViewPageHeading"
      pageId="grid-view"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryCollectionsGridViewSample"
        title="Basic GridView"
        description="A basic GridView uses a simple 190 × 130 image template and native single selection."
        code={`
<UI.GridView
  isItemClickEnabled
  selectionMode={ListViewSelectionMode.Single}
  onItemClick={showClickedItem}
>
  {items.map((item) => (
    <UI.GridViewItem>
      <UI.Image width={190} height={130} source={item.source} />
    </UI.GridViewItem>
  ))}
</UI.GridView>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryCollectionsGridViewStatus"
            text={basicOutput}
          />
        }
      >
        <UI.StackPanel spacing={15}>
          <UI.TextBlock
            text="This is a basic GridView. The following samples show only the markup needed for specific customizations."
            textWrapping={TextWrapping.Wrap}
          />
          <UI.GridView
            automationId="GalleryCollectionsGridViewControl"
            maxHeight={360}
            horizontalAlignment={HorizontalAlignment.Stretch}
            isItemClickEnabled
            selectionMode={ListViewSelectionMode.Single}
            onItemClick={(_sender, args) => {
              const title = readClickedTitle(args)
              basicOutput.value = title
                ? `You clicked ${title}.`
                : 'You clicked an item.'
              context.model.recordInteraction()
            }}
          >
            {photos.map((item) => (
              <UI.GridViewItem
                key={item.id}
                automationName={item.title}
                name={item.title}
              >
                <UI.Image
                  width={190}
                  height={130}
                  automationName={item.title}
                  source={item.source}
                  stretch={Stretch.UniformToFill}
                />
              </UI.GridViewItem>
            ))}
          </UI.GridView>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        title="Layout customization"
        description="Adjust item margins and the ItemsWrapGrid maximum before wrapping, as in the original gallery sample."
        code={`
<UI.GridView itemsPanel={itemsWrapGridPanel}>
  <UI.GridViewItem margin={thickness(columnSpace, rowSpace)}>
    <ImageOverlayTemplate />
  </UI.GridViewItem>
</UI.GridView>
        `}
        options={
          <UI.StackPanel spacing={12}>
            <UI.NumberBox
              header="Space between columns"
              minimum={0}
              maximum={100}
              smallChange={1}
              value={5}
              onValueChanged={(sender) => {
                if (Number.isFinite(sender.value)) {
                  columnSpacing.value = sender.value
                  context.model.recordInteraction()
                }
              }}
            />
            <UI.NumberBox
              header="Space between rows"
              minimum={0}
              maximum={100}
              smallChange={1}
              value={5}
              onValueChanged={(sender) => {
                if (Number.isFinite(sender.value)) {
                  rowSpacing.value = sender.value
                  context.model.recordInteraction()
                }
              }}
            />
            <UI.NumberBox
              header="Maximum number of items before wrapping"
              minimum={1}
              maximum={8}
              smallChange={1}
              value={maximumRowsOrColumns}
              onValueChanged={(sender) => {
                if (Number.isFinite(sender.value)) {
                  updateMaximumRows(sender.value)
                }
              }}
            />
          </UI.StackPanel>
        }
      >
        <UI.StackPanel spacing={15}>
          <UI.TextBlock
            text="Use the options to control layout customizations for the GridView below."
            textWrapping={TextWrapping.Wrap}
          />
          <UI.GridView
            maxHeight={390}
            horizontalAlignment={HorizontalAlignment.Stretch}
            itemsPanel={styledItemsPanel}
            selectionMode={ListViewSelectionMode.Single}
          >
            {items.map((item) => (
              <UI.GridViewItem
                key={item.id}
                automationName={item.title}
                margin={computed(() =>
                  thickness(
                    columnSpacing.value,
                    rowSpacing.value,
                    columnSpacing.value,
                    rowSpacing.value,
                  ),
                )}
              >
                <LayoutGrid width={100} height={100}>
                  <UI.Image
                    source={item.source}
                    stretch={Stretch.UniformToFill}
                  />
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
                        text={item.title}
                      />
                      <UI.TextBlock
                        foreground={theme.textOnAccent}
                        fontSize={12}
                        text={`${item.likes} Likes`}
                      />
                    </UI.StackPanel>
                  </UI.Border>
                </LayoutGrid>
              </UI.GridViewItem>
            ))}
          </UI.GridView>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        title="Content inside a GridView"
        description="Swap four item visuals, reverse flow direction, and exercise independent click, drag, reorder, drop, and selection settings."
        code={`
<UI.GridView
  flowDirection={flowDirection}
  isItemClickEnabled={itemClickEnabled}
  canDragItems={canDragItems}
  canReorderItems={canReorderItems}
  allowDrop={allowDrop}
  selectionMode={selectionMode}
/>
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock text={invocationStatus} />
            <UI.TextBlock text={selectionStatus} />
          </UI.StackPanel>
        }
        options={
          <UI.StackPanel spacing={10}>
            <GalleryComboBox
              header={<UI.TextBlock text="ItemTemplate" />}
              selectedIndex={templateIndex}
              onSelectedIndexChange={(index) => {
                templateIndex.value = index
                context.model.recordInteraction()
              }}
              minWidth={190}
            >
              {templateNames.map((name) => (
                <UI.TextBlock key={name} text={name} />
              ))}
            </GalleryComboBox>
            <UI.Button
              onClick={() => {
                rightToLeft.value = !rightToLeft.value
                context.model.recordInteraction()
              }}
            >
              {computed(() =>
                rightToLeft.value
                  ? 'Use left-to-right flow'
                  : 'Reverse FlowDirection',
              )}
            </UI.Button>
            <UI.TextBlock
              margin={thickness(0, 8, 0, 0)}
              fontWeight={{ weight: 600 }}
              text="GridView properties"
            />
            <UI.TextBlock
              maxWidth={180}
              fontSize={13}
              text="Enable drag, reorder, and drop together to rearrange items."
              textWrapping={TextWrapping.Wrap}
            />
            <UI.CheckBox
              isChecked={itemClickEnabled}
              onChecked={() => {
                itemClickEnabled.value = true
                invocationStatus.value = ''
              }}
              onUnchecked={() => {
                itemClickEnabled.value = false
                invocationStatus.value = ''
              }}
            >
              IsItemClickEnabled
            </UI.CheckBox>
            <UI.CheckBox
              isChecked={canDragItems}
              onChecked={() => {
                canDragItems.value = true
              }}
              onUnchecked={() => {
                canDragItems.value = false
              }}
            >
              CanDragItems
            </UI.CheckBox>
            <UI.CheckBox
              isChecked={canReorderItems}
              onChecked={() => {
                canReorderItems.value = true
              }}
              onUnchecked={() => {
                canReorderItems.value = false
              }}
            >
              CanReorderItems
            </UI.CheckBox>
            <UI.CheckBox
              isChecked={allowDrop}
              onChecked={() => {
                allowDrop.value = true
              }}
              onUnchecked={() => {
                allowDrop.value = false
              }}
            >
              AllowDrop
            </UI.CheckBox>
            <GalleryComboBox
              header={<UI.TextBlock text="SelectionMode" />}
              selectedIndex={selectionModeIndex}
              onSelectedIndexChange={(index) => {
                selectionModeIndex.value = index
                if (index === 0) {
                  selectionStatus.value = ''
                }
              }}
              minWidth={180}
            >
              {selectionModes.map(([name]) => (
                <UI.TextBlock key={name} text={name} />
              ))}
            </GalleryComboBox>
          </UI.StackPanel>
        }
      >
        <UI.GridView
          ref={contentGrid}
          maxHeight={440}
          horizontalAlignment={HorizontalAlignment.Stretch}
          flowDirection={computed(() =>
            rightToLeft.value
              ? FlowDirection.RightToLeft
              : FlowDirection.LeftToRight,
          )}
          isItemClickEnabled={itemClickEnabled}
          canDragItems={canDragItems}
          canReorderItems={canReorderItems}
          allowDrop={allowDrop}
          selectionMode={computed(
            () =>
              selectionModes[selectionModeIndex.value]?.[1] ??
              ListViewSelectionMode.Single,
          )}
          onItemClick={(_sender, args) => {
            const title = readClickedTitle(args)
            invocationStatus.value = title
              ? `You clicked ${title}.`
              : 'You clicked an item.'
            context.model.recordInteraction()
          }}
          onSelectionChanged={() => {
            selectionStatus.value =
              `You have selected ${contentGrid.current?.selectedItems.size ?? 0} item(s).`
            context.model.recordInteraction()
          }}
        >
          {items.map((item) => (
            <UI.GridViewItem
              key={item.id}
              automationName={item.title}
              name={item.title}
              horizontalContentAlignment={HorizontalAlignment.Stretch}
            >
              <ContentTemplate
                item={item}
                templateIndex={templateIndex}
              />
            </UI.GridViewItem>
          ))}
        </UI.GridView>
      </SampleCard>
    </Page>
  )
}
