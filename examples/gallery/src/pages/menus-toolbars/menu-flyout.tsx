import { createSymbolIcon, signal } from 'dynwinrt-jsx'
import { Symbol, SymbolIcon } from '#winapp/bindings'
import {
  type AppContext,
  GalleryAppBarButton,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function MenuFlyoutPage(context: AppContext) {
  const status = signal('Open a menu and choose an item.')
  const select = (value: string) => {
    status.value = value
    context.model.recordInteraction()
  }

  return (
    <Page
      title="MenuFlyout"
      subtitle="A light-dismiss menu with standard, toggle, radio, icon, and cascading items."
      automationId="MenuFlyoutPageHeading"
      pageId="menu-flyout"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryMenusMenuFlyoutBasicSample"
        title="Menu items, toggle items, and separators"
        description="Attach an owned MenuFlyout to an AppBarButton."
        code={`
<GalleryAppBarButton label="Options">
  <UI.MenuFlyout>
    <UI.MenuFlyoutItem text="Open" />
    <UI.MenuFlyoutSeparator />
    <UI.ToggleMenuFlyoutItem text="Auto save" />
  </UI.MenuFlyout>
</GalleryAppBarButton>
        `}
        output={<UI.TextBlock text={status} />}
      >
        <GalleryAppBarButton
          automationId="GalleryMenuFlyoutBasicShow"
          icon={createSymbolIcon(SymbolIcon, Symbol.More)}
          label="Options"
        >
          <UI.MenuFlyout>
            <UI.MenuFlyoutItem
              automationId="GalleryMenuFlyoutOpen"
              text="Open"
              icon={createSymbolIcon(SymbolIcon, Symbol.OpenFile)}
              onClick={() => select('Open selected.')}
            />
            <UI.MenuFlyoutItem
              text="Save"
              icon={createSymbolIcon(SymbolIcon, Symbol.Save)}
              keyboardAcceleratorTextOverride="Ctrl+S"
              onClick={() => select('Save selected.')}
            />
            <UI.MenuFlyoutSeparator />
            <UI.ToggleMenuFlyoutItem
              text="Auto save"
              isChecked
              onClick={() => select('Auto save toggled.')}
            />
          </UI.MenuFlyout>
        </GalleryAppBarButton>
      </SampleCard>
      <SampleCard
        automationId="GalleryMenusMenuFlyoutCascadeSample"
        title="Cascading and radio menu items"
        description="Nest submenus and use GroupName for mutually exclusive choices."
        code={`
<UI.MenuFlyoutSubItem text="Send to">
  <UI.MenuFlyoutItem text="Mail" />
</UI.MenuFlyoutSubItem>
<UI.RadioMenuFlyoutItem groupName="theme" text="Light" />
        `}
      >
        <GalleryAppBarButton
          automationId="GalleryMenuFlyoutCascadeShow"
          icon={createSymbolIcon(SymbolIcon, Symbol.Send)}
          label="Send"
        >
          <UI.MenuFlyout>
            <UI.MenuFlyoutSubItem text="Send to">
              <UI.MenuFlyoutItem
                text="Mail"
                onClick={() => select('Mail selected.')}
              />
              <UI.MenuFlyoutItem
                text="Nearby device"
                onClick={() => select('Nearby device selected.')}
              />
            </UI.MenuFlyoutSubItem>
            <UI.MenuFlyoutSeparator />
            <UI.RadioMenuFlyoutItem
              text="Light"
              groupName="menu-theme"
              isChecked
              onClick={() => select('Light theme selected.')}
            />
            <UI.RadioMenuFlyoutItem
              text="Dark"
              groupName="menu-theme"
              onClick={() => select('Dark theme selected.')}
            />
          </UI.MenuFlyout>
        </GalleryAppBarButton>
      </SampleCard>
    </Page>
  )
}
