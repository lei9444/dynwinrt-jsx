import {
  color,
  computed,
  createSolidColorBrush,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  NumberBoxSpinButtonPlacementMode,
  SolidColorBrush,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  type NumberBoxInstance,
  type ToggleInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

const backgroundNames = ['Transparent', 'LightGray'] as const

export function ProgressRingPage(context: AppContext) {
  const active = signal(true)
  const progress = signal(0)
  const firstBackgroundIndex = signal(0)
  const secondBackgroundIndex = signal(0)
  const activeToggle: RefObject<ToggleInstance> = {
    current: null,
  }
  const progressInput: RefObject<NumberBoxInstance> = {
    current: null,
  }
  const transparent = createSolidColorBrush(
    SolidColorBrush,
    color(0, 0, 0, 0),
  )
  const lightGray = createSolidColorBrush(
    SolidColorBrush,
    color(211, 211, 211),
  )
  const backgroundFor = (index: number) =>
    index === 1 ? lightGray : transparent

  return (
    <Page
      title="ProgressRing"
      subtitle="A circular indicator for active work or determinate progress."
      automationId="ProgressRingPageHeading"
      pageId="progress-ring"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStatusProgressRingIndeterminateSample"
        title="An indeterminate ProgressRing"
        description="Start or stop the activity indicator and optionally show a light gray background."
        code={`
<UI.ProgressRing
  width={60}
  height={60}
  isActive={active}
  background={background}
/>
        `}
        options={
          <UI.StackPanel spacing={12}>
            <UI.ToggleSwitch
              ref={activeToggle}
              automationId="GalleryProgressRingActive"
              header="Progress Options"
              isOn
              onContent="Working"
              offContent="Do work"
              onToggled={() => {
                const next =
                  activeToggle.current?.isOn ?? active.value
                if (next !== active.value) {
                  active.value = next
                  context.model.recordInteraction()
                }
              }}
            />
            <GalleryComboBox
              automationId="GalleryProgressRingFirstBackground"
              header={<UI.TextBlock text="Background color" />}
              selectedIndex={firstBackgroundIndex}
              onSelectedIndexChange={(index) => {
                if (index !== firstBackgroundIndex.value) {
                  firstBackgroundIndex.value = index
                  context.model.recordInteraction()
                }
              }}
              width={200}
            >
              {backgroundNames.map((name) => (
                <UI.TextBlock key={name} text={name} />
              ))}
            </GalleryComboBox>
          </UI.StackPanel>
        }
      >
        <UI.ProgressRing
          automationId="GalleryProgressRingIndeterminate"
          width={60}
          height={60}
          isActive={active}
          background={computed(() =>
            backgroundFor(firstBackgroundIndex.value),
          )}
        />
      </SampleCard>
      <SampleCard
        automationId="GalleryStatusProgressRingDeterminateSample"
        title="A determinate ProgressRing"
        description="Enter a value from 0 to 100 and choose the ring background."
        code={`
<UI.ProgressRing
  isIndeterminate={false}
  minimum={0}
  maximum={100}
  value={progress}
/>
        `}
        options={
          <GalleryComboBox
            automationId="GalleryProgressRingSecondBackground"
            header={<UI.TextBlock text="Background color" />}
            selectedIndex={secondBackgroundIndex}
            onSelectedIndexChange={(index) => {
              if (index !== secondBackgroundIndex.value) {
                secondBackgroundIndex.value = index
                context.model.recordInteraction()
              }
            }}
            width={200}
          >
            {backgroundNames.map((name) => (
              <UI.TextBlock key={name} text={name} />
            ))}
          </GalleryComboBox>
        }
      >
        <UI.StackPanel spacing={12}>
          <UI.ProgressRing
            automationId="GalleryProgressRingDeterminate"
            width={60}
            height={60}
            isIndeterminate={false}
            minimum={0}
            maximum={100}
            value={progress}
            background={computed(() =>
              backgroundFor(secondBackgroundIndex.value),
            )}
          />
          <UI.NumberBox
            ref={progressInput}
            automationId="GalleryProgressRingValue"
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
