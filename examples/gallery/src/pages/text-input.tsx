import { computed, createSymbolIcon, signal, type RefObject } from 'dynwinrt-jsx'
import {
  HorizontalAlignment,
  NumberBoxSpinButtonPlacementMode,
  PasswordRevealMode,
  Symbol,
  SymbolIcon,
} from '#winapp/bindings'
import {
  type AppContext,
  type NumberBoxInstance,
  type PasswordBoxInstance,
  type TextBoxInstance,
  UI,
} from '../gallery-ui'
import { Page, SampleCard } from '../components/gallery-components'

export function TextInputPage(context: AppContext) {
  const textBox: RefObject<TextBoxInstance> = { current: null }
  const passwordBox: RefObject<PasswordBoxInstance> = {
    current: null,
  }
  const numberBox: RefObject<NumberBoxInstance> = {
    current: null,
  }
  const textStatus = signal('Start typing to update this preview.')
  const passwordStatus = signal('No password entered.')
  const searchStatus = signal('Submit a search query.')
  const quantity = signal(3)

  return (
    <Page
      title="Text and numeric input"
      subtitle="Generated properties and events cover common text, secret, search, and numeric entry."
      automationId="TextInputPageHeading"
      pageId="text-input"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryTextInputSample"
        title="TextBox and PasswordBox"
        description="Read current native values from retained refs when generated change events fire."
        code={`
const textBox = { current: null }
<UI.TextBox
  ref={textBox}
  header="Display name"
  onTextChanged={() => console.log(textBox.current?.text)}
/>
<UI.PasswordBox
  header="Password"
  passwordRevealMode={PasswordRevealMode.Peek}
/>
        `}
      >
        <UI.StackPanel spacing={16}>
          <UI.TextBox
            ref={textBox}
            automationId="GalleryTextInput"
            header="Display name"
            placeholderText="Enter a display name"
            maxWidth={480}
            horizontalAlignment={HorizontalAlignment.Stretch}
            onTextChanged={() => {
              const value = textBox.current?.text ?? ''
              textStatus.value = value
                ? `Current text: ${value}`
                : 'The TextBox is empty.'
            }}
          />
          <UI.TextBlock text={textStatus} />
          <UI.PasswordBox
            ref={passwordBox}
            automationId="GalleryPasswordInput"
            header="Password"
            placeholderText="Enter a password"
            passwordRevealMode={PasswordRevealMode.Peek}
            maxLength={32}
            maxWidth={480}
            horizontalAlignment={HorizontalAlignment.Stretch}
            onPasswordChanged={() => {
              const length =
                passwordBox.current?.password.length ?? 0
              passwordStatus.value =
                length === 0
                  ? 'No password entered.'
                  : `${length} password characters`
            }}
          />
          <UI.TextBlock text={passwordStatus} />
        </UI.StackPanel>
      </SampleCard>
      <SampleCard
        title="AutoSuggestBox"
        description="Use the generated query event even when suggestions are supplied by application state."
        code={`
<UI.AutoSuggestBox
  placeholderText="Search controls..."
  queryIcon={createSymbolIcon(SymbolIcon, Symbol.Find)}
  onQuerySubmitted={(sender) => search.value = sender.text}
/>
        `}
      >
        <UI.StackPanel spacing={10}>
          <UI.AutoSuggestBox
            automationId="GalleryAutoSuggestInput"
            placeholderText="Search controls..."
            queryIcon={createSymbolIcon(
              SymbolIcon,
              Symbol.Find,
            )}
            maxWidth={480}
            horizontalAlignment={HorizontalAlignment.Stretch}
            onTextChanged={(sender) => {
              searchStatus.value = sender.text
                ? `Draft query: ${sender.text}`
                : 'Submit a search query.'
            }}
            onQuerySubmitted={(sender) => {
              searchStatus.value =
                `Submitted query: ${sender.text || '(empty)'}`
              context.model.recordInteraction()
            }}
          />
          <UI.TextBlock text={searchStatus} />
        </UI.StackPanel>
      </SampleCard>
      <SampleCard
        title="NumberBox"
        description="Numeric bounds, step sizes, and spin-button placement are ordinary native properties."
        code={`
<UI.NumberBox
  value={quantity}
  minimum={0}
  maximum={20}
  smallChange={1}
  spinButtonPlacementMode={NumberBoxSpinButtonPlacementMode.Inline}
  onValueChanged={(sender) => quantity.value = sender.value}
/>
        `}
      >
        <UI.StackPanel spacing={10}>
          <UI.NumberBox
            ref={numberBox}
            automationId="GalleryNumberInput"
            header="Quantity"
            value={quantity}
            minimum={0}
            maximum={20}
            smallChange={1}
            largeChange={5}
            spinButtonPlacementMode={
              NumberBoxSpinButtonPlacementMode.Inline
            }
            maxWidth={320}
            horizontalAlignment={HorizontalAlignment.Left}
            onValueChanged={() => {
              const next = numberBox.current?.value
              if (
                next !== undefined &&
                next !== quantity.value
              ) {
                quantity.value = next
                context.model.recordInteraction()
              }
            }}
          />
          <UI.TextBlock
            text={computed(
              () => `Quantity: ${quantity.value}`,
            )}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
