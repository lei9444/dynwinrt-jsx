import { onCleanup, signal } from 'dynwinrt-jsx'
import {
  ICommand,
  Symbol,
  SymbolIconSource,
  XamlUICommand,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function XamlUICommandPage(context: AppContext) {
  const status = signal('Invoke the reusable custom command.')
  const customCommand = new XamlUICommand()
  customCommand.label = 'Archive'
  customCommand.description = 'Archive the selected item.'
  const icon = new SymbolIconSource()
  icon.symbol = Symbol.Folder
  customCommand.iconSource = icon
  const command = customCommand.as(ICommand)
  const unsubscribe = customCommand.onExecuteRequested(() => {
    status.value = 'Archive command executed.'
    context.model.recordInteraction()
  })
  onCleanup(unsubscribe)

  return (
    <Page
      title="XamlUICommand"
      subtitle="A reusable custom command with shared label, description, icon, and execution."
      automationId="XamlUICommandPageHeading"
      pageId="xaml-ui-command"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryMenusXamlUICommandSample"
        title="Create and reuse a XamlUICommand"
        description="One command object supplies presentation and execution to multiple controls."
        code={`
const customCommand = new XamlUICommand()
customCommand.label = "Archive"
customCommand.description = "Archive the selected item."
customCommand.iconSource = icon
customCommand.onExecuteRequested(handleArchive)
const command = customCommand.as(ICommand)
        `}
        output={
          <UI.TextBlock
            automationId="GalleryXamlUICommandStatus"
            text={status}
          />
        }
      >
        <UI.StackPanel spacing={12}>
          <UI.Button
            automationId="GalleryXamlUICommandPrimary"
            command={command}
          >
            Archive
          </UI.Button>
          <UI.Button
            automationId="GalleryXamlUICommandSecondary"
            command={command}
          >
            Archive with Button
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
