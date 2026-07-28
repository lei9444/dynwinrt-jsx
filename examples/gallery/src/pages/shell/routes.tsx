import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { ShellCategoryPage } from './index'
import { AppNotificationsPage } from './app-notifications'
import { BadgeNotificationsPage } from './badge-notifications'
import { JumpListPage } from './jump-list'
import { createGalleryRouteGroup } from '../route-group'

export function createShellRoutes(
  context: AppContext,
): readonly RouteDefinition[] {
  return createGalleryRouteGroup(context, {
    id: 'category-shell',
    path: '/shell',
    renderIndex: (value) => <ShellCategoryPage {...value} />,
    pages: [
      { id: 'app-notifications', render: (value) => <AppNotificationsPage {...value} /> },
      { id: 'badge-notifications', render: (value) => <BadgeNotificationsPage {...value} /> },
      { id: 'jump-list', render: (value) => <JumpListPage {...value} /> },
    ],
  })
}
