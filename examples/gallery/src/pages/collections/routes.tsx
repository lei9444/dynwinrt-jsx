import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { CollectionsCategoryPage } from './index'
import { FlipViewPage } from './flip-view'
import { GridViewPage } from './grid-view'
import { ItemsRepeaterPage } from './items-repeater'
import { ItemsViewPage } from './items-view'
import { ListViewPage } from './list-view'
import { PullToRefreshPage } from './pull-to-refresh'
import { TreeViewPage } from './tree-view'
import { createGalleryRouteGroup } from '../route-group'

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
