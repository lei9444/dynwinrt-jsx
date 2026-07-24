import { type AppContext } from '../../gallery-ui'
import { CategoryPage } from '../../components/gallery-components'
import { stylesPages } from '../../gallery-data'

export function StylesCategoryPage(context: AppContext) {
  return (
    <CategoryPage
      title="Styles"
      subtitle="Materials, icons, sizing, shapes, gradients, backdrops, and shadows."
      automationId="StylesCategoryPageHeading"
      pages={stylesPages}
      model={context.model}
    />
  )
}
