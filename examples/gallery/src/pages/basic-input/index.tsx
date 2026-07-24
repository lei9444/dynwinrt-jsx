import { type AppContext } from '../../gallery-ui'
import { CategoryPage } from '../../components/gallery-components'
import { basicInputPages } from '../../gallery-data'

export function BasicInputCategoryPage(context: AppContext) {
  return (
    <CategoryPage
      title="Basic input"
      subtitle="Controls that let users invoke actions, choose values, and switch between states."
      automationId="BasicInputCategoryPageHeading"
      pages={basicInputPages}
      model={context.model}
    />
  )
}
