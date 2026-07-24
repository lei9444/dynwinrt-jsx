import {
  computed,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  Orientation,
  SliderSnapsTo,
  TickPlacement,
} from '#winapp/bindings'
import {
  type AppContext,
  type NumberBoxInstance,
  type SliderInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function SliderPage(context: AppContext) {
  const basicSlider: RefObject<SliderInstance> = { current: null }
  const rangeSlider: RefObject<SliderInstance> = { current: null }
  const tickSlider: RefObject<SliderInstance> = { current: null }
  const verticalSlider: RefObject<SliderInstance> = { current: null }
  const basicValue = signal(25)
  const rangeValue = signal(800)
  const minimum = signal(500)
  const maximum = signal(1000)
  const stepFrequency = signal(10)
  const smallChange = signal(10)
  const tickValue = signal(40)
  const verticalValue = signal(0)
  const snapToTicks = signal(true)

  const updateNumber = (
    sender: NumberBoxInstance,
    current: { value: number },
    isValid: (value: number) => boolean,
    beforeCommit?: (value: number) => void,
  ) => {
    const next = sender.value
    if (!Number.isFinite(next) || !isValid(next)) {
      sender.value = current.value
      return
    }
    beforeCommit?.(next)
    current.value = next
    context.model.recordInteraction()
  }

  const update = (
    slider: RefObject<SliderInstance>,
    value: { value: number },
  ) => {
    const next = slider.current?.value
    if (next !== undefined && next !== value.value) {
      value.value = next
      context.model.recordInteraction()
    }
  }

  return (
    <Page
      title="Slider"
      subtitle="Select values with ranges, steps, ticks, snapping, and orientation."
      automationId="SliderPageHeading"
      pageId="slider"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryBasicInputSliderSample"
        title="Basic value"
        description="ValueChanged reads the native value into a signal."
        code={`
const value = signal(25)
<UI.Slider
  value={value}
  minimum={0}
  maximum={100}
  onValueChanged={() => value.value = slider.current?.value ?? value.value}
/>
        `}
      >
        <UI.StackPanel spacing={10}>
          <UI.Slider
            automationId="GalleryBasicInputSliderControl"
            ref={basicSlider}
            header="Volume"
            value={basicValue}
            minimum={0}
            maximum={100}
            onValueChanged={() => update(basicSlider, basicValue)}
          />
          <UI.TextBlock
            text={computed(
              () => `Value: ${Math.round(basicValue.value)}`,
            )}
          />
        </UI.StackPanel>
      </SampleCard>
      <SampleCard
        title="Range and step values"
        description="Minimum, Maximum, StepFrequency, and SmallChange can all update the same Slider at runtime."
        code={`
<UI.Slider
  value={rangeValue}
  minimum={minimum}
  maximum={maximum}
  stepFrequency={stepFrequency}
  smallChange={smallChange}
/>
        `}
      >
        <UI.StackPanel spacing={10}>
          <UI.Slider
            ref={rangeSlider}
            header="Control header"
            value={rangeValue}
            minimum={minimum}
            maximum={maximum}
            stepFrequency={stepFrequency}
            smallChange={smallChange}
            width={320}
            onValueChanged={() => update(rangeSlider, rangeValue)}
          />
          <UI.TextBlock
            text={computed(() => `Value: ${rangeValue.value}`)}
          />
          <UI.StackPanel spacing={8}>
            <UI.NumberBox
              header="Minimum"
              value={minimum}
              width={180}
              onValueChanged={(sender) =>
                updateNumber(
                  sender,
                  minimum,
                  (next) => next < maximum.value,
                  (next) => {
                    if (rangeValue.value < next) {
                      rangeValue.value = next
                    }
                  },
                )
              }
            />
            <UI.NumberBox
              header="Maximum"
              value={maximum}
              width={180}
              onValueChanged={(sender) =>
                updateNumber(
                  sender,
                  maximum,
                  (next) => next > minimum.value,
                  (next) => {
                    if (rangeValue.value > next) {
                      rangeValue.value = next
                    }
                  },
                )
              }
            />
            <UI.NumberBox
              header="StepFrequency"
              value={stepFrequency}
              minimum={1}
              width={180}
              onValueChanged={(sender) =>
                updateNumber(
                  sender,
                  stepFrequency,
                  (next) => next > 0,
                )
              }
            />
            <UI.NumberBox
              header="SmallChange"
              value={smallChange}
              minimum={1}
              width={180}
              onValueChanged={(sender) =>
                updateNumber(
                  sender,
                  smallChange,
                  (next) => next > 0,
                )
              }
            />
          </UI.StackPanel>
        </UI.StackPanel>
      </SampleCard>
      <SampleCard
        title="Ticks and snapping"
        description="TickFrequency, StepFrequency, and SnapsTo configure discrete values."
        code={`
<UI.Slider
  tickFrequency={20}
  stepFrequency={10}
  tickPlacement={TickPlacement.Outside}
  snapsTo={SliderSnapsTo.Ticks}
/>
        `}
      >
        <UI.StackPanel spacing={10}>
          <UI.Slider
            ref={tickSlider}
            value={tickValue}
            minimum={0}
            maximum={100}
            tickFrequency={20}
            stepFrequency={10}
            tickPlacement={TickPlacement.Outside}
            snapsTo={computed(() =>
              snapToTicks.value
                ? SliderSnapsTo.Ticks
                : SliderSnapsTo.StepValues,
            )}
            onValueChanged={() => update(tickSlider, tickValue)}
          />
          <UI.CheckBox
            isChecked={snapToTicks}
            onChecked={() => {
              snapToTicks.value = true
            }}
            onUnchecked={() => {
              snapToTicks.value = false
            }}
          >
            Snap to ticks
          </UI.CheckBox>
          <UI.TextBlock
            text={computed(
              () =>
                `Value: ${tickValue.value}; snaps to ${
                  snapToTicks.value ? 'Ticks' : 'StepValues'
                }`,
            )}
          />
        </UI.StackPanel>
      </SampleCard>
      <SampleCard
        title="Vertical slider"
        description="Orientation changes the native track without changing the value model."
        code={`
<UI.Slider
  orientation={Orientation.Vertical}
  minimum={-50}
  maximum={50}
  tickFrequency={10}
/>
        `}
      >
        <UI.StackPanel spacing={10}>
          <UI.Slider
            ref={verticalSlider}
            automationName="Vertical slider"
            orientation={Orientation.Vertical}
            value={verticalValue}
            minimum={-50}
            maximum={50}
            tickFrequency={10}
            tickPlacement={TickPlacement.Outside}
            height={220}
            width={100}
            onValueChanged={() =>
              update(verticalSlider, verticalValue)
            }
          />
          <UI.TextBlock
            text={computed(() => `Value: ${verticalValue.value}`)}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
