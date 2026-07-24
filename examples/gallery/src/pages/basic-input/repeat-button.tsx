import { computed, signal } from 'dynwinrt-jsx'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function RepeatButtonPage(context: AppContext) {
  const enabled = signal(true)
  const count = signal(0)

  return (
    <Page
      title="RepeatButton"
      subtitle="Raise Click repeatedly while the button remains pressed."
      automationId="RepeatButtonPageHeading"
      pageId="repeat-button"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryBasicInputRepeatButtonSample"
        title="Press and hold"
        description="Delay controls the initial wait and Interval controls repeat speed."
        code={`
const count = signal(0)
<UI.RepeatButton
  automationId="GalleryBasicInputRepeatButtonControl"
  automationName="Repeat action"
  delay={400}
  interval={100}
  isEnabled={enabled}
  onClick={() => count.value += 1}
>
  Click and hold
</UI.RepeatButton>
        `}
        output={
          <UI.TextBlock
            text={computed(() => `Repeat count: ${count.value}`)}
          />
        }
        options={
          <UI.CheckBox
            isChecked={computed(() => !enabled.value)}
            onChecked={() => {
              enabled.value = false
            }}
            onUnchecked={() => {
              enabled.value = true
            }}
          >
            Disable RepeatButton
          </UI.CheckBox>
        }
      >
        <UI.RepeatButton
          delay={400}
          interval={100}
          isEnabled={enabled}
          onClick={() => {
            count.value += 1
            context.model.recordInteraction()
          }}
        >
          Click and hold
        </UI.RepeatButton>
      </SampleCard>
    </Page>
  )
}
