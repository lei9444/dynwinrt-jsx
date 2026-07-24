import { type AppContext } from '../../gallery-ui'
import { CategoryPage } from '../../components/gallery-components'
import { accessibilityPages } from '../../gallery-data'

export function AccessibilityCategoryPage(context: AppContext) {
  return (
    <CategoryPage
      title="Accessibility"
      subtitle="Color contrast, keyboard focus, and meaningful screen-reader metadata."
      automationId="AccessibilityCategoryPageHeading"
      pages={accessibilityPages}
      model={context.model}
    />
  )
}
