import { createLazyComponent } from 'dynwinrt-jsx'
import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { createGalleryRouteGroup } from '../route-group'

const SystemCategoryPage = createLazyComponent(
  () => (require('./index') as typeof import('./index')).SystemCategoryPage,
)

const ClipboardPage = createLazyComponent(
  () => (require('./clipboard') as typeof import('./clipboard')).ClipboardPage,
)

const ContentIslandPage = createLazyComponent(
  () => (require('./content-island') as typeof import('./content-island')).ContentIslandPage,
)

const StoragePickersPage = createLazyComponent(
  () => (require('./storage-pickers') as typeof import('./storage-pickers')).StoragePickersPage,
)

export function createSystemRoutes(
  context: AppContext,
): readonly RouteDefinition[] {
  return createGalleryRouteGroup(context, {
    id: 'category-system',
    path: '/system',
    renderIndex: (value) => <SystemCategoryPage {...value} />,
    pages: [
      { id: 'clipboard', render: (value) => <ClipboardPage {...value} /> },
      { id: 'content-island', render: (value) => <ContentIslandPage {...value} /> },
      { id: 'storage-pickers', render: (value) => <StoragePickersPage {...value} /> },
    ],
  })
}
