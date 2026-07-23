import { showContentDialog, showFlyout, styles, type RefObject } from 'dynwinrt-jsx'
import { ContentDialog, ContentDialogButton, Flyout, TextBlock } from '#winapp/bindings'
import { type AppContext, type ButtonInstance, UI } from '../gallery-ui'
import { Page, SampleCard } from '../components/gallery-components'

async function openDialog(context: AppContext) {
  const dialog = new ContentDialog()
  const title = new TextBlock()
  title.text = 'Scoped ContentDialog'
  dialog.title = title
  dialog.primaryButtonText = 'Confirm'
  dialog.closeButtonText = 'Cancel'
  dialog.defaultButton = ContentDialogButton.Primary
  await showContentDialog(
    context.renderer,
    dialog,
    context.window.content.xamlRoot,
    <UI.StackPanel spacing={8}>
      <UI.TextBlock text="This JSX subtree is owned by the dialog operation." />
      <UI.TextBlock text="It is disposed when the native dialog closes." />
    </UI.StackPanel>,
  )
  context.model.recordInteraction()
}

export function OverlaysPage(context: AppContext) {
  const flyoutTarget: RefObject<ButtonInstance> = {
    current: null,
  }
  return (
    <Page
      title="Dialogs and flyouts"
      subtitle="Overlay content has an explicit native and reactive lifetime."
      automationId="OverlaysPageHeading"
      pageId="overlays"
      model={context.model}
    >
      <SampleCard
        title="Flyout"
        description="The content scope is released from the native Closed event."
        code={`
const flyout = new Flyout()
showFlyout(renderer, flyout, target, <UI.TextBlock text="Scoped content" />)
        `}
      >
        <UI.Button
          ref={flyoutTarget}
          onClick={() => {
            const target = flyoutTarget.current
            if (!target) {
              return
            }
            showFlyout(
              context.renderer,
              new Flyout(),
              target,
              <UI.StackPanel spacing={8}>
                <UI.TextBlock text="Native Flyout" />
                <UI.TextBlock text="Owned JSX content" />
              </UI.StackPanel>,
            )
            context.model.recordInteraction()
          }}
        >
          Show flyout
        </UI.Button>
      </SampleCard>
      <SampleCard
        title="ContentDialog"
        description="The asynchronous dialog controller owns cleanup and focus restoration."
        code={`
await showContentDialog(
  renderer,
  dialog,
  window.content.xamlRoot,
  <DialogContent />,
)
        `}
      >
        <UI.Button
          {...styles.button({ variant: 'accent' })}
          onClick={() => void openDialog(context)}
        >
          Show dialog
        </UI.Button>
      </SampleCard>
    </Page>
  )
}
