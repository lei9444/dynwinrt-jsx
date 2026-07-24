import { createSymbolIcon, signal } from 'dynwinrt-jsx'
import { Symbol, SymbolIcon } from '#winapp/bindings'
import {
  type AppContext,
  GalleryAppBarButton,
  GalleryCommandBarFlyout,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function CommandBarFlyoutPage(context: AppContext) {
  const status = signal('Open the flyout and choose a command.')

  return (
    <Page
      title="CommandBarFlyout"
      subtitle="Contextual primary and secondary command collections."
      automationId="CommandBarFlyoutPageHeading"
      pageId="command-bar-flyout"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryMenusCommandBarFlyoutSample"
        title="Attach a CommandBarFlyout"
        description="The flyout and both command collections are owned by the target AppBarButton."
        code={`
<GalleryAppBarButton label="Open commands">
  <GalleryCommandBarFlyout
    secondaryCommands={<UI.AppBarButton label="Settings" />}
  >
    <UI.AppBarButton label="Copy" />
    <UI.AppBarButton label="Share" />
  </GalleryCommandBarFlyout>
</GalleryAppBarButton>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryCommandBarFlyoutStatus"
            text={status}
          />
        }
      >
        <GalleryAppBarButton
          automationId="GalleryCommandBarFlyoutShow"
          icon={createSymbolIcon(SymbolIcon, Symbol.OpenWith)}
          label="Open commands"
        >
          <GalleryCommandBarFlyout
            secondaryCommands={[
              <UI.AppBarButton
                key="settings"
                automationId="GalleryCommandBarFlyoutSettings"
                label="Settings"
                icon={createSymbolIcon(SymbolIcon, Symbol.Setting)}
              />,
              <UI.AppBarButton
                key="help"
                label="Help"
                icon={createSymbolIcon(SymbolIcon, Symbol.Help)}
              />,
            ]}
          >
            <UI.AppBarButton
              automationId="GalleryCommandBarFlyoutCopy"
              label="Copy"
              icon={createSymbolIcon(SymbolIcon, Symbol.Copy)}
            />
            <UI.AppBarButton
              label="Share"
              icon={createSymbolIcon(SymbolIcon, Symbol.Share)}
            />
          </GalleryCommandBarFlyout>
        </GalleryAppBarButton>
      </SampleCard>
    </Page>
  )
}
