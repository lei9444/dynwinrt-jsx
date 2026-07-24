import {
  For,
  computed,
  signal,
  styles,
  theme,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  GridView,
  HorizontalAlignment,
  IFrameworkElement,
  ItemClickEventArgs,
  ListViewSelectionMode,
  Stretch,
  TextWrapping,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  UI,
} from '../../gallery-ui'
import {
  Page,
  SampleCard,
} from '../../components/gallery-components'
import { createCollectionPhotos } from './shared'

const selectionModes = [
  ['None', ListViewSelectionMode.None],
  ['Single', ListViewSelectionMode.Single],
  ['Multiple', ListViewSelectionMode.Multiple],
  ['Extended', ListViewSelectionMode.Extended],
] as const

function readClickedTitle(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }
  let eventArgs = value
  if (!Reflect.has(eventArgs, 'clickedItem')) {
    const fromNative = Reflect.get(
      ItemClickEventArgs,
      '_fromNative',
    )
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

export function GridViewPage(context: AppContext) {
  const photos = createCollectionPhotos(320)
  const gridView: RefObject<InstanceType<typeof GridView>> = {
    current: null,
  }
  const items = [
    ...photos,
    ...photos.map((photo) => ({
      ...photo,
      id: photo.id + photos.length,
      title: `${photo.title} II`,
    })),
  ]
  const selectionModeIndex = signal(1)
  const itemClickEnabled = signal(true)
  const canDragItems = signal(false)
  const canReorderItems = signal(false)
  const invocationStatus = signal('No item invoked.')
  const selectionStatus = signal('Selected items: 0')
  const tileWidth = signal(150)

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
        title="Item invocation and selection"
        description="GridView wraps native GridViewItem containers and exposes item click, selection, drag, and reorder behavior."
        code={`
<UI.GridView
  ref={gridView}
  isItemClickEnabled={itemClickEnabled}
  selectionMode={computed(() => selectionModes[mode.value][1])}
  onItemClick={(sender) => showItem(sender.selectedIndex)}
>
  <For each={items} key={(item) => item.id}>
    {(item) => <UI.GridViewItem>{item.title}</UI.GridViewItem>}
  </For>
</UI.GridView>
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryCollectionsGridViewStatus"
              text={invocationStatus}
              textWrapping={TextWrapping.Wrap}
            />
            <UI.TextBlock text={selectionStatus} />
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
              isChecked={itemClickEnabled}
              onChecked={() => {
                itemClickEnabled.value = true
              }}
              onUnchecked={() => {
                itemClickEnabled.value = false
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
          </UI.StackPanel>
        }
      >
        <UI.GridView
          ref={gridView}
          automationId="GalleryCollectionsGridViewControl"
          maxHeight={440}
          horizontalAlignment={HorizontalAlignment.Stretch}
          isItemClickEnabled={itemClickEnabled}
          canDragItems={canDragItems}
          canReorderItems={canReorderItems}
          allowDrop={canReorderItems}
          selectionMode={computed(
            () =>
              selectionModes[selectionModeIndex.value]?.[1] ??
              ListViewSelectionMode.Single,
          )}
          onItemClick={(_sender, args) => {
            const title = readClickedTitle(args)
            invocationStatus.value = title
              ? `Invoked: ${title}`
              : 'Invoked an item.'
            context.model.recordInteraction()
          }}
          onSelectionChanged={() => {
            selectionStatus.value =
              `Selected items: ${gridView.current?.selectedItems.size ?? 0}`
            context.model.recordInteraction()
          }}
        >
          <For each={items} key={(item) => item.id}>
            {(item) => (
              <UI.GridViewItem
                automationName={item.title}
                name={item.title}
                horizontalContentAlignment={
                  HorizontalAlignment.Stretch
                }
              >
                <UI.StackPanel
                  name={item.title}
                  width={150}
                  spacing={8}
                >
                  <UI.Image
                    source={item.source}
                    width={150}
                    height={96}
                    stretch={Stretch.UniformToFill}
                  />
                  <UI.TextBlock
                    {...styles.heading({
                      level: 'bodyStrong',
                    })}
                    margin={thickness(8, 0, 8, 8)}
                    text={item.title}
                  />
                </UI.StackPanel>
              </UI.GridViewItem>
            )}
          </For>
        </UI.GridView>
      </SampleCard>

      <SampleCard
        title="Responsive tile sizing"
        description="Changing each item width lets the native wrapping panel recalculate how many columns fit."
        code={`
const tileWidth = signal(150)
<UI.GridViewItem>
  <UI.Border width={tileWidth}>...</UI.Border>
</UI.GridViewItem>
        `}
        options={
          <UI.NumberBox
            automationId="GalleryCollectionsGridViewTileWidth"
            header="Tile width"
            minimum={100}
            maximum={240}
            smallChange={10}
            value={150}
            onValueChanged={(sender) => {
              if (
                Number.isFinite(sender.value) &&
                sender.value !== tileWidth.value
              ) {
                tileWidth.value = sender.value
              }
            }}
          />
        }
      >
        <UI.GridView
          maxHeight={360}
          selectionMode={ListViewSelectionMode.None}
          horizontalAlignment={HorizontalAlignment.Stretch}
        >
          {photos.map((photo) => (
            <UI.GridViewItem key={photo.id}>
              <UI.Border
                {...styles.card({ surface: 'layer' })}
                width={tileWidth}
                padding={thickness(10)}
              >
                <UI.StackPanel spacing={8}>
                  <UI.Image
                    source={photo.source}
                    width={tileWidth}
                    height={80}
                    stretch={Stretch.UniformToFill}
                  />
                  <UI.TextBlock
                    foreground={theme.secondaryText}
                    text={photo.detail}
                    textWrapping={TextWrapping.Wrap}
                  />
                </UI.StackPanel>
              </UI.Border>
            </UI.GridViewItem>
          ))}
        </UI.GridView>
      </SampleCard>
    </Page>
  )
}
