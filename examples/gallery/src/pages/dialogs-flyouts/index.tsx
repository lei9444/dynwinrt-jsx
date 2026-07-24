import { type AppContext } from '../../gallery-ui'
import { CategoryPage } from '../../components/gallery-components'
import { dialogsFlyoutsPages } from '../../gallery-data'

export function DialogsFlyoutsCategoryPage(context: AppContext) {
  return (
    <CategoryPage
      title="Dialogs & flyouts"
      subtitle="Modal and lightweight overlays for decisions, details, custom panels, and guidance."
      automationId="DialogsFlyoutsCategoryPageHeading"
      pages={dialogsFlyoutsPages}
      model={context.model}
    />
  )
}
