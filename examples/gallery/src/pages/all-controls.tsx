import {
  computed,
  gridLength,
  signal,
  styles,
  theme,
  thickness,
  tokens,
  type MaybeSignal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  HorizontalAlignment,
  ItemsView,
  ItemsViewSelectionMode,
  Orientation,
  Stretch,
  TextTrimming,
  TextWrapping,
  UniformGridLayout,
  VerticalAlignment,
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
  type GalleryRoute,
} from '../gallery-data'
import { loadGalleryBitmap } from '../gallery-assets'

type CatalogItem = GalleryPageInfo & {
  readonly enabled: boolean
}

function CatalogCard(props: {
  readonly context: AppContext
  readonly page: CatalogItem
  readonly width: MaybeSignal<number>
  readonly height: MaybeSignal<number>
}) {
  const image = loadGalleryBitmap(
    props.page.image,
    32,
    props.context.ownProjected,
  )
  return (
    <UI.Button
      automationId={`GalleryOpenPage-${props.page.id}`}
      automationName={`Open ${props.page.title}`}
      isEnabled={props.page.enabled}
      width={props.width}
      height={props.height}
      padding={thickness(8)}
      background={theme.controlFill}
      borderBrush={theme.cardStroke}
      borderThickness={thickness(1)}
      cornerRadius={tokens.radius.overlay}
      horizontalContentAlignment={HorizontalAlignment.Stretch}
      onClick={() => {
        if (props.page.enabled) {
          props.context.model.navigate(
            props.page.id as GalleryRoute,
          )
        }
      }}
    >
      <LayoutGrid
        columnDefinitions={[
          gridLength.pixel(56),
          gridLength.star(),
        ]}
        rowDefinitions={[
          gridLength.auto(),
          gridLength.auto(),
        ]}
      >
        <UI.Border
          gridRowSpan={2}
          width={32}
          height={32}
          margin={thickness(8, 12, 16, 0)}
          verticalAlignment={VerticalAlignment.Top}
        >
          <UI.Image
            source={image}
            stretch={Stretch.Uniform}
            width={32}
            height={32}
          />
        </UI.Border>
        <UI.TextBlock
          {...styles.heading({ level: 'bodyStrong' })}
          gridColumn={1}
          margin={thickness(0, 12, 0, 0)}
          verticalAlignment={VerticalAlignment.Bottom}
          text={props.page.title}
          textWrapping={TextWrapping.NoWrap}
        />
        <UI.TextBlock
          gridRow={1}
          gridColumn={1}
          margin={thickness(0, 0, 10, 10)}
          verticalAlignment={VerticalAlignment.Top}
          foreground={theme.secondaryText}
          text={props.page.description}
          textTrimming={TextTrimming.CharacterEllipsis}
          textWrapping={TextWrapping.NoWrap}
        />
      </LayoutGrid>
    </UI.Button>
  )
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
          <CatalogCard
            context={context}
            page={page as CatalogItem}
            width={cardWidth}
            height={cardHeight}
          />
        )}
      </GalleryItemsView>
    </LayoutGrid>
  )
}
