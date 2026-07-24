import { type AppContext } from '../../gallery-ui'
import { CategoryPage } from '../../components/gallery-components'
import { scrollingPages } from '../../gallery-data'

export function ScrollingCategoryPage(context: AppContext) {
  return (
    <CategoryPage
      title="Scrolling"
      subtitle="Annotated rails, pagers, modern and classic scroll surfaces, and semantic collection views."
      automationId="ScrollingCategoryPageHeading"
      pages={scrollingPages}
      model={context.model}
    />
  )
}
