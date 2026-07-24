import {
  computed,
  gridLength,
  signal,
  styles,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  type AppContext,
  LayoutGrid,
  type SliderInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function GridPage(context: AppContext) {
  const rowSpacing = signal(4)
  const columnSpacing = signal(4)
  const redRow = signal(0)
  const redColumn = signal(0)
  const rowSpacingSlider: RefObject<SliderInstance> = { current: null }
  const columnSpacingSlider: RefObject<SliderInstance> = { current: null }
  const rowSlider: RefObject<SliderInstance> = { current: null }
  const columnSlider: RefObject<SliderInstance> = { current: null }

  return (
    <Page
      title="Grid"
      subtitle="Typed rows, columns, spacing, and attached child positions."
      automationId="GridPageHeading"
      pageId="grid"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryLayoutGridSample"
        title="A 3 by 3 Grid"
        description="Adjust row and column spacing and move the red tile between cells."
        code={`
<LayoutGrid
  rowDefinitions={[gridLength.pixel(50), gridLength.pixel(50), gridLength.pixel(50)]}
  columnDefinitions={[gridLength.pixel(50), gridLength.pixel(50), gridLength.pixel(50)]}
  rowSpacing={rowSpacing}
  columnSpacing={columnSpacing}
>
  <UI.Border gridRow={row} gridColumn={column} />
</LayoutGrid>
        `}
        options={
          <UI.StackPanel spacing={10}>
            <UI.Slider
              ref={rowSpacingSlider}
              automationId="GalleryGridRowSpacing"
              header="RowSpacing"
              value={4}
              minimum={0}
              maximum={16}
              onValueChanged={() => {
                const next = rowSpacingSlider.current?.value
                if (next !== undefined && next !== rowSpacing.value) {
                  rowSpacing.value = next
                  context.model.recordInteraction()
                }
              }}
            />
            <UI.Slider
              ref={columnSpacingSlider}
              automationId="GalleryGridColumnSpacing"
              header="ColumnSpacing"
              value={4}
              minimum={0}
              maximum={16}
              onValueChanged={() => {
                const next = columnSpacingSlider.current?.value
                if (
                  next !== undefined &&
                  next !== columnSpacing.value
                ) {
                  columnSpacing.value = next
                  context.model.recordInteraction()
                }
              }}
            />
            <UI.Slider
              ref={rowSlider}
              automationId="GalleryGridRow"
              header="Grid.Row"
              value={0}
              minimum={0}
              maximum={2}
              stepFrequency={1}
              onValueChanged={() => {
                const next = rowSlider.current?.value
                if (next !== undefined) {
                  const row = Math.round(next)
                  if (row !== redRow.value) {
                    redRow.value = row
                    context.model.recordInteraction()
                  }
                }
              }}
            />
            <UI.Slider
              ref={columnSlider}
              automationId="GalleryGridColumn"
              header="Grid.Column"
              value={0}
              minimum={0}
              maximum={2}
              stepFrequency={1}
              onValueChanged={() => {
                const next = columnSlider.current?.value
                if (next !== undefined) {
                  const column = Math.round(next)
                  if (column !== redColumn.value) {
                    redColumn.value = column
                    context.model.recordInteraction()
                  }
                }
              }}
            />
          </UI.StackPanel>
        }
      >
        <LayoutGrid
          automationId="GalleryGridControl"
          rowDefinitions={[
            gridLength.pixel(50),
            gridLength.pixel(50),
            gridLength.pixel(50),
          ]}
          columnDefinitions={[
            gridLength.pixel(50),
            gridLength.pixel(50),
            gridLength.pixel(50),
          ]}
          rowSpacing={rowSpacing}
          columnSpacing={columnSpacing}
        >
          <UI.Border
            {...styles.status({ tone: 'critical' })}
            gridRow={redRow}
            gridColumn={redColumn}
          />
          <UI.Border
            {...styles.status({ tone: 'attention' })}
            gridColumn={2}
          />
          <UI.Border
            {...styles.status({ tone: 'success' })}
            gridRow={2}
          />
          <UI.Border
            {...styles.status({ tone: 'caution' })}
            gridRow={2}
            gridColumn={2}
          />
        </LayoutGrid>
      </SampleCard>
    </Page>
  )
}
