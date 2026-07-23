import { computed, signal, styles, type RefObject } from 'dynwinrt-jsx'
import { type AppContext, type ToggleInstance, UI } from '../gallery-ui'
import { Page, SampleCard } from '../components/gallery-components'

export function ButtonsPage(context: AppContext) {
  const enabled = signal(true)
  const clicks = signal(0)
  const toggle: RefObject<ToggleInstance> = { current: null }
  return (
    <Page
      title="Buttons and toggles"
      subtitle="Native input controls use generated events and signal-backed properties."
      automationId="ButtonsPageHeading"
      pageId="buttons"
      model={context.model}
    >
      <SampleCard
        title="Button state"
        description="The button updates a progress value and respects a signal-backed enabled state."
        code={`
const enabled = signal(true)
const clicks = signal(0)
<UI.Button isEnabled={enabled} onClick={() => clicks.value += 1}>
  Run action
</UI.Button>
<UI.ProgressBar value={computed(() => clicks.value % 10)} maximum={10} />
        `}
      >
        <UI.StackPanel spacing={12}>
          <UI.Button
            {...styles.button({ variant: 'accent' })}
            isEnabled={enabled}
            onClick={() => {
              clicks.value += 1
              context.model.recordInteraction()
            }}
          >
            Run action
          </UI.Button>
          <UI.ProgressBar
            minimum={0}
            maximum={10}
            value={computed(() => clicks.value % 10)}
          />
          <UI.TextBlock
            text={computed(() => `${clicks.value} clicks`)}
          />
        </UI.StackPanel>
      </SampleCard>
      <SampleCard
        title="ToggleSwitch and CheckBox"
        description="Read the native value from the event sender or a retained ref."
        code={`
<UI.ToggleSwitch
  ref={toggle}
  isOn={enabled}
  onToggled={() => enabled.value = toggle.current?.isOn ?? false}
/>
<UI.CheckBox isChecked={enabled}>Enabled</UI.CheckBox>
        `}
      >
        <UI.StackPanel spacing={12}>
          <UI.ToggleSwitch
            ref={toggle}
            header="Enable the action"
            isOn={enabled}
            onToggled={() => {
              enabled.value =
                toggle.current?.isOn ?? enabled.value
              context.model.recordInteraction()
            }}
          />
          <UI.CheckBox isChecked={enabled}>
            Signal-backed checked value
          </UI.CheckBox>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
