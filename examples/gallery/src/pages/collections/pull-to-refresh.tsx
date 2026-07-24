import {
  For,
  onCleanup,
  signal,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  FontIcon,
  ListViewSelectionMode,
  RefreshRequestedEventArgs,
  RefreshVisualizer,
  RefreshVisualizerState,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryListView,
  type RefreshContainerInstance,
  UI,
} from '../../gallery-ui'
import {
  Page,
  SampleCard,
} from '../../components/gallery-components'

interface RefreshRow {
  readonly id: number
  readonly text: string
}

function refreshStateName(value: RefreshVisualizerState): string {
  switch (value) {
    case RefreshVisualizerState.Peeking:
      return 'Peeking'
    case RefreshVisualizerState.Interacting:
      return 'Interacting'
    case RefreshVisualizerState.Pending:
      return 'Pending'
    case RefreshVisualizerState.Refreshing:
      return 'Refreshing'
    default:
      return 'Idle'
  }
}

export function PullToRefreshPage(context: AppContext) {
  const basicContainer: RefObject<RefreshContainerInstance> = {
    current: null,
  }
  const customContainer: RefObject<RefreshContainerInstance> = {
    current: null,
  }
  let nextId = 6
  const rows = signal<readonly RefreshRow[]>(
    Array.from({ length: 5 }, (_, index) => ({
      id: index + 1,
      text: `Collection item ${index + 1}`,
    })),
  )
  const status = signal('Pull down or request a refresh.')
  const customStatus = signal('Visualizer state: Idle')
  const customVisualizer = new RefreshVisualizer()
  const sunIcon = new FontIcon()
  sunIcon.glyph = '\uE706'
  sunIcon.fontSize = 28
  customVisualizer.content = sunIcon
  onCleanup(
    customVisualizer.onRefreshStateChanged((sender) => {
      customStatus.value =
        `Visualizer state: ${refreshStateName(sender.state)}`
    }),
  )

  const handleRefresh = (
    label: string,
    args: RefreshRequestedEventArgs,
  ) => {
    const deferral = args.getDeferral()
    status.value = `${label} refresh in progress...`
    const id = nextId
    nextId += 1
    rows.value = [
      {
        id,
        text: `Refreshed item ${id}`,
      },
      ...rows.value,
    ]
    status.value = `${label} refresh completed.`
    deferral.complete()
    context.model.recordInteraction()
  }

  return (
    <Page
      title="PullToRefresh"
      subtitle="Request fresh collection data with RefreshContainer and a native refresh visualizer."
      automationId="PullToRefreshPageHeading"
      pageId="pull-to-refresh"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryCollectionsPullToRefreshSample"
        title="Basic pull-to-refresh"
        description="RefreshRequested obtains a deferral, updates the collection, and completes the native refresh operation."
        code={`
<UI.RefreshContainer
  onRefreshRequested={(_sender, args) => {
    const deferral = args.getDeferral()
    refreshItems().finally(() => deferral.complete())
  }}
>
  <GalleryListView>{items}</GalleryListView>
</UI.RefreshContainer>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryCollectionsRefreshStatus"
            text={status}
          />
        }
        options={
          <UI.Button
            automationId="GalleryCollectionsRequestRefresh"
            onClick={() => {
              basicContainer.current?.requestRefresh()
            }}
          >
            Request refresh
          </UI.Button>
        }
      >
        <UI.RefreshContainer
          ref={basicContainer}
          width={320}
          onRefreshRequested={(_sender, args) => {
            handleRefresh('Basic', args)
          }}
        >
          <GalleryListView
            height={240}
            minWidth={300}
            selectionMode={ListViewSelectionMode.None}
          >
            <For each={rows} key={(row) => row.id}>
              {(row) => (
                <UI.ListViewItem>
                  <UI.TextBlock
                    padding={thickness(10)}
                    text={row.text}
                  />
                </UI.ListViewItem>
              )}
            </For>
          </GalleryListView>
        </UI.RefreshContainer>
      </SampleCard>

      <SampleCard
        automationId="GalleryCollectionsCustomRefreshSample"
        title="Custom refresh visualizer"
        description="RefreshContainer accepts a projected RefreshVisualizer with custom UIElement content and exposes its native state changes."
        code={`
const visualizer = new RefreshVisualizer()
visualizer.content = sunIcon
<UI.RefreshContainer visualizer={visualizer}>
  <GalleryListView>{items}</GalleryListView>
</UI.RefreshContainer>
        `}
        output={<UI.TextBlock text={customStatus} />}
        options={
          <UI.Button
            automationId="GalleryCollectionsRequestCustomRefresh"
            onClick={() => {
              customContainer.current?.requestRefresh()
            }}
          >
            Request custom refresh
          </UI.Button>
        }
      >
        <UI.RefreshContainer
          ref={customContainer}
          width={320}
          visualizer={customVisualizer}
          onRefreshRequested={(_sender, args) => {
            handleRefresh('Custom', args)
          }}
        >
          <GalleryListView
            height={220}
            minWidth={300}
            selectionMode={ListViewSelectionMode.None}
          >
            <For each={rows} key={(row) => row.id}>
              {(row) => (
                <UI.ListViewItem>
                  <UI.TextBlock
                    padding={thickness(10)}
                    text={row.text}
                  />
                </UI.ListViewItem>
              )}
            </For>
          </GalleryListView>
        </UI.RefreshContainer>
      </SampleCard>
    </Page>
  )
}
