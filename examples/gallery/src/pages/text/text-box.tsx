import {
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  TextWrapping,
} from '#winapp/bindings'
import {
  type AppContext,
  type TextBoxInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function TextBoxPage(context: AppContext) {
  const textBox: RefObject<TextBoxInstance> = { current: null }
  const status = signal('The TextBox is empty.')

  return (
    <Page
      title="TextBox"
      subtitle="Captures single-line or multiline plain text."
      automationId="TextBoxPageHeading"
      pageId="text-box"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryTextBoxSample"
        title="A multiline TextBox"
        description="Retained refs read the current native value when TextChanged fires."
        code={`
<UI.TextBox
  acceptsReturn
  textWrapping={TextWrapping.Wrap}
  onTextChanged={() => status.value = textBox.current?.text ?? ''}
/>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryTextBoxStatus"
            text={status}
          />
        }
      >
        <UI.TextBox
          ref={textBox}
          automationId="GalleryTextBoxInput"
          width={520}
          height={150}
          header="Notes"
          placeholderText="Enter notes"
          acceptsReturn
          textWrapping={TextWrapping.Wrap}
          onTextChanged={() => {
            const value = textBox.current?.text ?? ''
            status.value = value
              ? `Current text: ${value}`
              : 'The TextBox is empty.'
            context.model.recordInteraction()
          }}
        />
      </SampleCard>
    </Page>
  )
}
