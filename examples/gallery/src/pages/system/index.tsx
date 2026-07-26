import { type AppContext } from '../../gallery-ui'
import { CategoryPage } from '../../components/gallery-components'
import { systemPages } from '../../gallery-data'

export function SystemCategoryPage(context: AppContext) {
  return (
    <CategoryPage
      title="System"
      subtitle="Clipboard data transfer, cross-framework ContentIsland hosting, and modern file and folder pickers."
      automationId="SystemCategoryPageHeading"
      pages={systemPages}
      model={context.model}
    />
  )
}
