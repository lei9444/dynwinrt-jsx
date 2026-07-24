import { createSymbolIcon, signal } from 'dynwinrt-jsx'
import {
  CommandBarDefaultLabelPosition,
  Symbol,
  SymbolIcon,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryCommandBar,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function AppBarSeparatorPage(context: AppContext) {
  const status = signal('Open the overflow menu to see the separator.')

  return (
    <Page
      title="AppBarSeparator"
      subtitle="A non-interactive divider between related app bar commands."
      automationId="AppBarSeparatorPageHeading"
      pageId="app-bar-separator"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryMenusAppBarSeparatorSample"
        title="Separate secondary CommandBar commands"
        description="The separator participates in the owned secondaryCommands collection."
        code={`
<GalleryCommandBar
  secondaryCommands={[
    <UI.AppBarButton label="Settings" />,
    <UI.AppBarSeparator />,
    <UI.AppBarButton label="About" />,
  ]}
/>
        `}
        output={<UI.TextBlock text={status} />}
      >
        <GalleryCommandBar
          automationId="GalleryAppBarSeparatorCommandBar"
          defaultLabelPosition={CommandBarDefaultLabelPosition.Right}
          secondaryCommands={[
            <UI.AppBarButton
              key="settings"
              label="Settings"
              icon={createSymbolIcon(SymbolIcon, Symbol.Setting)}
            />,
            <UI.AppBarSeparator key="separator" />,
            <UI.AppBarButton
              key="about"
              label="About"
              icon={createSymbolIcon(SymbolIcon, Symbol.Help)}
            />,
          ]}
        >
          <UI.AppBarButton
            label="Add"
            icon={createSymbolIcon(SymbolIcon, Symbol.Add)}
          />
        </GalleryCommandBar>
      </SampleCard>
    </Page>
  )
}
