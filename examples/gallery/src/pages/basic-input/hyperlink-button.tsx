import { computed, createUri, signal } from 'dynwinrt-jsx'
import { Uri } from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function HyperlinkButtonPage(context: AppContext) {
  const disabled = signal(false)
  const microsoftUri = createUri(Uri, 'https://www.microsoft.com')

  return (
    <Page
      title="HyperlinkButton"
      subtitle="Navigate to a URI or handle Click for application navigation."
      automationId="HyperlinkButtonPageHeading"
      pageId="hyperlink-button"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryBasicInputHyperlinkButtonSample"
        title="Navigate to a URI"
        description="NavigateUri opens an external destination, and IsEnabled can disable the link."
        code={`
<UI.HyperlinkButton
  content="Microsoft home page"
  navigateUri={createUri(Uri, 'https://www.microsoft.com')}
  isEnabled={computed(() => !disabled.value)}
/>
        `}
        options={
          <UI.CheckBox
            isChecked={disabled}
            onChecked={() => {
              disabled.value = true
            }}
            onUnchecked={() => {
              disabled.value = false
            }}
          >
            Disable hyperlink button
          </UI.CheckBox>
        }
      >
        <UI.HyperlinkButton
          content="Microsoft home page"
          navigateUri={microsoftUri}
          automationName="Open Microsoft home page"
          isEnabled={computed(() => !disabled.value)}
        />
      </SampleCard>
      <SampleCard
        title="Navigate within the app"
        description="Handle Click when the destination is another Gallery page."
        code={`
<UI.HyperlinkButton onClick={() => model.navigate('toggle-button')}>
  Go to ToggleButton
</UI.HyperlinkButton>
        `}
      >
        <UI.HyperlinkButton
          automationId="GalleryBasicInputHyperlinkInternal"
          onClick={() => {
            context.model.recordInteraction()
            context.model.navigate('toggle-button')
          }}
        >
          Go to ToggleButton
        </UI.HyperlinkButton>
      </SampleCard>
    </Page>
  )
}
