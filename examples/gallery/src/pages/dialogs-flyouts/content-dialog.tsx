import {
  computed,
  showContentDialog,
  signal,
  styles,
  type Signal,
} from 'dynwinrt-jsx'
import {
  ContentDialog,
  ContentDialogButton,
  ContentDialogResult,
  TextBlock,
  TextWrapping,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

interface DialogConfiguration {
  readonly title: string
  readonly primary: string
  readonly secondary: string
  readonly close: string
  readonly defaultButton: ContentDialogButton
  readonly primaryResult: string
  readonly secondaryResult: string
  readonly closeResult: string
}

function openDialog(
  context: AppContext,
  configuration: DialogConfiguration,
  dialogOpen: Signal<boolean>,
  setResult: (value: string) => void,
): void {
  if (dialogOpen.value) {
    setResult('Close the current dialog before opening another.')
    return
  }
  dialogOpen.value = true
  const dialog = new ContentDialog()
  const title = new TextBlock()
  title.text = configuration.title
  dialog.title = title
  dialog.primaryButtonText = configuration.primary
  dialog.secondaryButtonText = configuration.secondary
  dialog.closeButtonText = configuration.close
  dialog.defaultButton = configuration.defaultButton

  void showContentDialog(
    context.renderer,
    dialog,
    context.window.content.xamlRoot,
    <UI.StackPanel spacing={12}>
      <UI.TextBlock
        text="Lorem ipsum dolor sit amet, adipisicing elit."
        textWrapping={TextWrapping.Wrap}
      />
      <UI.CheckBox>
        Upload your content to the cloud.
      </UI.CheckBox>
    </UI.StackPanel>,
    {
      onClosed: (result) => {
        dialogOpen.value = false
        setResult(
          result === ContentDialogResult.Primary
            ? configuration.primaryResult
            : result === ContentDialogResult.Secondary
              ? configuration.secondaryResult
              : configuration.closeResult,
        )
        context.model.recordInteraction()
      },
    },
  ).catch((error: unknown) => {
    dialogOpen.value = false
    const message = String(error)
    context.model.lastError.value = message
    setResult(`Dialog failed: ${message}`)
  })
}

export function ContentDialogPage(context: AppContext) {
  const saveResult = signal('No dialog result yet.')
  const replaceResult = signal('No dialog result yet.')
  const dialogOpen = signal(false)
  const dialogButtonsEnabled = computed(
    () => !dialogOpen.value,
  )

  return (
    <Page
      title="ContentDialog"
      subtitle="A modal surface for focused information and decisions."
      automationId="ContentDialogPageHeading"
      pageId="content-dialog"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryDialogsContentDialogDefaultSample"
        title="A ContentDialog with a default button"
        description="The primary action receives initial focus and the result is returned asynchronously."
        code={`
const dialog = new ContentDialog()
dialog.primaryButtonText = "Save"
dialog.secondaryButtonText = "Don't Save"
dialog.closeButtonText = "Cancel"
dialog.defaultButton = ContentDialogButton.Primary
const result = await showContentDialog(
  renderer,
  dialog,
  window.content.xamlRoot,
  <DialogContent />,
)
        `}
        output={
          <UI.TextBlock
            automationId="GalleryContentDialogDefaultResult"
            text={saveResult}
          />
        }
      >
        <UI.Button
          {...styles.button({ variant: 'accent' })}
          automationId="GalleryContentDialogDefaultShow"
          isEnabled={dialogButtonsEnabled}
          onClick={() => {
            openDialog(
              context,
              {
                title: 'Save your work?',
                primary: 'Save',
                secondary: "Don't Save",
                close: 'Cancel',
                defaultButton: ContentDialogButton.Primary,
                primaryResult: 'User saved their work',
                secondaryResult: 'User did not save their work',
                closeResult: 'User cancelled the dialog',
              },
              dialogOpen,
              (value) => {
                saveResult.value = value
              },
            )
          }}
        >
          Show dialog
        </UI.Button>
      </SampleCard>
      <SampleCard
        automationId="GalleryDialogsContentDialogNoDefaultSample"
        title="A ContentDialog without a default button"
        description="No action receives default focus when DefaultButton is None."
        code={`
dialog.primaryButtonText = "Replace"
dialog.secondaryButtonText = "Keep"
dialog.closeButtonText = "Cancel"
dialog.defaultButton = ContentDialogButton.None
        `}
        output={
          <UI.TextBlock
            automationId="GalleryContentDialogNoDefaultResult"
            text={replaceResult}
          />
        }
      >
        <UI.Button
          automationId="GalleryContentDialogNoDefaultShow"
          isEnabled={dialogButtonsEnabled}
          onClick={() => {
            openDialog(
              context,
              {
                title: 'Replace file?',
                primary: 'Replace',
                secondary: 'Keep',
                close: 'Cancel',
                defaultButton: ContentDialogButton.None,
                primaryResult: 'User replaced the file',
                secondaryResult: 'User kept the file',
                closeResult: 'User cancelled the dialog',
              },
              dialogOpen,
              (value) => {
                replaceResult.value = value
              },
            )
          }}
        >
          Show dialog without default button
        </UI.Button>
      </SampleCard>
    </Page>
  )
}
