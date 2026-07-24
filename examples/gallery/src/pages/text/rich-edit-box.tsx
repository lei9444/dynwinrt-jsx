import {
  computed,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  RichEditBox,
  TextSetOptions,
  TextWrapping,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function RichEditBoxPage(context: AppContext) {
  const editor: RefObject<RichEditBox> = { current: null }
  const changes = signal(0)
  const status = signal('Document is ready.')
  const documentText = signal('')
  const requireEditor = () => {
    const current = editor.current
    if (!current) {
      throw new Error('RichEditBox is not mounted.')
    }
    return current
  }
  const refreshDocumentText = () => {
    const text = requireEditor()
      .document
      .getRange(0, 10000)
      .text
      .trimEnd()
    documentText.value = text
  }

  return (
    <Page
      title="RichEditBox"
      subtitle="Provides an editable rich text document surface."
      automationId="RichEditBoxPageHeading"
      pageId="rich-edit-box"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryRichEditBoxSample"
        title="A multiline rich text editor"
        description="Use the projected RichEditTextDocument to set content while TextChanged tracks edits."
        code={`
<UI.RichEditBox
  ref={editor}
  acceptsReturn
  textWrapping={TextWrapping.Wrap}
  onLoaded={() => editor.current?.document.setText(
    TextSetOptions.None,
    'Editable rich text',
  )}
/>
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryRichEditBoxStatus"
              text={status}
            />
            <UI.TextBlock
              automationId="GalleryRichEditBoxDocumentText"
              text={computed(() =>
                documentText.value
                  ? `Document text: ${documentText.value}`
                  : 'Document text: (empty)',
              )}
            />
            <UI.TextBlock
              text={computed(
                () => `Text changes: ${changes.value}`,
              )}
            />
          </UI.StackPanel>
        }
        options={
          <UI.Button
            automationId="GalleryRichEditBoxClear"
            onClick={() => {
              requireEditor().document.setText(
                TextSetOptions.None,
                '',
              )
              refreshDocumentText()
              status.value = 'Document cleared.'
              context.model.recordInteraction()
            }}
          >
            Clear document
          </UI.Button>
        }
      >
        <UI.RichEditBox
          ref={editor}
          automationId="GalleryRichEditBoxControl"
          minWidth={420}
          height={220}
          acceptsReturn
          placeholderText="Enter formatted text"
          textWrapping={TextWrapping.Wrap}
          onLoaded={() => {
            requireEditor().document.setText(
              TextSetOptions.None,
              'RichEditBox supports multiline editing, selection, and formatting.',
            )
            refreshDocumentText()
          }}
          onTextChanged={() => {
            changes.value += 1
            refreshDocumentText()
          }}
        />
      </SampleCard>
    </Page>
  )
}
