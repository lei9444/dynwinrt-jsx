import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { NavigationCategoryPage } from './index'
import { BreadcrumbBarPage } from './breadcrumb-bar'
import { NavigationViewPage } from './navigation-view'
import { PivotPage } from './pivot'
import { SelectorBarPage } from './selector-bar'
import { TabViewPage } from './tab-view'
import { createGalleryRouteGroup } from '../route-group'

export function createNavigationRoutes(
  context: AppContext,
): readonly RouteDefinition[] {
  return createGalleryRouteGroup(context, {
    id: 'category-navigation',
    path: '/navigation',
    renderIndex: (value) => (
      <NavigationCategoryPage {...value} />
    ),
    pages: [
      { id: 'breadcrumb-bar', render: (value) => <BreadcrumbBarPage {...value} /> },
      { id: 'navigation-view', render: (value) => <NavigationViewPage {...value} /> },
      { id: 'pivot', render: (value) => <PivotPage {...value} /> },
      { id: 'selector-bar', render: (value) => <SelectorBarPage {...value} /> },
      { id: 'tab-view', render: (value) => <TabViewPage {...value} /> },
    ],
  })
}
