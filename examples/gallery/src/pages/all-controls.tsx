import {
  computed,
  gridLength,
  signal,
  styles,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  HorizontalAlignment,
  ItemsView,
  ItemsViewSelectionMode,
  Orientation,
  UniformGridLayout,
} from '#winapp/bindings'
import {
  GalleryItemsView,
  LayoutGrid,
  UI,
  type AppContext,
} from '../gallery-ui'
import {
  allControlsPages,
  type GalleryPageInfo,
} from '../gallery-data'
import { PageLink } from '../components/gallery-components'

type CatalogItem = GalleryPageInfo & {
  readonly enabled: boolean
}

export function AllControlsPage(context: AppContext) {
  const itemsView: RefObject<ItemsView> = {
    current: null,
  }
  const layoutWidth = signal(1100)
  const layout = context.createProjected(
    () => new UniformGridLayout(),
  )
  layout.orientation = Orientation.Horizontal
  layout.minItemWidth = 300
  layout.minItemHeight = 96
  layout.minColumnSpacing = 12
  layout.minRowSpacing = 12

  const updateLayout = () => {
    const width = itemsView.current?.actualWidth
    if (width === undefined || width <= 0) {
      return
    }
    layoutWidth.value = width
    const isNarrow = width < 640
    layout.minItemWidth = isNarrow
      ? Math.max(0, width - 32)
      : 300
    layout.minItemHeight = isNarrow ? 120 : 96
  }
  const narrow = computed(() => layoutWidth.value < 640)
  const columnCount = computed(() => {
    if (narrow.value) {
      return 1
    }
    return Math.max(
      1,
      Math.floor((layoutWidth.value - 48 + 12) / 312),
    )
  })
  const cardWidth = computed(() =>
    narrow.value
      ? Math.max(0, layoutWidth.value - 32)
      : 300,
  )
  const cardHeight = computed(() =>
    narrow.value ? 120 : 96,
  )

  return (
    <LayoutGrid
      rowDefinitions={[
        gridLength.auto(),
        gridLength.star(),
      ]}
    >
      <UI.TextBlock
        {...styles.heading({ level: 'title' })}
        automationId="AllControlsPageHeading"
        automationName="Controls"
        automationHeadingLevel={1}
        automationHelpText={computed(
          () =>
            `Catalog layout: ${narrow.value ? 'narrow' : 'wide'}; ` +
            `columns=${columnCount.value}; ` +
            `cardWidth=${Math.round(cardWidth.value)}; ` +
            `cardHeight=${cardHeight.value}`,
        )}
        margin={computed(() =>
          narrow.value
            ? thickness(16, 24, 16, 0)
            : thickness(36, 24, 16, 0),
        )}
        text="Controls"
      />
      <GalleryItemsView
        ref={itemsView}
        automationId="ItemGridView"
        automationName="Items In Group"
        gridRow={1}
        each={allControlsPages}
        key={(page) => page.id}
        layout={layout}
        selectionMode={ItemsViewSelectionMode.None}
        isItemInvokedEnabled={false}
        padding={computed(() =>
          narrow.value
            ? thickness(16, 16, 16, 36)
            : thickness(24, 16, 24, 36),
        )}
        horizontalAlignment={HorizontalAlignment.Stretch}
        onLoaded={updateLayout}
        onSizeChanged={updateLayout}
      >
        {(page) => (
          <PageLink
            page={page as CatalogItem}
            model={context.model}
            width={cardWidth}
            height={cardHeight}
            catalog
            enabled={(page as CatalogItem).enabled}
            ownProjected={context.ownProjected}
          />
        )}
      </GalleryItemsView>
    </LayoutGrid>
  )
}
