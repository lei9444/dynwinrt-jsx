import {
  createSymbolIcon,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  AutoSuggestBox,
  AutoSuggestionBoxTextChangeReason,
  IObservableVector_Object,
  PropertyValue,
  Symbol,
  SymbolIcon,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

const suggestions = [
  'Button',
  'Grid',
  'NavigationView',
  'ScrollView',
  'TextBox',
] as const

export function AutoSuggestBoxPage(context: AppContext) {
  const autoSuggest: RefObject<AutoSuggestBox> = {
    current: null,
  }
  const status = signal('Type a control name.')
  const items = IObservableVector_Object.create(
    suggestions.map((item) => PropertyValue.createString(item)),
  )

  return (
    <Page
      title="AutoSuggestBox"
      subtitle="Combines editable text, suggestions, and query submission."
      automationId="AutoSuggestBoxPageHeading"
      pageId="auto-suggest-box"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryAutoSuggestBoxSample"
        title="Search control names"
        description="A projected observable vector supplies native suggestions while text and query events update application state."
        code={`
<UI.AutoSuggestBox
  itemsSource={suggestions}
  queryIcon={createSymbolIcon(SymbolIcon, Symbol.Find)}
  onTextChanged={(sender) => status.value = sender.text}
  onQuerySubmitted={(sender) => submit(sender.text)}
/>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryAutoSuggestBoxStatus"
            text={status}
          />
        }
        options={
          <UI.Button
            automationId="GalleryAutoSuggestBoxDraft"
            onClick={() => {
              const current = autoSuggest.current
              if (!current) {
                throw new Error('AutoSuggestBox is not mounted.')
              }
              current.text = 'grid'
              context.model.recordInteraction()
            }}
          >
            Enter "grid"
          </UI.Button>
        }
      >
        <UI.AutoSuggestBox
          ref={autoSuggest}
          automationId="GalleryAutoSuggestBoxInput"
          width={420}
          placeholderText="Type a control name"
          queryIcon={createSymbolIcon(
            SymbolIcon,
            Symbol.Find,
          )}
          itemsSource={items}
          onTextChanged={(sender, args) => {
            if (
              args.reason ===
              AutoSuggestionBoxTextChangeReason.SuggestionChosen
            ) {
              return
            }
            status.value = sender.text
              ? `Draft query: ${sender.text}`
              : 'Type a control name.'
          }}
          onSuggestionChosen={() => {
            status.value = 'Suggestion chosen.'
            context.model.recordInteraction()
          }}
          onQuerySubmitted={(sender) => {
            status.value =
              `Submitted query: ${sender.text || '(empty)'}`
            context.model.recordInteraction()
          }}
        />
      </SampleCard>
    </Page>
  )
}
