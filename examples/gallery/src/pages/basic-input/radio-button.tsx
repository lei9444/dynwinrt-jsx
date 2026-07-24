import {
  computed,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import { RadioButtons } from '#winapp/bindings'
import {
  type AppContext,
  GalleryRadioButtons,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function RadioButtonPage(context: AppContext) {
  const groupedChoice = signal('Option 1')
  const layoutIndex = signal(0)
  const layouts = ['Compact', 'Comfortable', 'Spacious']
  const radioButtons: RefObject<InstanceType<typeof RadioButtons>> = {
    current: null,
  }

  const chooseGrouped = (value: string) => {
    groupedChoice.value = value
    context.model.recordInteraction()
  }

  return (
    <Page
      title="RadioButton"
      subtitle="Choose one option through a shared group or a RadioButtons collection."
      automationId="RadioButtonPageHeading"
      pageId="radio-button"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryBasicInputRadioButtonSample"
        title="Grouped RadioButton controls"
        description="A shared GroupName keeps independently declared controls exclusive."
        code={`
<UI.RadioButton groupName="options" onChecked={() => choice.value = 'One'}>
  Option 1
</UI.RadioButton>
<UI.RadioButton groupName="options" onChecked={() => choice.value = 'Two'}>
  Option 2
</UI.RadioButton>
        `}
      >
        <UI.StackPanel spacing={8}>
          <UI.RadioButton
            automationId="GalleryBasicInputRadioButtonControl"
            groupName="gallery-basic-options"
            isChecked={computed(
              () => groupedChoice.value === 'Option 1',
            )}
            onChecked={() => chooseGrouped('Option 1')}
          >
            Option 1
          </UI.RadioButton>
          <UI.RadioButton
            automationId="GalleryBasicInputRadioButtonOption2"
            groupName="gallery-basic-options"
            isChecked={computed(
              () => groupedChoice.value === 'Option 2',
            )}
            onChecked={() => chooseGrouped('Option 2')}
          >
            Option 2
          </UI.RadioButton>
          <UI.RadioButton
            groupName="gallery-basic-options"
            isChecked={computed(
              () => groupedChoice.value === 'Option 3',
            )}
            onChecked={() => chooseGrouped('Option 3')}
          >
            Option 3
          </UI.RadioButton>
          <UI.TextBlock
            text={computed(() => `Selected: ${groupedChoice.value}`)}
          />
        </UI.StackPanel>
      </SampleCard>
      <SampleCard
        title="RadioButtons collection"
        description="The wrapper owns native items and applies selectedIndex after its children mount."
        code={`
<GalleryRadioButtons selectedIndex={layoutIndex} header="Layout">
  <UI.RadioButton>Compact</UI.RadioButton>
  <UI.RadioButton>Comfortable</UI.RadioButton>
</GalleryRadioButtons>
        `}
      >
        <UI.StackPanel spacing={10}>
          <GalleryRadioButtons
            ref={radioButtons}
            selectedIndex={layoutIndex}
            maxColumns={3}
            header="Layout"
            onSelectionChanged={() => {
              const index = radioButtons.current?.selectedIndex
              if (
                index !== undefined &&
                index !== layoutIndex.value
              ) {
                layoutIndex.value = index
                context.model.recordInteraction()
              }
            }}
          >
            {layouts.map((layout) => (
              <UI.RadioButton key={layout}>{layout}</UI.RadioButton>
            ))}
          </GalleryRadioButtons>
          <UI.TextBlock
            text={computed(
              () =>
                `Layout: ${layouts[layoutIndex.value] ?? 'None'}`,
            )}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
