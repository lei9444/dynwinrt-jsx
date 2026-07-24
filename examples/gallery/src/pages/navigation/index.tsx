import { type AppContext } from '../../gallery-ui'
import { CategoryPage } from '../../components/gallery-components'
import { navigationPages } from '../../gallery-data'

export function NavigationCategoryPage(context: AppContext) {
  return (
    <CategoryPage
      title="Navigation"
      subtitle="Breadcrumb paths, navigation panes, tabbed views, compact selectors, and document tabs."
      automationId="NavigationCategoryPageHeading"
      pages={navigationPages}
      model={context.model}
    />
  )
}
