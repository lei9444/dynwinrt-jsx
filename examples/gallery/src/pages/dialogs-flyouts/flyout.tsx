import {
  onCleanup,
  showFlyout,
  signal,
  type FlyoutController,
  type RefObject,
} from 'dynwinrt-jsx'
import { Flyout, TextWrapping } from '#winapp/bindings'
import {
  type AppContext,
  type ButtonInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function FlyoutPage(context: AppContext) {
  const target: RefObject<ButtonInstance> = { current: null }
  const status = signal('The cart still contains its items.')
  let controller: FlyoutController<Flyout> | null = null
  onCleanup(() => {
    controller?.dispose()
  })

  return (
    <Page
      title="Flyout"
      subtitle="Lightweight contextual UI anchored to a target control."
      automationId="FlyoutPageHeading"
      pageId="flyout"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryDialogsFlyoutSample"
        title="Confirm an action in a Flyout"
        description="The owned content is released when the flyout closes or its controller is disposed."
        code={`
const controller = showFlyout(
  renderer,
  new Flyout(),
  target,
  <ConfirmationContent />,
  { xamlRoot: window.content.xamlRoot },
)
        `}
        output={
          <UI.TextBlock
            automationId="GalleryFlyoutResult"
            text={status}
          />
        }
      >
        <UI.Button
          ref={target}
          automationId="GalleryFlyoutShow"
          onClick={() => {
            const currentTarget = target.current
            if (!currentTarget) {
              return
            }
            controller?.dispose()
            const flyout = new Flyout()
            controller = showFlyout(
              context.renderer,
              flyout,
              currentTarget,
              <UI.StackPanel spacing={12}>
                <UI.TextBlock
                  text="All items will be removed. Do you want to continue?"
                  textWrapping={TextWrapping.Wrap}
                />
                <UI.Button
                  automationId="GalleryFlyoutConfirm"
                  onClick={() => {
                    status.value = 'Cart emptied.'
                    controller?.hide()
                  }}
                >
                  Yes, empty my cart
                </UI.Button>
              </UI.StackPanel>,
              {
                xamlRoot: context.window.content.xamlRoot,
                onClosed: () => {
                  if (status.value !== 'Cart emptied.') {
                    status.value = 'Flyout dismissed.'
                  }
                },
              },
            )
            context.model.recordInteraction()
          }}
        >
          Empty cart
        </UI.Button>
      </SampleCard>
    </Page>
  )
}
