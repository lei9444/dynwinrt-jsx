import { type AppContext } from '../../gallery-ui'
import { CategoryPage } from '../../components/gallery-components'
import { shellPages } from '../../gallery-data'

export function ShellCategoryPage(context: AppContext) {
  return (
    <CategoryPage
      title="Shell"
      subtitle="App notifications, taskbar badges, and JumpList integration with truthful package and platform capability reporting."
      automationId="ShellCategoryPageHeading"
      pages={shellPages}
      model={context.model}
    />
  )
}
