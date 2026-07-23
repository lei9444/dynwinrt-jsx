import { computed, signal, type RefObject } from 'dynwinrt-jsx'
import { InfoBarSeverity } from '#winapp/bindings'
import { type AppContext, type ToggleButtonInstance, UI } from '../gallery-ui'
import { Page, SampleCard } from '../components/gallery-components'

export function ChoicesStatusPage(context: AppContext) {
  const toggleButton: RefObject<ToggleButtonInstance> = {
    current: null,
  }
  const severity = signal<
    'Information' | 'Success' | 'Warning' | 'Error'
  >('Information')
  const pinned = signal(false)
  const infoOpen = signal(true)
  const severityValue = computed(() => {
    switch (severity.value) {
      case 'Success':
        return InfoBarSeverity.Success
      case 'Warning':
        return InfoBarSeverity.Warning
      case 'Error':
        return InfoBarSeverity.Error
      default:
        return InfoBarSeverity.Informational
    }
  })
  const selectSeverity = (
    next: 'Information' | 'Success' | 'Warning' | 'Error',
  ) => {
    if (next === severity.value) {
      return
    }
    severity.value = next
    infoOpen.value = true
    context.model.recordInteraction()
  }

  return (
    <Page
      title="Choices and status"
      subtitle="Native choice controls can drive severity-aware notifications and persistent toggle state."
      automationId="ChoicesStatusPageHeading"
      pageId="choices-status"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryChoicesStatusSample"
        title="RadioButton and ToggleButton"
        description="Radio groups model one choice while ToggleButton preserves an independent boolean state."
        code={`
<UI.RadioButton
  groupName="severity"
  isChecked={computed(() => severity.value === 'Success')}
  onChecked={() => severity.value = 'Success'}
>
  Success
</UI.RadioButton>
<UI.ToggleButton isChecked={pinned}>Pin notification</UI.ToggleButton>
        `}
      >
        <UI.StackPanel spacing={10}>
          <UI.RadioButton
            groupName="gallery-severity"
            isChecked={computed(
              () => severity.value === 'Information',
            )}
            onChecked={() => selectSeverity('Information')}
          >
            Information
          </UI.RadioButton>
          <UI.RadioButton
            groupName="gallery-severity"
            isChecked={computed(
              () => severity.value === 'Success',
            )}
            onChecked={() => selectSeverity('Success')}
          >
            Success
          </UI.RadioButton>
          <UI.RadioButton
            groupName="gallery-severity"
            isChecked={computed(
              () => severity.value === 'Warning',
            )}
            onChecked={() => selectSeverity('Warning')}
          >
            Warning
          </UI.RadioButton>
          <UI.RadioButton
            groupName="gallery-severity"
            isChecked={computed(
              () => severity.value === 'Error',
            )}
            onChecked={() => selectSeverity('Error')}
          >
            Error
          </UI.RadioButton>
          <UI.ToggleButton
            ref={toggleButton}
            isChecked={pinned}
            onClick={() => {
              const next =
                toggleButton.current?.isChecked === true
              if (next !== pinned.value) {
                pinned.value = next
                context.model.recordInteraction()
              }
            }}
          >
            {computed(() =>
              pinned.value
                ? 'Notification pinned'
                : 'Pin notification',
            )}
          </UI.ToggleButton>
        </UI.StackPanel>
      </SampleCard>
      <SampleCard
        title="InfoBar severity"
        description="Title, message, severity, and open state are ordinary signal-backed native properties."
        code={`
<UI.InfoBar
  isOpen={infoOpen}
  severity={severityValue}
  title={computed(() => severity.value)}
  message="Native WinUI status message"
/>
        `}
      >
        <UI.StackPanel spacing={12}>
          <UI.InfoBar
            automationId="GalleryInfoBar"
            isOpen={infoOpen}
            isClosable
            severity={severityValue}
            title={computed(
              () => `${severity.value} status`,
            )}
            message={computed(() =>
              pinned.value
                ? 'This notification is pinned in application state.'
                : 'This notification uses the selected native severity.',
            )}
            onClosed={() => {
              infoOpen.value = false
            }}
          />
          <UI.Button
            onClick={() => {
              infoOpen.value = true
            }}
          >
            Show InfoBar
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
