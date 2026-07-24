import { computed, signal } from 'dynwinrt-jsx'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function CheckBoxPage(context: AppContext) {
  const twoState = signal(false)
  const threeState = signal<boolean | null>(null)
  const option1 = signal(false)
  const option2 = signal(true)
  const option3 = signal(false)

  const selectAllState = computed<boolean | null>(() => {
    const selected = [
      option1.value,
      option2.value,
      option3.value,
    ].filter(Boolean).length
    return selected === 3 ? true : selected === 0 ? false : null
  })
  const allSelected = computed(
    () => option1.value && option2.value && option3.value,
  )

  const setAll = (value: boolean) => {
    option1.value = value
    option2.value = value
    option3.value = value
    context.model.recordInteraction()
  }

  const setOption = (
    option: { value: boolean },
    value: boolean,
  ) => {
    option.value = value
    context.model.recordInteraction()
  }

  return (
    <Page
      title="CheckBox"
      subtitle="Model two-state, three-state, and select-all choices."
      automationId="CheckBoxPageHeading"
      pageId="check-box"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryBasicInputCheckBoxSample"
        title="Two-state and three-state"
        description="Checked, Unchecked, and Indeterminate events update signal state."
        code={`
<UI.CheckBox
  automationId="GalleryBasicInputCheckBoxControl"
  isChecked={twoState}
  onChecked={() => twoState.value = true}
  onUnchecked={() => twoState.value = false}
>
  Two-state CheckBox
</UI.CheckBox>
<UI.CheckBox isThreeState isChecked={threeState}>Three-state CheckBox</UI.CheckBox>
        `}
      >
        <UI.StackPanel spacing={10}>
          <UI.CheckBox
            isChecked={twoState}
            onChecked={() => {
              twoState.value = true
              context.model.recordInteraction()
            }}
            onUnchecked={() => {
              twoState.value = false
              context.model.recordInteraction()
            }}
          >
            Two-state CheckBox
          </UI.CheckBox>
          <UI.TextBlock
            text={computed(() =>
              twoState.value
                ? 'Two-state output: checked'
                : 'Two-state output: unchecked',
            )}
          />
          <UI.CheckBox
            isThreeState
            isChecked={threeState}
            onChecked={() => {
              threeState.value = true
              context.model.recordInteraction()
            }}
            onUnchecked={() => {
              threeState.value = false
              context.model.recordInteraction()
            }}
            onIndeterminate={() => {
              threeState.value = null
              context.model.recordInteraction()
            }}
          >
            Three-state CheckBox
          </UI.CheckBox>
          <UI.TextBlock
            text={computed(() =>
              threeState.value === null
                ? 'Indeterminate'
                : threeState.value
                  ? 'Checked'
                  : 'Unchecked',
            )}
          />
        </UI.StackPanel>
      </SampleCard>
      <SampleCard
        title="Select all"
        description="The parent state is computed from its child options."
        code={`
const selectAll = computed(() =>
  options.every((option) => option.value)
    ? true
    : options.every((option) => !option.value) ? false : null
)
<UI.CheckBox isThreeState isChecked={selectAll}>Select all</UI.CheckBox>
        `}
      >
        <UI.StackPanel spacing={8}>
          <UI.CheckBox
            isThreeState
            isChecked={selectAllState}
            onChecked={() => setAll(true)}
            onUnchecked={() => setAll(false)}
            onIndeterminate={() => {
              if (allSelected.value) {
                setAll(false)
              }
            }}
          >
            Select all
          </UI.CheckBox>
          <UI.CheckBox
            isChecked={option1}
            onChecked={() => setOption(option1, true)}
            onUnchecked={() => setOption(option1, false)}
          >
            Option 1
          </UI.CheckBox>
          <UI.CheckBox
            isChecked={option2}
            onChecked={() => setOption(option2, true)}
            onUnchecked={() => setOption(option2, false)}
          >
            Option 2
          </UI.CheckBox>
          <UI.CheckBox
            isChecked={option3}
            onChecked={() => setOption(option3, true)}
            onUnchecked={() => setOption(option3, false)}
          >
            Option 3
          </UI.CheckBox>
          <UI.TextBlock
            text={computed(() =>
              selectAllState.value === null
                ? 'Some options are selected'
                : selectAllState.value
                  ? 'All options are selected'
                  : 'No options are selected',
            )}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
