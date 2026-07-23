import { gridLength, styles, thickness } from 'dynwinrt-jsx'
import { type AppContext, LayoutGrid, UI } from '../gallery-ui'
import { Page, SampleCard } from '../components/gallery-components'

export function LayoutPage(context: AppContext) {
  return (
    <Page
      title="Grid and layout"
      subtitle="Typed track definitions combine with native attached Grid properties."
      automationId="LayoutPageHeading"
      pageId="layout"
      model={context.model}
    >
      <SampleCard
        title="Responsive Grid tracks"
        description="Rows and columns are native definitions, not parsed CSS strings."
        code={`
<LayoutGrid
  rowDefinitions={[gridLength.auto(), gridLength.star()]}
  columnDefinitions={[gridLength.star(), gridLength.star()]}
  rowSpacing={12}
  columnSpacing={12}
>
  <UI.Border gridColumnSpan={2}>Header</UI.Border>
  <UI.Border gridRow={1}>Left</UI.Border>
  <UI.Border gridRow={1} gridColumn={1}>Right</UI.Border>
</LayoutGrid>
        `}
      >
        <LayoutGrid
          rowDefinitions={[
            gridLength.auto(),
            gridLength.star(),
          ]}
          columnDefinitions={[
            gridLength.star(),
            gridLength.star(),
          ]}
          rowSpacing={12}
          columnSpacing={12}
          minHeight={260}
        >
          <UI.Border
            {...styles.status({ tone: 'attention' })}
            gridColumnSpan={2}
            padding={thickness(16)}
          >
            <UI.TextBlock text="Auto-height header" />
          </UI.Border>
          <UI.Border
            {...styles.card({ surface: 'card' })}
            gridRow={1}
            padding={thickness(16)}
          >
            <UI.TextBlock text="Star-sized left column" />
          </UI.Border>
          <UI.Border
            {...styles.card({ surface: 'layer' })}
            gridRow={1}
            gridColumn={1}
            padding={thickness(16)}
          >
            <UI.TextBlock text="Star-sized right column" />
          </UI.Border>
        </LayoutGrid>
      </SampleCard>
    </Page>
  )
}
