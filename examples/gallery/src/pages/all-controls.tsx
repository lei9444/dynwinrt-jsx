import {
  computed,
  gridLength,
  signal,
  styles,
  thickness,
  tokens,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  HorizontalAlignment,
  ScrollBarVisibility,
} from '#winapp/bindings'
import {
  LayoutGrid,
  UI,
  type AppContext,
  type ScrollViewerInstance,
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
  const scrollViewer: RefObject<ScrollViewerInstance> = {
    current: null,
  }
  const layoutWidth = signal(1100)
  const updateLayout = () => {
    const width = scrollViewer.current?.actualWidth
    if (width !== undefined && width > 0) {
      layoutWidth.value = width
    }
  }
  const narrow = computed(() => layoutWidth.value < 640)
  const columnCount = computed(() => {
    if (narrow.value) {
      return 1
    }
    return Math.max(
      1,
      Math.floor(
        (layoutWidth.value - 48 + 12) / 312,
      ),
    )
  })
  const columns = computed(() =>
    Array.from(
      { length: columnCount.value },
      () =>
        narrow.value
          ? gridLength.star()
          : gridLength.pixel(300),
    ),
  )
  const rows = computed(() =>
    Array.from(
      {
        length: Math.ceil(
          allControlsPages.length /
          columnCount.value,
        ),
      },
      () => gridLength.auto(),
    ),
  )
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
      <UI.ScrollViewer
        ref={scrollViewer}
        gridRow={1}
        horizontalScrollBarVisibility={
          ScrollBarVisibility.Disabled
        }
        verticalScrollBarVisibility={
          ScrollBarVisibility.Auto
        }
        onLoaded={updateLayout}
        onSizeChanged={updateLayout}
      >
        <LayoutGrid
          automationId="ItemGridView"
          automationName="Items In Group"
          padding={computed(() =>
            narrow.value
              ? thickness(16, 16, 16, 36)
              : thickness(24, 16, 24, 36),
          )}
          columnDefinitions={columns}
          rowDefinitions={rows}
          rowSpacing={12}
          columnSpacing={12}
          horizontalAlignment={HorizontalAlignment.Stretch}
        >
          {allControlsPages.map((page, index) => (
            <PageLink
              key={page.id}
              page={page as GalleryPageInfo}
              model={context.model}
              catalog
              enabled={(page as CatalogItem).enabled}
              ownProjected={context.ownProjected}
              width={cardWidth}
              height={cardHeight}
              gridRow={computed(() =>
                Math.floor(
                  index / columnCount.value,
                ),
              )}
              gridColumn={computed(() =>
                index % columnCount.value,
              )}
            />
          ))}
        </LayoutGrid>
      </UI.ScrollViewer>
    </LayoutGrid>
  )
}
