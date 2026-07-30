import { createLazyComponent } from 'dynwinrt-jsx'
import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { createGalleryRouteGroup } from '../route-group'

const ShellCategoryPage = createLazyComponent(
  () => (require('./index') as typeof import('./index')).ShellCategoryPage,
)

const AppNotificationsPage = createLazyComponent(
  () => (require('./app-notifications') as typeof import('./app-notifications')).AppNotificationsPage,
)

const BadgeNotificationsPage = createLazyComponent(
  () => (require('./badge-notifications') as typeof import('./badge-notifications')).BadgeNotificationsPage,
)

const JumpListPage = createLazyComponent(
  () => (require('./jump-list') as typeof import('./jump-list')).JumpListPage,
)

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
