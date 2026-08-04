import {
  For,
  effect,
  onCleanup,
  signal,
  theme,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  HorizontalAlignment,
  Image,
  ListViewSelectionMode,
  RefreshRequestedEventArgs,
  RefreshVisualizer,
  RefreshVisualizerState,
  releaseProjected,
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
import { loadGalleryBitmap } from '../../gallery-assets'

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
  let nextBasicId = 6
  let nextCustomId = 6
  const basicRows = signal<readonly RefreshRow[]>(
    Array.from({ length: 5 }, (_, index) => ({
      id: index + 1,
      text: `Collection item ${index + 1}`,
    })),
  )
  const customRows = signal<readonly RefreshRow[]>(
    Array.from({ length: 5 }, (_, index) => ({
      id: index + 1,
      text: `Collection item ${index + 1}`,
    })),
  )
  const status = signal('Pull down to refresh.')
  const customStatus = signal('Visualizer state: Idle')
  const customVisualizer = context.createProjected(
    () => new RefreshVisualizer(),
  )
  const sunImage = context.createProjected(() => new Image())
  sunImage.width = 35
  sunImage.height = 35
  const sunBlack = loadGalleryBitmap(
    'SampleMedia/SunBlack.png',
    35,
    context.ownProjected,
  )
  const sunWhite = loadGalleryBitmap(
    'SampleMedia/SunWhite.png',
    35,
    context.ownProjected,
  )
  effect(() => {
    sunImage.source = context.model.darkTheme.value
      ? sunWhite
      : sunBlack
  })
  customVisualizer.content = sunImage
  const basicTimer = context.createProjected(
    () => context.window.dispatcherQueue.createTimer(),
  )
  const customTimer = context.createProjected(
    () => context.window.dispatcherQueue.createTimer(),
  )
  basicTimer.interval = { duration: 8_000_000n }
  basicTimer.isRepeating = false
  customTimer.interval = { duration: 8_000_000n }
  customTimer.isRepeating = false
  type PendingRefresh = ReturnType<
    RefreshRequestedEventArgs['getDeferral']
  >
  let basicPending: PendingRefresh | null = null
  let customPending: PendingRefresh | null = null

  const finishDeferral = (deferral: PendingRefresh) => {
    const failures: unknown[] = []
    for (const action of [
      () => deferral.complete(),
      () => deferral.close(),
      () => releaseProjected(deferral),
    ]) {
      try {
        action()
      }
      catch (error) {
        failures.push(error)
      }
    }
    if (failures.length === 1) {
      throw failures[0]
    }
    if (failures.length > 1) {
      throw new AggregateError(
        failures,
        'Refresh deferral cleanup failed.',
      )
    }
  }

  onCleanup(
    basicTimer.onTick(() => {
      if (!basicPending) {
        return
      }
      const deferral = basicPending
      basicPending = null
      const id = nextBasicId
      nextBasicId += 1
      basicRows.value = [
        { id, text: `Refreshed item ${id}` },
        ...basicRows.value,
      ]
      status.value = 'Basic refresh completed.'
      finishDeferral(deferral)
    }),
  )
  onCleanup(
    customTimer.onTick(() => {
      if (!customPending) {
        return
      }
      const deferral = customPending
      customPending = null
      const id = nextCustomId
      nextCustomId += 1
      customRows.value = [
        { id, text: `Refreshed item ${id}` },
        ...customRows.value,
      ]
      finishDeferral(deferral)
    }),
  )
  onCleanup(() => {
    basicTimer.stop()
    if (basicPending) {
      const deferral = basicPending
      basicPending = null
      finishDeferral(deferral)
    }
  })
  onCleanup(() => {
    customTimer.stop()
    if (customPending) {
      const deferral = customPending
      customPending = null
      finishDeferral(deferral)
    }
  })
  onCleanup(
    customVisualizer.onRefreshStateChanged((sender) => {
      customStatus.value =
        `Visualizer state: ${refreshStateName(sender.state)}`
    }),
  )

  const handleRefresh = (
    kind: 'basic' | 'custom',
    args: RefreshRequestedEventArgs,
  ) => {
    const deferral = args.getDeferral()
    if (kind === 'basic') {
      status.value = 'Basic refresh in progress...'
      if (basicPending) {
        finishDeferral(basicPending)
      }
      basicPending = deferral
      basicTimer.start()
    }
    else {
      if (customPending) {
        finishDeferral(customPending)
      }
      customPending = deferral
      customTimer.start()
    }
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
          horizontalAlignment={HorizontalAlignment.Center}
          onRefreshRequested={(_sender, args) => {
            handleRefresh('basic', args)
          }}
        >
          <GalleryListView
            height={200}
            minWidth={200}
            borderBrush={theme.controlStroke}
            borderThickness={thickness(1)}
            selectionMode={ListViewSelectionMode.None}
          >
            <For each={basicRows} key={(row) => row.id}>
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
          horizontalAlignment={HorizontalAlignment.Center}
          visualizer={customVisualizer}
          onRefreshRequested={(_sender, args) => {
            handleRefresh('custom', args)
          }}
        >
          <GalleryListView
            height={200}
            minWidth={200}
            borderBrush={theme.controlStroke}
            borderThickness={thickness(1)}
            selectionMode={ListViewSelectionMode.None}
          >
            <For each={customRows} key={(row) => row.id}>
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
