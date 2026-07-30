import { createLazyComponent } from 'dynwinrt-jsx'
import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { createGalleryRouteGroup } from '../route-group'

const CollectionsCategoryPage = createLazyComponent(
  () => (require('./index') as typeof import('./index')).CollectionsCategoryPage,
)

const FlipViewPage = createLazyComponent(
  () => (require('./flip-view') as typeof import('./flip-view')).FlipViewPage,
)

const GridViewPage = createLazyComponent(
  () => (require('./grid-view') as typeof import('./grid-view')).GridViewPage,
)

const ItemsRepeaterPage = createLazyComponent(
  () => (require('./items-repeater') as typeof import('./items-repeater')).ItemsRepeaterPage,
)

const ItemsViewPage = createLazyComponent(
  () => (require('./items-view') as typeof import('./items-view')).ItemsViewPage,
)

const ListViewPage = createLazyComponent(
  () => (require('./list-view') as typeof import('./list-view')).ListViewPage,
)

const PullToRefreshPage = createLazyComponent(
  () => (require('./pull-to-refresh') as typeof import('./pull-to-refresh')).PullToRefreshPage,
)

const TreeViewPage = createLazyComponent(
  () => (require('./tree-view') as typeof import('./tree-view')).TreeViewPage,
)

export function createCollectionsRoutes(
  context: AppContext,
): readonly RouteDefinition[] {
  return createGalleryRouteGroup(context, {
    id: 'category-collections',
    path: '/collections',
    renderIndex: (value) => (
      <CollectionsCategoryPage {...value} />
    ),
    pages: [
      { id: 'flip-view', render: (value) => <FlipViewPage {...value} /> },
      { id: 'grid-view', render: (value) => <GridViewPage {...value} /> },
      { id: 'items-repeater', render: (value) => <ItemsRepeaterPage {...value} /> },
      { id: 'items-view', render: (value) => <ItemsViewPage {...value} /> },
      { id: 'list-view', render: (value) => <ListViewPage {...value} /> },
      { id: 'pull-to-refresh', render: (value) => <PullToRefreshPage {...value} /> },
      { id: 'tree-view', render: (value) => <TreeViewPage {...value} /> },
    ],
  })
}
