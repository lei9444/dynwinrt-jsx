import {
  computed,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  type AppContext,
  type ToggleInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function ToggleSwitchPage(context: AppContext) {
  const simpleSwitch: RefObject<ToggleInstance> = { current: null }
  const workSwitch: RefObject<ToggleInstance> = { current: null }
  const simpleOn = signal(false)
  const working = signal(true)

  const update = (
    toggle: RefObject<ToggleInstance>,
    value: { value: boolean },
  ) => {
    const next = toggle.current?.isOn
    if (next !== undefined && next !== value.value) {
      value.value = next
      context.model.recordInteraction()
    }
  }

  return (
    <Page
      title="ToggleSwitch"
      subtitle="Switch between two states with optional custom content."
      automationId="ToggleSwitchPageHeading"
      pageId="toggle-switch"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryBasicInputToggleSwitchSample"
        title="Simple switch"
        description="Toggled reads the native IsOn value into application state."
        code={`
const isOn = signal(false)
<UI.ToggleSwitch
  isOn={isOn}
  onToggled={(sender) => isOn.value = sender.isOn}
/>
        `}
      >
        <UI.StackPanel spacing={10}>
          <UI.ToggleSwitch
            automationId="GalleryBasicInputToggleSwitchControl"
            ref={simpleSwitch}
            header="Notifications"
            isOn={simpleOn}
            onToggled={() => update(simpleSwitch, simpleOn)}
          />
          <UI.TextBlock
            text={computed(() =>
              simpleOn.value
                ? 'Notifications are on'
                : 'Notifications are off',
            )}
          />
        </UI.StackPanel>
      </SampleCard>
      <SampleCard
        title="Custom content and progress"
        description="OnContent and OffContent describe the state while ProgressRing follows the same signal."
        code={`
<UI.ToggleSwitch
  header="Toggle work"
  isOn={working}
  onContent="Working"
  offContent="Do work"
/>
<UI.ProgressRing isActive={working} width={32} />
        `}
      >
        <UI.StackPanel spacing={12}>
          <UI.ToggleSwitch
            ref={workSwitch}
            header="Toggle work"
            isOn={working}
            onContent="Working"
            offContent="Do work"
            onToggled={() => update(workSwitch, working)}
          />
          <UI.ProgressRing
            isActive={working}
            isIndeterminate
            width={32}
            height={32}
          />
          <UI.TextBlock
            text={computed(() =>
              working.value ? 'Work in progress' : 'Work paused',
            )}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
