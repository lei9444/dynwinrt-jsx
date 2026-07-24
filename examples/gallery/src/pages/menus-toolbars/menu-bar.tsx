import { signal } from 'dynwinrt-jsx'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function MenuBarPage(context: AppContext) {
  const status = signal('Choose a menu command.')

  const select = (value: string) => {
    status.value = value
    context.model.recordInteraction()
  }

  return (
    <Page
      title="MenuBar"
      subtitle="Top-level menus with nested command item collections."
      automationId="MenuBarPageHeading"
      pageId="menu-bar"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryMenusMenuBarSample"
        title="File, Edit, and View menus"
        description="Combine standard items, separators, cascading submenus, toggles, and radio choices."
        code={`
<UI.MenuBar>
  <UI.MenuBarItem title="File">
    <UI.MenuFlyoutItem text="New" />
    <UI.MenuFlyoutItem text="Open" />
  </UI.MenuBarItem>
</UI.MenuBar>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryMenuBarStatus"
            text={status}
          />
        }
      >
        <UI.MenuBar automationId="GalleryMenuBarControl">
          <UI.MenuBarItem title="File">
            <UI.MenuFlyoutItem
              automationId="GalleryMenuBarNew"
              text="New"
              keyboardAcceleratorTextOverride="Ctrl+N"
              onClick={() => select('New selected.')}
            />
            <UI.MenuFlyoutItem
              text="Open"
              keyboardAcceleratorTextOverride="Ctrl+O"
              onClick={() => select('Open selected.')}
            />
            <UI.MenuFlyoutSeparator />
            <UI.MenuFlyoutItem
              text="Exit"
              onClick={() => select('Exit selected.')}
            />
          </UI.MenuBarItem>
          <UI.MenuBarItem title="Edit">
            <UI.MenuFlyoutItem
              text="Cut"
              onClick={() => select('Cut selected.')}
            />
            <UI.MenuFlyoutItem
              text="Copy"
              onClick={() => select('Copy selected.')}
            />
            <UI.MenuFlyoutItem
              text="Paste"
              onClick={() => select('Paste selected.')}
            />
          </UI.MenuBarItem>
          <UI.MenuBarItem title="View">
            <UI.MenuFlyoutSubItem text="Zoom">
              <UI.RadioMenuFlyoutItem
                text="100%"
                groupName="menu-bar-zoom"
                isChecked
                onClick={() => select('Zoom 100% selected.')}
              />
              <UI.RadioMenuFlyoutItem
                text="150%"
                groupName="menu-bar-zoom"
                onClick={() => select('Zoom 150% selected.')}
              />
            </UI.MenuFlyoutSubItem>
            <UI.ToggleMenuFlyoutItem
              text="Status bar"
              isChecked
              onClick={() => select('Status bar toggled.')}
            />
          </UI.MenuBarItem>
        </UI.MenuBar>
      </SampleCard>
    </Page>
  )
}
