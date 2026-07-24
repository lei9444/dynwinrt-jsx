import { type AppContext } from '../../gallery-ui'
import { CategoryPage } from '../../components/gallery-components'
import { menusToolbarsPages } from '../../gallery-data'

export function MenusToolbarsCategoryPage(context: AppContext) {
  return (
    <CategoryPage
      title="Menus & toolbars"
      subtitle="Command buttons, bars, menus, swipe actions, and reusable command objects."
      automationId="MenusToolbarsCategoryPageHeading"
      pages={menusToolbarsPages}
      model={context.model}
    />
  )
}
