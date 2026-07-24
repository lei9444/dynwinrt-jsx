import { type AppContext } from '../../gallery-ui'
import { CategoryPage } from '../../components/gallery-components'
import { collectionPages } from '../../gallery-data'

export function CollectionsCategoryPage(context: AppContext) {
  return (
    <CategoryPage
      title="Collections"
      subtitle="Controls that present, select, virtualize, refresh, and organize collections."
      automationId="CollectionsCategoryPageHeading"
      pages={collectionPages}
      model={context.model}
    />
  )
}
