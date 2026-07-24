import {
  computed,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  NumberBoxSpinButtonPlacementMode,
} from '#winapp/bindings'
import {
  type AppContext,
  type NumberBoxInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function NumberBoxPage(context: AppContext) {
  const numberBox: RefObject<NumberBoxInstance> = {
    current: null,
  }
  const value = signal(10)

  return (
    <Page
      title="NumberBox"
      subtitle="Accepts numeric values, arithmetic expressions, bounds, and spin buttons."
      automationId="NumberBoxPageHeading"
      pageId="number-box"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryNumberBoxSample"
        title="Evaluate a bounded expression"
        description="NumberBox evaluates expressions and reports its native numeric value through ValueChanged."
        code={`
<UI.NumberBox
  acceptsExpression
  value={value}
  minimum={0}
  maximum={100}
  spinButtonPlacementMode={NumberBoxSpinButtonPlacementMode.Inline}
/>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryNumberBoxStatus"
            text={computed(() =>
              Number.isFinite(value.value)
                ? `Value: ${value.value}`
                : 'Value: invalid',
            )}
          />
        }
      >
        <UI.NumberBox
          ref={numberBox}
          automationId="GalleryNumberBoxInput"
          width={320}
          header="Enter a number or expression"
          placeholderText="1 + 2^2"
          acceptsExpression
          value={value}
          minimum={0}
          maximum={100}
          smallChange={1}
          largeChange={10}
          spinButtonPlacementMode={
            NumberBoxSpinButtonPlacementMode.Inline
          }
          onValueChanged={() => {
            const next = numberBox.current?.value
            if (
              next !== undefined &&
              !Object.is(next, value.value)
            ) {
              value.value = next
              context.model.recordInteraction()
            }
          }}
        />
      </SampleCard>
    </Page>
  )
}
