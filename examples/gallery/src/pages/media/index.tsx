import { type AppContext } from '../../gallery-ui'
import { CategoryPage } from '../../components/gallery-components'
import { mediaPages } from '../../gallery-data'

export function MediaCategoryPage(context: AppContext) {
  return (
    <CategoryPage
      title="Media"
      subtitle="Images, motion graphics, camera, maps, video, people, and sound."
      automationId="MediaCategoryPageHeading"
      pages={mediaPages}
      model={context.model}
    />
  )
}
