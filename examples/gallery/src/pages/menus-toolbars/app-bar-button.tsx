import {
  createSymbolIcon,
  signal,
} from 'dynwinrt-jsx'
import { Symbol, SymbolIcon } from '#winapp/bindings'
import {
  type AppContext,
  GalleryAppBarButton,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function AppBarButtonPage(context: AppContext) {
  const status = signal('No command selected.')

  return (
    <Page
      title="AppBarButton"
      subtitle="A labeled icon command for app bars and command surfaces."
      automationId="AppBarButtonPageHeading"
      pageId="app-bar-button"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryMenusAppBarButtonBasicSample"
        title="Icon, label, and tooltip"
        description="Use native app bar command presentation with a generated icon and attached tooltip."
        code={`
<UI.AppBarButton
  icon={createSymbolIcon(SymbolIcon, Symbol.Add)}
  label="Add"
  toolTip="Add an item"
/>
        `}
        output={<UI.TextBlock text={status} />}
      >
        <UI.AppBarButton
          automationId="GalleryAppBarButtonBasic"
          icon={createSymbolIcon(SymbolIcon, Symbol.Add)}
          label="Add"
          toolTip="Add an item"
        />
      </SampleCard>
      <SampleCard
        automationId="GalleryMenusAppBarButtonFlyoutSample"
        title="Attach a MenuFlyout"
        description="The AppBarButton adapter owns a FlyoutBase child through its native flyout property."
        code={`
<GalleryAppBarButton label="Share">
  <UI.MenuFlyout>
    <UI.MenuFlyoutItem text="Mail" />
    <UI.MenuFlyoutItem text="Link" />
  </UI.MenuFlyout>
</GalleryAppBarButton>
        `}
      >
        <GalleryAppBarButton
          automationId="GalleryAppBarButtonFlyout"
          icon={createSymbolIcon(SymbolIcon, Symbol.Share)}
          label="Share"
        >
          <UI.MenuFlyout>
            <UI.MenuFlyoutItem
              automationId="GalleryAppBarButtonMail"
              text="Mail"
              onClick={() => {
                status.value = 'Share with Mail selected.'
              }}
            />
            <UI.MenuFlyoutItem
              text="Copy link"
              onClick={() => {
                status.value = 'Copy link selected.'
              }}
            />
          </UI.MenuFlyout>
        </GalleryAppBarButton>
      </SampleCard>
    </Page>
  )
}
