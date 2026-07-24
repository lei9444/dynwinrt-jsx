import { type AppContext } from '../../gallery-ui'
import { CategoryPage } from '../../components/gallery-components'
import { textPages } from '../../gallery-data'

export function TextCategoryPage(context: AppContext) {
  return (
    <CategoryPage
      title="Text"
      subtitle="Search, numeric, secret, rich, display, and editable text controls."
      automationId="TextCategoryPageHeading"
      pages={textPages}
      model={context.model}
    />
  )
}
