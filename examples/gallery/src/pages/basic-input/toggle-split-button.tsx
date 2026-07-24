import { computed, signal } from 'dynwinrt-jsx'
import {
  type AppContext,
  GalleryToggleSplitButton,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

type ListMode = 'Bullets' | 'Roman numerals'

export function ToggleSplitButtonPage(context: AppContext) {
  const isChecked = signal(false)
  const mode = signal<ListMode>('Bullets')

  const selectMode = (next: ListMode) => {
    mode.value = next
    isChecked.value = true
    context.model.recordInteraction()
  }

  return (
    <Page
      title="ToggleSplitButton"
      subtitle="Toggle the current mode directly or select a related mode from a flyout."
      automationId="ToggleSplitButtonPageHeading"
      pageId="toggle-split-button"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryBasicInputToggleSplitButtonSample"
        title="List mode"
        description="IsChecked is controlled by a signal, and a flyout chooses the active list style."
        code={`
<GalleryToggleSplitButton
  content={computed(() => mode.value)}
  isChecked={isChecked}
  onIsCheckedChanged={(sender) => isChecked.value = sender.isChecked}
>
  <UI.MenuFlyout>
    <UI.MenuFlyoutItem text="Bullets" onClick={() => selectMode('Bullets')} />
  </UI.MenuFlyout>
</GalleryToggleSplitButton>
        `}
      >
        <UI.StackPanel spacing={12}>
          <GalleryToggleSplitButton
            automationId="GalleryBasicInputToggleSplitButtonControl"
            content={computed(() => `${mode.value} list`)}
            isChecked={isChecked}
            onIsCheckedChanged={(sender) => {
              if (sender.isChecked !== isChecked.value) {
                isChecked.value = sender.isChecked
                context.model.recordInteraction()
              }
            }}
          >
            <UI.MenuFlyout>
              <UI.MenuFlyoutItem
                text="Bullets"
                onClick={() => selectMode('Bullets')}
              />
              <UI.MenuFlyoutItem
                automationId="GalleryBasicInputToggleSplitRoman"
                text="Roman numerals"
                onClick={() => selectMode('Roman numerals')}
              />
            </UI.MenuFlyout>
          </GalleryToggleSplitButton>
          <UI.TextBlock
            text={computed(
              () =>
                `${mode.value}: ${isChecked.value ? 'enabled' : 'disabled'}`,
            )}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
