import { computed, signal, styles, type RefObject } from 'dynwinrt-jsx'
import {
  type AppContext,
  type SliderInstance,
  type ToggleInstance,
  UI,
} from '../gallery-ui'
import { Page, SampleCard } from '../components/gallery-components'

export function RangeProgressPage(context: AppContext) {
  const slider: RefObject<SliderInstance> = { current: null }
  const indeterminateToggle: RefObject<ToggleInstance> = {
    current: null,
  }
  const progress = signal(35)
  const indeterminate = signal(false)

  const setProgress = (value: number) => {
    const next = Math.max(0, Math.min(100, value))
    if (next === progress.value) {
      return
    }
    progress.value = next
    context.model.recordInteraction()
  }

  return (
    <Page
      title="Range and progress"
      subtitle="One signal can coordinate native range input and multiple progress visualizations."
      automationId="RangeProgressPageHeading"
      pageId="range-progress"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryRangeProgressSample"
        title="Slider and ProgressBar"
        description="The Slider accepts native input while the progress bar follows the shared model."
        code={`
const progress = signal(35)
<UI.Slider value={progress} minimum={0} maximum={100} />
<UI.ProgressBar value={progress} minimum={0} maximum={100} />
        `}
      >
        <UI.StackPanel spacing={14}>
          <UI.Slider
            ref={slider}
            automationId="GalleryProgressSlider"
            header="Completion"
            value={progress}
            minimum={0}
            maximum={100}
            stepFrequency={5}
            onValueChanged={() => {
              const next = slider.current?.value
              if (
                next !== undefined &&
                next !== progress.value
              ) {
                setProgress(next)
              }
            }}
          />
          <UI.ProgressBar
            automationId="GalleryProgressBar"
            value={progress}
            minimum={0}
            maximum={100}
          />
          <UI.TextBlock
            text={computed(
              () => `${Math.round(progress.value)}% complete`,
            )}
          />
          <UI.StackPanel spacing={8}>
            <UI.Button
              onClick={() => setProgress(progress.value - 10)}
            >
              Decrease
            </UI.Button>
            <UI.Button
              {...styles.button({ variant: 'accent' })}
              onClick={() => setProgress(progress.value + 10)}
            >
              Increase
            </UI.Button>
          </UI.StackPanel>
        </UI.StackPanel>
      </SampleCard>
      <SampleCard
        title="ProgressRing"
        description="Switch between determinate progress and an active indeterminate operation."
        code={`
<UI.ProgressRing
  isActive
  isIndeterminate={indeterminate}
  value={progress}
/>
        `}
      >
        <UI.StackPanel spacing={14}>
          <UI.ProgressRing
            automationId="GalleryProgressRing"
            isActive
            isIndeterminate={indeterminate}
            value={progress}
            minimum={0}
            maximum={100}
            width={64}
            height={64}
          />
          <UI.ToggleSwitch
            ref={indeterminateToggle}
            header="Indeterminate"
            isOn={indeterminate}
            onToggled={() => {
              const next =
                indeterminateToggle.current?.isOn ??
                indeterminate.value
              if (next !== indeterminate.value) {
                indeterminate.value = next
                context.model.recordInteraction()
              }
            }}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
