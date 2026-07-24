import { type AppContext } from '../../gallery-ui'
import { CategoryPage } from '../../components/gallery-components'
import { statusInfoPages } from '../../gallery-data'

export function StatusInfoCategoryPage(context: AppContext) {
  return (
    <CategoryPage
      title="Status & info"
      subtitle="Controls for notifications, contextual help, activity, and progress."
      automationId="StatusInfoCategoryPageHeading"
      pages={statusInfoPages}
      model={context.model}
    />
  )
}
