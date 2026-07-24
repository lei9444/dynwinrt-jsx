import { type AppContext } from '../../gallery-ui'
import { CategoryPage } from '../../components/gallery-components'
import { designPages } from '../../gallery-data'

export function DesignCategoryPage(context: AppContext) {
  return (
    <CategoryPage
      title="Design"
      subtitle="Color, geometry, iconography, spacing, and typography foundations."
      automationId="DesignCategoryPageHeading"
      pages={designPages}
      model={context.model}
    />
  )
}
