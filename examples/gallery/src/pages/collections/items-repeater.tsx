import {
  computed,
  signal,
  styles,
  theme,
  thickness,
} from 'dynwinrt-jsx'
import {
  HorizontalAlignment,
  Orientation,
  ScrollBarVisibility,
  StackLayout,
  TextWrapping,
  UniformGridLayout,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  GalleryItemsRepeater,
  UI,
} from '../../gallery-ui'
import {
  Page,
  SampleCard,
} from '../../components/gallery-components'

interface RepeaterRow {
  readonly id: number
  readonly title: string
  readonly detail: string
}

function createStackLayout(
  orientation: Orientation,
  spacing: number,
) {
  const layout = new StackLayout()
  layout.orientation = orientation
  layout.spacing = spacing
  return layout
}

export function ItemsRepeaterPage(context: AppContext) {
  let nextId = 7
  const rows = signal<readonly RepeaterRow[]>(
    Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      title: `Item ${index + 1}`,
      detail: `${(index + 1) * 12} units`,
    })),
  )
  const layoutIndex = signal(0)
  const verticalLayout = createStackLayout(
    Orientation.Vertical,
    8,
  )
  const horizontalLayout = createStackLayout(
    Orientation.Horizontal,
    8,
  )
  const uniformLayout = new UniformGridLayout()
  uniformLayout.minItemWidth = 150
  uniformLayout.minItemHeight = 72
  uniformLayout.minRowSpacing = 8
  uniformLayout.minColumnSpacing = 8
  uniformLayout.maximumRowsOrColumns = 3
  const layouts = [
    verticalLayout,
    horizontalLayout,
    uniformLayout,
  ] as const

  const virtualRows = signal(
    Array.from({ length: 500 }, (_, id) => ({
      id,
      title: `Virtual row ${id + 1}`,
      detail:
        id % 3 === 0
          ? 'This row is taller to demonstrate dynamic measurement.'
          : 'Recycled native row.',
    })),
  )
  const virtualLayout = createStackLayout(
    Orientation.Vertical,
    8,
  )
  const mixedLayout = new UniformGridLayout()
  mixedLayout.minItemWidth = 160
  mixedLayout.minItemHeight = 100
  mixedLayout.minRowSpacing = 8
  mixedLayout.minColumnSpacing = 8
  const mixedItems = [
    42,
    'WinUI',
    108,
    'TypeScript',
    256,
    'ItemsRepeater',
  ] as const
  const categoryLayout = createStackLayout(
    Orientation.Vertical,
    12,
  )
  const categories = [
    {
      id: 'recent',
      title: 'Recent',
      items: ['Alpha', 'Beta', 'Gamma'],
      layout: createStackLayout(Orientation.Horizontal, 8),
    },
    {
      id: 'favorites',
      title: 'Favorites',
      items: ['Delta', 'Epsilon', 'Zeta'],
      layout: createStackLayout(Orientation.Horizontal, 8),
    },
  ] as const

  return (
    <Page
      title="ItemsRepeater"
      subtitle="Create flexible virtualized layouts while preserving keyed JSX item identity."
      automationId="ItemsRepeaterPageHeading"
      pageId="items-repeater"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryCollectionsItemsRepeaterSample"
        title="Items and swappable layouts"
        description="Add or remove source items and switch the same keyed collection between vertical, horizontal, and uniform-grid layouts."
        code={`
<GalleryItemsRepeater
  each={rows}
  key={(row) => row.id}
  layout={computed(() => layouts[layoutIndex.value])}
>
  {(row) => <Row row={row} />}
</GalleryItemsRepeater>
        `}
        options={
          <UI.StackPanel spacing={12}>
            <UI.Button
              automationId="GalleryCollectionsRepeaterAdd"
              onClick={() => {
                const id = nextId
                nextId += 1
                rows.value = [
                  ...rows.value,
                  {
                    id,
                    title: `Item ${id}`,
                    detail: `${id * 12} units`,
                  },
                ]
                context.model.recordInteraction()
              }}
            >
              Add Item
            </UI.Button>
            <UI.Button
              onClick={() => {
                if (rows.value.length === 0) {
                  return
                }
                rows.value = rows.value.slice(0, -1)
                context.model.recordInteraction()
              }}
            >
              Remove Item
            </UI.Button>
            <GalleryComboBox
              header={<UI.TextBlock text="Layout" />}
              selectedIndex={layoutIndex}
              onSelectedIndexChange={(index) => {
                layoutIndex.value = index
                context.model.recordInteraction()
              }}
              minWidth={200}
            >
              <UI.TextBlock text="StackLayout - Vertical" />
              <UI.TextBlock text="StackLayout - Horizontal" />
              <UI.TextBlock text="UniformGridLayout" />
            </GalleryComboBox>
          </UI.StackPanel>
        }
      >
        <UI.ScrollViewer
          maxHeight={360}
          horizontalScrollBarVisibility={ScrollBarVisibility.Auto}
          verticalScrollBarVisibility={ScrollBarVisibility.Auto}
        >
          <GalleryItemsRepeater
            each={rows}
            key={(row) => row.id}
            layout={computed(
              () => layouts[layoutIndex.value] ?? verticalLayout,
            )}
          >
            {(row) => (
              <UI.Border
                {...styles.card({ surface: 'layer' })}
                width={computed(() =>
                  layoutIndex.value === 0 ? 520 : 160,
                )}
                padding={thickness(12)}
                horizontalAlignment={HorizontalAlignment.Stretch}
              >
                <UI.StackPanel spacing={4}>
                  <UI.TextBlock
                    {...styles.heading({
                      level: 'bodyStrong',
                    })}
                    text={row.title}
                  />
                  <UI.TextBlock
                    foreground={theme.secondaryText}
                    text={row.detail}
                  />
                </UI.StackPanel>
              </UI.Border>
            )}
          </GalleryItemsRepeater>
        </UI.ScrollViewer>
      </SampleCard>

      <SampleCard
        automationId="GalleryCollectionsVirtualizedRepeaterSample"
        title="Virtualizing scrollable list"
        description="Only rows near the viewport are realized; reversing the source preserves keyed native hosts where possible."
        code={`
<GalleryItemsRepeater
  each={virtualRows}
  key={(row) => row.id}
  layout={virtualLayout}
>
  {(row, index) => <VirtualRow row={row} index={index} />}
</GalleryItemsRepeater>
        `}
        options={
          <UI.Button
            automationId="GalleryCollectionsRepeaterReverse"
            onClick={() => {
              virtualRows.value = [...virtualRows.value].reverse()
              context.model.recordInteraction()
            }}
          >
            Reverse 500 rows
          </UI.Button>
        }
      >
        <UI.ScrollViewer
          height={360}
          verticalScrollBarVisibility={ScrollBarVisibility.Auto}
        >
          <GalleryItemsRepeater
            each={virtualRows}
            key={(row) => row.id}
            layout={virtualLayout}
            verticalCacheLength={0.5}
          >
            {(row, index) => (
              <UI.Border
                {...styles.card({ surface: 'card' })}
                padding={thickness(10)}
              >
                <UI.StackPanel spacing={4}>
                  <UI.TextBlock
                    {...styles.heading({
                      level: 'bodyStrong',
                    })}
                    text={computed(
                      () => `${index.value + 1}. ${row.title}`,
                    )}
                  />
                  <UI.TextBlock
                    text={row.detail}
                    textWrapping={TextWrapping.Wrap}
                  />
                </UI.StackPanel>
              </UI.Border>
            )}
          </GalleryItemsRepeater>
        </UI.ScrollViewer>
      </SampleCard>

      <SampleCard
        title="Mixed and nested collections"
        description="Element factories can choose JSX by item type and can nest independently virtualized repeaters."
        code={`
<GalleryItemsRepeater each={mixedItems} layout={mixedLayout}>
  {(item) => typeof item === 'number'
    ? <NumberTile value={item} />
    : <TextTile value={item} />}
</GalleryItemsRepeater>
        `}
      >
        <UI.StackPanel spacing={16}>
          <GalleryItemsRepeater
            each={mixedItems}
            key={(item, index) =>
              `${typeof item}:${String(item)}:${index}`
            }
            layout={mixedLayout}
          >
            {(item) => (
              <UI.Border
                {...styles.card({
                  surface:
                    typeof item === 'number' ? 'layer' : 'card',
                })}
                padding={thickness(14)}
              >
                <UI.TextBlock
                  {...styles.heading({
                    level: 'bodyStrong',
                  })}
                  text={
                    typeof item === 'number'
                      ? `Number: ${item}`
                      : `Text: ${item}`
                  }
                />
              </UI.Border>
            )}
          </GalleryItemsRepeater>
          <UI.ScrollViewer
            horizontalScrollBarVisibility={ScrollBarVisibility.Auto}
            verticalScrollBarVisibility={
              ScrollBarVisibility.Disabled
            }
          >
            <GalleryItemsRepeater
              each={categories}
              key={(category) => category.id}
              layout={categoryLayout}
            >
              {(category) => (
                <UI.StackPanel spacing={8}>
                  <UI.TextBlock
                    {...styles.heading({
                      level: 'bodyStrong',
                    })}
                    text={category.title}
                  />
                  <GalleryItemsRepeater
                    each={category.items}
                    key={(item) => item}
                    layout={category.layout}
                  >
                    {(item) => (
                      <UI.Button minWidth={120}>{item}</UI.Button>
                    )}
                  </GalleryItemsRepeater>
                </UI.StackPanel>
              )}
            </GalleryItemsRepeater>
          </UI.ScrollViewer>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
