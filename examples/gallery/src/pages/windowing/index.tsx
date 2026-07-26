import { type AppContext } from '../../gallery-ui'
import { CategoryPage } from '../../components/gallery-components'
import { windowingPages } from '../../gallery-data'

export function WindowingCategoryPage(context: AppContext) {
  return (
    <CategoryPage
      title="Windowing"
      subtitle="AppWindow management, system and XAML title bars, presenters, and multiple top-level windows."
      automationId="WindowingCategoryPageHeading"
      pages={windowingPages}
      model={context.model}
    />
  )
}

