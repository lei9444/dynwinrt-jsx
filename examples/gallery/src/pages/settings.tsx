import { useContext, type RefObject } from 'dynwinrt-jsx'
import { type AppContext, type ToggleInstance, ThemeControllerContext, UI } from '../gallery-ui'
import { Card, Page } from '../components/gallery-components'

export function SettingsPage(context: AppContext) {
  const themeController = useContext(ThemeControllerContext)
  const toggle: RefObject<ToggleInstance> = { current: null }
  return (
    <Page
      title="Settings"
      subtitle="Theme and gallery runtime preferences."
      automationId="SettingsPageHeading"
    >
      <Card>
        <UI.StackPanel spacing={12}>
          <UI.ToggleSwitch
            ref={toggle}
            automationId="GalleryThemeToggle"
            header="Dark theme"
            isOn={context.model.darkTheme}
            onToggled={() => {
              const isOn =
                toggle.current?.isOn ??
                context.model.darkTheme.value
              if (!themeController) {
                throw new Error(
                  'Theme controller is unavailable.',
                )
              }
              themeController.setDark(isOn)
            }}
          />
          <UI.TextBlock text={context.model.interactionText} />
        </UI.StackPanel>
      </Card>
    </Page>
  )
}
