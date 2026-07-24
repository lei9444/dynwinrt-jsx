import { type AppContext } from '../../gallery-ui'
import { CategoryPage } from '../../components/gallery-components'
import { fundamentalsPages } from '../../gallery-data'

export function FundamentalsCategoryPage(context: AppContext) {
  return (
    <CategoryPage
      title="Fundamentals"
      subtitle="Resources, styles, binding, composition templates, reusable controls, conditions, and experimentation."
      automationId="FundamentalsCategoryPageHeading"
      pages={fundamentalsPages}
      model={context.model}
    />
  )
}
