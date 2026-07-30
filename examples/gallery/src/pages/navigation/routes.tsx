import { createLazyComponent } from 'dynwinrt-jsx'
import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { createGalleryRouteGroup } from '../route-group'

const NavigationCategoryPage = createLazyComponent(
  () => (require('./index') as typeof import('./index')).NavigationCategoryPage,
)

const BreadcrumbBarPage = createLazyComponent(
  () => (require('./breadcrumb-bar') as typeof import('./breadcrumb-bar')).BreadcrumbBarPage,
)

const NavigationViewPage = createLazyComponent(
  () => (require('./navigation-view') as typeof import('./navigation-view')).NavigationViewPage,
)

const PivotPage = createLazyComponent(
  () => (require('./pivot') as typeof import('./pivot')).PivotPage,
)

const SelectorBarPage = createLazyComponent(
  () => (require('./selector-bar') as typeof import('./selector-bar')).SelectorBarPage,
)

const TabViewPage = createLazyComponent(
  () => (require('./tab-view') as typeof import('./tab-view')).TabViewPage,
)

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
