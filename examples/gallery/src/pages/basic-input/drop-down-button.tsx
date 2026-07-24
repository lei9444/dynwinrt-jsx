import { computed, createSymbolIcon, signal } from 'dynwinrt-jsx'
import { Symbol, SymbolIcon } from '#winapp/bindings'
import {
  type AppContext,
  GalleryDropDownButton,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function DropDownButtonPage(context: AppContext) {
  const selected = signal('No command selected')
  const mailIcon = createSymbolIcon(SymbolIcon, Symbol.Mail)
  const sendIcon = createSymbolIcon(SymbolIcon, Symbol.Send)
  const replyIcon = createSymbolIcon(SymbolIcon, Symbol.MailReply)
  const replyAllIcon = createSymbolIcon(
    SymbolIcon,
    Symbol.MailReplyAll,
  )

  const select = (command: string) => {
    selected.value = command
    context.model.recordInteraction()
  }

  return (
    <Page
      title="DropDownButton"
      subtitle="Attach an owned menu flyout to a text or icon button."
      automationId="DropDownButtonPageHeading"
      pageId="drop-down-button"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryBasicInputDropDownButtonSample"
        title="Text menu"
        description="MenuFlyoutItem Click events update the selected command."
        code={`
<GalleryDropDownButton content="Email">
  <UI.MenuFlyout>
    <UI.MenuFlyoutItem text="Send" onClick={() => select('Send')} />
    <UI.MenuFlyoutItem text="Reply" onClick={() => select('Reply')} />
  </UI.MenuFlyout>
</GalleryDropDownButton>
        `}
      >
        <UI.StackPanel spacing={12}>
          <GalleryDropDownButton
            automationId="GalleryBasicInputDropDownButtonControl"
            content="Email"
          >
            <UI.MenuFlyout>
              <UI.MenuFlyoutItem
                automationId="GalleryBasicInputDropDownSend"
                text="Send"
                onClick={() => select('Send')}
              />
              <UI.MenuFlyoutItem
                text="Reply"
                onClick={() => select('Reply')}
              />
              <UI.MenuFlyoutItem
                text="Reply all"
                onClick={() => select('Reply all')}
              />
            </UI.MenuFlyout>
          </GalleryDropDownButton>
          <UI.TextBlock
            text={computed(() => `Selected: ${selected.value}`)}
          />
        </UI.StackPanel>
      </SampleCard>
      <SampleCard
        title="Icon menu"
        description="Native SymbolIcon instances provide compact button and menu-item icons."
        code={`
<GalleryDropDownButton content={mailIcon}>
  <UI.MenuFlyout>
    <UI.MenuFlyoutItem text="Send" icon={sendIcon} />
  </UI.MenuFlyout>
</GalleryDropDownButton>
        `}
      >
        <GalleryDropDownButton
          content={mailIcon}
          automationName="Email commands"
        >
          <UI.MenuFlyout>
            <UI.MenuFlyoutItem
              text="Send"
              icon={sendIcon}
              onClick={() => select('Send with icon')}
            />
            <UI.MenuFlyoutItem
              text="Reply"
              icon={replyIcon}
              onClick={() => select('Reply with icon')}
            />
            <UI.MenuFlyoutItem
              text="Reply all"
              icon={replyAllIcon}
              onClick={() => select('Reply all with icon')}
            />
          </UI.MenuFlyout>
        </GalleryDropDownButton>
      </SampleCard>
    </Page>
  )
}
