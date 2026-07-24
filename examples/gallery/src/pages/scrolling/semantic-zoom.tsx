import {
  computed,
  signal,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  GridView,
  GridViewItem,
  ListView,
  ListViewItem,
  SemanticZoom,
  SemanticZoomViewChangedEventArgs,
  TextWrapping,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryListView,
  GallerySemanticZoom,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

const groups = [
  {
    name: 'Basic input',
    description: 'Buttons, toggles, pickers, and direct input.',
  },
  {
    name: 'Collections',
    description: 'Lists, grids, trees, and virtualized items.',
  },
  {
    name: 'Layout',
    description: 'Panels and containers for arranging content.',
  },
  {
    name: 'Navigation',
    description: 'Paths, panes, pivots, selectors, and tabs.',
  },
  {
    name: 'Scrolling',
    description: 'Scroll surfaces, pagers, and semantic views.',
  },
] as const

export function SemanticZoomPage(context: AppContext) {
  const semanticZoom: RefObject<SemanticZoom> = {
    current: null,
  }
  const gridView: RefObject<GridView> = { current: null }
  const listView: RefObject<ListView> = { current: null }
  const gridItems: Array<RefObject<GridViewItem>> =
    groups.map(() => ({ current: null }))
  const listItems: Array<RefObject<ListViewItem>> =
    groups.map(() => ({ current: null }))
  const zoomedIn = signal(true)
  const selectedIndex = signal(0)
  const requireZoom = () => {
    const current = semanticZoom.current
    if (!current) {
      throw new Error('SemanticZoom is not mounted.')
    }
    return current
  }
  const projectViewChangedEventArgs = (
    value: unknown,
  ): SemanticZoomViewChangedEventArgs => {
    const project = Reflect.get(
      SemanticZoomViewChangedEventArgs,
      '_fromNative',
    )
    if (typeof project !== 'function') {
      throw new Error(
        'SemanticZoomViewChangedEventArgs native projection is unavailable.',
      )
    }
    const projected = Reflect.apply(
      project,
      SemanticZoomViewChangedEventArgs,
      [value],
    )
    if (
      !(
        projected instanceof
        SemanticZoomViewChangedEventArgs
      )
    ) {
      throw new TypeError(
        'SemanticZoom ViewChangeStarted event data could not be projected.',
      )
    }
    return projected
  }
  const mapDestination = (...args: unknown[]) => {
    const eventArgs = projectViewChangedEventArgs(args[1])
    const index = selectedIndex.peek()
    const destination =
      eventArgs.isSourceZoomedInView
        ? listItems[index]?.current
        : gridItems[index]?.current
    if (!destination) {
      throw new Error(
        `SemanticZoom destination item ${index} is not mounted.`,
      )
    }
    eventArgs.destinationItem.item = destination
  }

  return (
    <Page
      title="SemanticZoom"
      subtitle="Switches between detailed and summary views of the same collection."
      automationId="SemanticZoomPageHeading"
      pageId="semantic-zoom"
      model={context.model}
    >
      <SampleCard
        automationId="GallerySemanticZoomSample"
        title="Detailed and compact collection views"
        description="Two separately owned ISemanticZoomInformation slots hold a GridView and ListView."
        code={`
<GallerySemanticZoom
  zoomedInContent={<UI.GridView>...</UI.GridView>}
  zoomedOutContent={<GalleryListView>...</GalleryListView>}
  onViewChangeCompleted={() => syncActiveView()}
/>
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GallerySemanticZoomStatus"
              text={computed(() =>
                zoomedIn.value
                  ? 'Zoomed-in view active.'
                  : 'Zoomed-out view active.',
              )}
            />
            <UI.TextBlock
              automationId="GallerySemanticZoomSelection"
              text={computed(
                () =>
                  `Selected group: ${groups[selectedIndex.value]?.name ?? 'None'}`,
              )}
            />
          </UI.StackPanel>
        }
        options={
          <UI.StackPanel spacing={10}>
            <UI.Button
              automationId="GallerySemanticZoomToggle"
              onClick={() => {
                requireZoom().toggleActiveView()
                context.model.recordInteraction()
              }}
            >
              Toggle active view
            </UI.Button>
            <UI.Button
              automationId="GallerySemanticZoomSelectLayout"
              onClick={() => {
                selectedIndex.value = 2
                context.model.recordInteraction()
              }}
            >
              Select Layout group
            </UI.Button>
          </UI.StackPanel>
        }
      >
        <GallerySemanticZoom
          ref={semanticZoom}
          automationId="GallerySemanticZoomControl"
          height={380}
          isZoomedInViewActive
          isZoomOutButtonEnabled
          onViewChangeStarted={mapDestination}
          onViewChangeCompleted={() => {
            zoomedIn.value =
              requireZoom().isZoomedInViewActive
          }}
          zoomedInContent={
            <UI.GridView
              ref={gridView}
              selectedIndex={selectedIndex}
              onLoaded={() => {
                const current = gridView.current
                if (current) {
                  current.selectedIndex = selectedIndex.peek()
                }
              }}
              onSelectionChanged={() => {
                const next = gridView.current?.selectedIndex
                if (next !== undefined && next >= 0) {
                  selectedIndex.value = next
                }
              }}
            >
              {groups.map((group, index) => (
                <UI.GridViewItem
                  key={group.name}
                  ref={gridItems[index]!}
                  automationId={`GallerySemanticZoomIn-${group.name}`}
                >
                  <UI.Border
                    width={220}
                    minHeight={120}
                    margin={thickness(6)}
                    padding={thickness(18)}
                  >
                    <UI.StackPanel spacing={6}>
                      <UI.TextBlock
                        fontSize={20}
                        text={group.name}
                      />
                      <UI.TextBlock
                        text={group.description}
                        textWrapping={TextWrapping.Wrap}
                      />
                    </UI.StackPanel>
                  </UI.Border>
                </UI.GridViewItem>
              ))}
            </UI.GridView>
          }
          zoomedOutContent={
            <GalleryListView
              ref={listView}
              selectedIndex={selectedIndex}
              onSelectedIndexChange={(index) => {
                if (index >= 0) {
                  selectedIndex.value = index
                  context.model.recordInteraction()
                }
              }}
            >
              {groups.map((group, index) => (
                <UI.ListViewItem
                  key={group.name}
                  ref={listItems[index]!}
                  automationId={`GallerySemanticZoomOut-${group.name}`}
                >
                  <UI.TextBlock
                    fontSize={22}
                    text={group.name}
                  />
                </UI.ListViewItem>
              ))}
            </GalleryListView>
          }
        />
      </SampleCard>
    </Page>
  )
}
