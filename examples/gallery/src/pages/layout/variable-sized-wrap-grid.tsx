import { computed, signal, styles } from 'dynwinrt-jsx'
import { Orientation } from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function VariableSizedWrapGridPage(context: AppContext) {
  const horizontal = signal(false)

  return (
    <Page
      title="VariableSizedWrapGrid"
      subtitle="Fixed cells whose children can span rows or columns."
      automationId="VariableSizedWrapGridPageHeading"
      pageId="variable-sized-wrap-grid"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryLayoutVariableSizedWrapGridSample"
        title="Wrap children with variable spans"
        description="Switch orientation while two children span multiple cells."
        code={`
<UI.VariableSizedWrapGrid
  itemWidth={44}
  itemHeight={44}
  maximumRowsOrColumns={3}
  orientation={orientation}
>
  <UI.Border variableSizedWrapGridRowSpan={2} />
  <UI.Border variableSizedWrapGridColumnSpan={2} />
</UI.VariableSizedWrapGrid>
        `}
        options={
          <UI.StackPanel spacing={8}>
            <UI.RadioButton
              groupName="wrap-grid-orientation"
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
              groupName="wrap-grid-orientation"
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
          </UI.StackPanel>
        }
      >
        <UI.VariableSizedWrapGrid
          automationId="GalleryVariableSizedWrapGridControl"
          itemWidth={44}
          itemHeight={44}
          maximumRowsOrColumns={3}
          orientation={computed(() =>
            horizontal.value
              ? Orientation.Horizontal
              : Orientation.Vertical,
          )}
        >
          <UI.Border
            {...styles.status({ tone: 'critical' })}
            variableSizedWrapGridRowSpan={2}
          />
          <UI.Border
            {...styles.status({ tone: 'attention' })}
            variableSizedWrapGridColumnSpan={2}
          />
          <UI.Border {...styles.status({ tone: 'success' })} />
          <UI.Border {...styles.status({ tone: 'caution' })} />
        </UI.VariableSizedWrapGrid>
      </SampleCard>
    </Page>
  )
}
