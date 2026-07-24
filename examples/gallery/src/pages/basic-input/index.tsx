import {
  computed,
  gridLength,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import { Grid } from '#winapp/bindings'
import { type AppContext, LayoutGrid } from '../../gallery-ui'
import {
  Page,
  PageLink,
} from '../../components/gallery-components'
import { basicInputPages } from '../../gallery-data'

export function BasicInputCategoryPage(context: AppContext) {
  const layout: RefObject<InstanceType<typeof Grid>> = {
    current: null,
  }
  const columnCount = signal(2)
  const updateColumns = () => {
    const width = layout.current?.actualWidth
    if (width === undefined || width <= 0) {
      return
    }
    const next = width >= 960 ? 3 : width >= 640 ? 2 : 1
    if (next !== columnCount.value) {
      columnCount.value = next
    }
  }
  const columns = computed(() =>
    Array.from(
      { length: columnCount.value },
      () => gridLength.star(),
    ),
  )
  const rows = computed(() =>
    Array.from(
      {
        length: Math.ceil(
          basicInputPages.length / columnCount.value,
        ),
      },
      () => gridLength.auto(),
    ),
  )

  return (
    <Page
      title="Basic input"
      subtitle="Controls that let users invoke actions, choose values, and switch between states."
      automationId="BasicInputCategoryPageHeading"
    >
      <LayoutGrid
        ref={layout}
        columnDefinitions={columns}
        rowDefinitions={rows}
        rowSpacing={12}
        columnSpacing={12}
        onLoaded={updateColumns}
        onSizeChanged={updateColumns}
      >
        {basicInputPages.map((page, index) => (
          <PageLink
            key={page.id}
            page={page}
            model={context.model}
            height={computed(() =>
              columnCount.value === 1 ? 120 : 96,
            )}
            gridRow={computed(() =>
              Math.floor(index / columnCount.value),
            )}
            gridColumn={computed(() =>
              index % columnCount.value,
            )}
          />
        ))}
      </LayoutGrid>
    </Page>
  )
}
