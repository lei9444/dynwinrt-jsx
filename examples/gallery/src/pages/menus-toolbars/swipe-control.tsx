import {
  color,
  createSolidColorBrush,
  signal,
  thickness,
} from 'dynwinrt-jsx'
import {
  SolidColorBrush,
  SwipeBehaviorOnInvoked,
  SwipeMode,
  Symbol,
  SymbolIconSource,
} from '#winapp/bindings'
import {
  type AppContext,
  GallerySwipeControl,
  GallerySwipeItems,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

function iconSource(symbol: Symbol): SymbolIconSource {
  const icon = new SymbolIconSource()
  icon.symbol = symbol
  return icon
}

export function SwipeControlPage(context: AppContext) {
  const status = signal('Swipe a sample to reveal its actions.')
  const acceptBrush = createSolidColorBrush(
    SolidColorBrush,
    color(16, 124, 16),
  )
  const flagBrush = createSolidColorBrush(
    SolidColorBrush,
    color(255, 185, 0),
  )
  const deleteBrush = createSolidColorBrush(
    SolidColorBrush,
    color(196, 43, 28),
  )

  return (
    <Page
      title="SwipeControl"
      subtitle="Contextual left and right command collections for swipe gestures."
      automationId="SwipeControlPageHeading"
      pageId="swipe-control"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryMenusSwipeRevealSample"
        title="Reveal actions by swiping right"
        description="Reveal mode keeps multiple left-side commands available for invocation."
        code={`
<GallerySwipeControl
  leftItemsContent={
    <GallerySwipeItems mode={SwipeMode.Reveal}>
      <UI.SwipeItem text="Accept" />
      <UI.SwipeItem text="Flag" />
    </GallerySwipeItems>
  }
>
  <RowContent />
</GallerySwipeControl>
        `}
        output={<UI.TextBlock text={status} />}
      >
        <GallerySwipeControl
          automationId="GallerySwipeRevealControl"
          leftItemsContent={
            <GallerySwipeItems mode={SwipeMode.Reveal}>
              <UI.SwipeItem
                text="Accept"
                iconSource={iconSource(Symbol.Accept)}
                background={acceptBrush}
                onInvoked={() => {
                  status.value = 'Accept invoked.'
                  context.model.recordInteraction()
                }}
              />
              <UI.SwipeItem
                text="Flag"
                iconSource={iconSource(Symbol.Flag)}
                background={flagBrush}
                onInvoked={() => {
                  status.value = 'Flag invoked.'
                  context.model.recordInteraction()
                }}
              />
            </GallerySwipeItems>
          }
        >
          <UI.Border padding={thickness(16)}>
            <UI.TextBlock text="Swipe right to reveal actions" />
          </UI.Border>
        </GallerySwipeControl>
      </SampleCard>
      <SampleCard
        automationId="GalleryMenusSwipeExecuteSample"
        title="Execute an action by swiping left"
        description="Execute mode invokes one right-side action and closes the SwipeControl."
        code={`
<GallerySwipeItems mode={SwipeMode.Execute}>
  <UI.SwipeItem
    text="Delete"
    behaviorOnInvoked={SwipeBehaviorOnInvoked.Close}
  />
</GallerySwipeItems>
        `}
      >
        <GallerySwipeControl
          automationId="GallerySwipeExecuteControl"
          rightItemsContent={
            <GallerySwipeItems mode={SwipeMode.Execute}>
              <UI.SwipeItem
                text="Delete"
                iconSource={iconSource(Symbol.Delete)}
                background={deleteBrush}
                behaviorOnInvoked={SwipeBehaviorOnInvoked.Close}
                onInvoked={() => {
                  status.value = 'Delete invoked.'
                  context.model.recordInteraction()
                }}
              />
            </GallerySwipeItems>
          }
        >
          <UI.Border padding={thickness(16)}>
            <UI.TextBlock text="Swipe left to delete" />
          </UI.Border>
        </GallerySwipeControl>
      </SampleCard>
    </Page>
  )
}
