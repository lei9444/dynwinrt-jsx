import { computed, signal } from 'dynwinrt-jsx'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function ToggleButtonPage(context: AppContext) {
  const checked = signal(false)

  const setChecked = (value: boolean) => {
    if (value !== checked.value) {
      checked.value = value
      context.model.recordInteraction()
    }
  }

  return (
    <Page
      title="ToggleButton"
      subtitle="Preserve a native checked state for a two-state action."
      automationId="ToggleButtonPageHeading"
      pageId="toggle-button"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryBasicInputToggleButtonSample"
        title="Checked state"
        description="Checked and Unchecked events keep the signal authoritative."
        code={`
const checked = signal(false)
<UI.ToggleButton
  automationId="GalleryBasicInputToggleButtonControl"
  isChecked={checked}
  onChecked={() => checked.value = true}
  onUnchecked={() => checked.value = false}
>
  ToggleButton
</UI.ToggleButton>
        `}
      >
        <UI.StackPanel spacing={12}>
          <UI.ToggleButton
            isChecked={checked}
            onChecked={() => setChecked(true)}
            onUnchecked={() => setChecked(false)}
          >
            {computed(() =>
              checked.value ? 'Toggle is on' : 'Toggle is off',
            )}
          </UI.ToggleButton>
          <UI.TextBlock
            text={computed(() =>
              checked.value
                ? 'Output: checked'
                : 'Output: unchecked',
            )}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
