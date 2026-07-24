import { type AppContext } from '../../gallery-ui'
import { CategoryPage } from '../../components/gallery-components'
import { dateTimePages } from '../../gallery-data'

export function DateTimeCategoryPage(context: AppContext) {
  return (
    <CategoryPage
      title="Date & time"
      subtitle="Controls for selecting calendar dates and times."
      automationId="DateTimeCategoryPageHeading"
      pages={dateTimePages}
      model={context.model}
    />
  )
}
