import {
  bind,
  computed,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  type AppContext,
  type TextBoxInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function BindingPage(context: AppContext) {
  const name = signal('Ada')
  const textBox: RefObject<TextBoxInstance> = { current: null }
  const nameBinding = bind.twoWay(
    name,
    'text',
    'onTextChanged',
  )

  return (
    <Page
      title="Binding"
      subtitle="Connects signals to native properties and change events."
      automationId="BindingPageHeading"
      pageId="binding"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryBindingSample"
        title="One-way and two-way binding props"
        description="Binding helpers return typed JSX spreads and suppress programmatic native echoes."
        code={`
const name = signal('Ada')
<UI.TextBox {...bind.twoWay(name, 'text', 'onTextChanged')} />
<UI.TextBlock {...bind.oneWay(name, 'text')} />
        `}
        options={
          <UI.Button
            automationId="GalleryBindingProgrammatic"
            onClick={() => {
              name.value = 'Programmatic'
              context.model.recordInteraction()
            }}
          >
            Set from model
          </UI.Button>
        }
      >
        <UI.StackPanel spacing={12}>
          <UI.TextBox
            ref={textBox}
            automationId="GalleryBindingInput"
            width={360}
            header="Name"
            text={nameBinding.text}
            onTextChanged={() => {
              const current = textBox.current
              if (!current) {
                throw new Error('Binding TextBox is not mounted.')
              }
              nameBinding.onTextChanged(current)
              context.model.recordInteraction()
            }}
          />
          <UI.TextBlock
            automationId="GalleryBindingOutput"
            {...bind.oneWay(name, 'text')}
          />
          <UI.TextBlock
            automationId="GalleryBindingStatus"
            text={computed(() => `Bound name: ${name.value}`)}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
