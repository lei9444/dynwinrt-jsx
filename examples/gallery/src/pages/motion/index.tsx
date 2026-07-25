import { type AppContext } from '../../gallery-ui'
import { CategoryPage } from '../../components/gallery-components'
import { motionPages } from '../../gallery-data'

export function MotionCategoryPage(context: AppContext) {
  return (
    <CategoryPage
      title="Motion"
      subtitle="Composition interop, connected animation, easing, implicit and theme transitions, page navigation, and parallax."
      automationId="MotionCategoryPageHeading"
      pages={motionPages}
      model={context.model}
    />
  )
}
