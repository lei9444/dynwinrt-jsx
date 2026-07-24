import {
  onCleanup,
  signal,
  thickness,
} from 'dynwinrt-jsx'
import {
  ICommand,
  PropertyValue,
  StandardUICommand,
  StandardUICommandKind,
  SwipeMode,
} from '#winapp/bindings'
import {
  type AppContext,
  GallerySwipeControl,
  GallerySwipeItems,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function StandardUICommandPage(context: AppContext) {
  const status = signal('Invoke the shared Delete command.')
  const deleteCommand = new StandardUICommand(
    StandardUICommandKind.Delete,
  )
  const command = deleteCommand.as(ICommand)
  const unsubscribe = deleteCommand.onExecuteRequested(() => {
    status.value = 'Delete command executed.'
    context.model.recordInteraction()
  })
  onCleanup(unsubscribe)

  return (
    <Page
      title="StandardUICommand"
      subtitle="A platform-defined command shared across multiple command surfaces."
      automationId="StandardUICommandPageHeading"
      pageId="standard-ui-command"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryMenusStandardUICommandSample"
        title="Expose one Delete command in multiple controls"
        description="The platform supplies the command label, icon, description, and accelerator."
        code={`
const deleteCommand = new StandardUICommand(
  StandardUICommandKind.Delete,
)
const command = deleteCommand.as(ICommand)
<UI.Button command={command}>Delete</UI.Button>
<UI.MenuFlyoutItem command={command} />
<UI.SwipeItem command={command} />
        `}
        output={
          <UI.TextBlock
            automationId="GalleryStandardUICommandStatus"
            text={status}
          />
        }
      >
        <UI.StackPanel spacing={12}>
          <UI.Button
            automationId="GalleryStandardUICommandButton"
            command={command}
            commandParameter={PropertyValue.createString(
              'AppBarButton',
            )}
          >
            Delete
          </UI.Button>
          <UI.MenuBar>
            <UI.MenuBarItem title="Edit">
              <UI.MenuFlyoutItem
                text="Delete"
                command={command}
                commandParameter={PropertyValue.createString(
                  'MenuFlyoutItem',
                )}
              />
            </UI.MenuBarItem>
          </UI.MenuBar>
          <GallerySwipeControl
            rightItemsContent={
              <GallerySwipeItems mode={SwipeMode.Execute}>
                <UI.SwipeItem
                  text="Delete"
                  command={command}
                  commandParameter={PropertyValue.createString(
                    'SwipeItem',
                  )}
                />
              </GallerySwipeItems>
            }
          >
            <UI.Border padding={thickness(12)}>
              <UI.TextBlock text="Swipe left for the shared Delete command" />
            </UI.Border>
          </GallerySwipeControl>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
