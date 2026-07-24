import { computed, signal, type RefObject } from 'dynwinrt-jsx'
import { NumberBoxSpinButtonPlacementMode } from '#winapp/bindings'
import {
  type AppContext,
  type NumberBoxInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

type ProgressState = 'Running' | 'Paused' | 'Error'

export function ProgressBarPage(context: AppContext) {
  const state = signal<ProgressState>('Running')
  const progress = signal(0)
  const progressInput: RefObject<NumberBoxInstance> = {
    current: null,
  }

  return (
    <Page
      title="ProgressBar"
      subtitle="A horizontal indicator for activity or numeric progress."
      automationId="ProgressBarPageHeading"
      pageId="progress-bar"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStatusProgressBarIndeterminateSample"
        title="An indeterminate ProgressBar"
        description="Switch the repeating indicator between running, paused, and error visual states."
        code={`
<UI.ProgressBar
  isIndeterminate
  showPaused={computed(() => state.value === "Paused")}
  showError={computed(() => state.value === "Error")}
/>
        `}
        options={
          <UI.StackPanel spacing={8}>
            {(['Running', 'Paused', 'Error'] as const).map((name) => (
              <UI.RadioButton
                key={name}
                groupName="progress-bar-state"
                isChecked={computed(() => state.value === name)}
                onChecked={() => {
                  if (state.value !== name) {
                    state.value = name
                    context.model.recordInteraction()
                  }
                }}
              >
                {name}
              </UI.RadioButton>
            ))}
          </UI.StackPanel>
        }
      >
        <UI.ProgressBar
          automationId="GalleryProgressBarIndeterminate"
          width={130}
          isIndeterminate
          showPaused={computed(() => state.value === 'Paused')}
          showError={computed(() => state.value === 'Error')}
        />
      </SampleCard>
      <SampleCard
        automationId="GalleryStatusProgressBarDeterminateSample"
        title="A determinate ProgressBar"
        description="Enter a value from 0 to 100 to update the progress indicator."
        code={`
const progress = signal(0)
<UI.ProgressBar minimum={0} maximum={100} value={progress} />
        `}
        output={
          <UI.TextBlock
            automationId="GalleryProgressBarStatus"
            text={computed(() => `${Math.round(progress.value)}%`)}
          />
        }
      >
        <UI.StackPanel spacing={12}>
          <UI.ProgressBar
            automationId="GalleryProgressBarDeterminate"
            width={130}
            minimum={0}
            maximum={100}
            value={progress}
          />
          <UI.NumberBox
            ref={progressInput}
            automationId="GalleryProgressBarValue"
            header="Progress"
            value={0}
            minimum={0}
            maximum={100}
            spinButtonPlacementMode={
              NumberBoxSpinButtonPlacementMode.Inline
            }
            onValueChanged={() => {
              const next = progressInput.current?.value
              if (
                next !== undefined &&
                Number.isFinite(next) &&
                next !== progress.value
              ) {
                progress.value = next
                context.model.recordInteraction()
              }
            }}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
