import { type AppContext } from '../../gallery-ui'
import { CategoryPage } from '../../components/gallery-components'
import { layoutPages } from '../../gallery-data'

export function LayoutCategoryPage(context: AppContext) {
  return (
    <CategoryPage
      title="Layout"
      subtitle="Controls and panels for sizing, positioning, stacking, wrapping, and scaling content."
      automationId="LayoutCategoryPageHeading"
      pages={layoutPages}
      model={context.model}
    />
  )
}
