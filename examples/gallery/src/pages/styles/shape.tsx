import {
  color,
  createSolidColorBrush,
  gridLength,
} from 'dynwinrt-jsx'
import { SolidColorBrush } from '#winapp/bindings'
import { type AppContext, LayoutGrid, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function ShapePage(context: AppContext) {
  const blue = createSolidColorBrush(
    SolidColorBrush,
    color(0, 120, 212),
  )
  const purple = createSolidColorBrush(
    SolidColorBrush,
    color(136, 23, 152),
  )

  return (
    <Page
      title="Shape"
      subtitle="Draws decorative native rectangles and ellipses."
      automationId="ShapePageHeading"
      pageId="shape"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStylesShapeSample"
        title="Rectangle and Ellipse"
        description="Shape-derived elements support native fill, stroke, size, and stretch properties."
        code={`
<UI.Rectangle fill={blue} />
<UI.Ellipse fill={purple} />
        `}
      >
        <LayoutGrid
          columnDefinitions={[
            gridLength.star(),
            gridLength.star(),
          ]}
          columnSpacing={24}
        >
          <UI.Rectangle
            automationId="GalleryStylesRectangle"
            width={160}
            height={120}
            fill={blue}
          />
          <UI.Ellipse
            automationId="GalleryStylesEllipse"
            gridColumn={1}
            width={140}
            height={140}
            fill={purple}
          />
        </LayoutGrid>
      </SampleCard>
    </Page>
  )
}
