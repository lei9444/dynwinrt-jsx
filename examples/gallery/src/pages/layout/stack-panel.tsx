import {
  computed,
  signal,
  styles,
  type RefObject,
} from 'dynwinrt-jsx'
import { Orientation } from '#winapp/bindings'
import {
  type AppContext,
  type SliderInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function StackPanelPage(context: AppContext) {
  const horizontal = signal(false)
  const spacing = signal(4)
  const spacingSlider: RefObject<SliderInstance> = {
    current: null,
  }

  return (
    <Page
      title="StackPanel"
      subtitle="Sequential vertical or horizontal child layout."
      automationId="StackPanelPageHeading"
      pageId="stack-panel"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryLayoutStackPanelSample"
        title="Stack children with orientation and spacing"
        description="Switch between vertical and horizontal stacking and adjust the gap."
        code={`
<UI.StackPanel
  orientation={orientation}
  spacing={spacing}
>
  {children}
</UI.StackPanel>
        `}
        options={
          <UI.StackPanel spacing={10}>
            <UI.RadioButton
              groupName="stack-orientation"
              isChecked={computed(() => !horizontal.value)}
              onChecked={() => {
                if (horizontal.value) {
                  horizontal.value = false
                  context.model.recordInteraction()
                }
              }}
            >
              Vertical
            </UI.RadioButton>
            <UI.RadioButton
              groupName="stack-orientation"
              isChecked={horizontal}
              onChecked={() => {
                if (!horizontal.value) {
                  horizontal.value = true
                  context.model.recordInteraction()
                }
              }}
            >
              Horizontal
            </UI.RadioButton>
            <UI.Slider
              ref={spacingSlider}
              automationId="GalleryStackPanelSpacing"
              header="Spacing"
              value={4}
              minimum={0}
              maximum={16}
              onValueChanged={() => {
                const next = spacingSlider.current?.value
                if (next !== undefined && next !== spacing.value) {
                  spacing.value = next
                  context.model.recordInteraction()
                }
              }}
            />
          </UI.StackPanel>
        }
      >
        <UI.StackPanel
          automationId="GalleryStackPanelControl"
          orientation={computed(() =>
            horizontal.value
              ? Orientation.Horizontal
              : Orientation.Vertical,
          )}
          spacing={spacing}
        >
          <UI.Border
            {...styles.status({ tone: 'critical' })}
            width={64}
            height={64}
          />
          <UI.Border
            {...styles.status({ tone: 'attention' })}
            width={64}
            height={64}
          />
          <UI.Border
            {...styles.status({ tone: 'success' })}
            width={64}
            height={64}
          />
          <UI.Border
            {...styles.status({ tone: 'caution' })}
            width={64}
            height={64}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
