import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { SystemCategoryPage } from './index'
import { ClipboardPage } from './clipboard'
import { ContentIslandPage } from './content-island'
import { StoragePickersPage } from './storage-pickers'
import { createGalleryRouteGroup } from '../route-group'

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
