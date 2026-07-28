import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { ScrollingCategoryPage } from './index'
import { AnnotatedScrollBarPage } from './annotated-scroll-bar'
import { PipsPagerPage } from './pips-pager'
import { ScrollViewPage } from './scroll-view'
import { ScrollViewerPage } from './scroll-viewer'
import { SemanticZoomPage } from './semantic-zoom'
import { createGalleryRouteGroup } from '../route-group'

export function createScrollingRoutes(
  context: AppContext,
): readonly RouteDefinition[] {
  return createGalleryRouteGroup(context, {
    id: 'category-scrolling',
    path: '/scrolling',
    renderIndex: (value) => (
      <ScrollingCategoryPage {...value} />
    ),
    pages: [
      { id: 'annotated-scroll-bar', render: (value) => <AnnotatedScrollBarPage {...value} /> },
      { id: 'pips-pager', render: (value) => <PipsPagerPage {...value} /> },
      { id: 'scroll-view', render: (value) => <ScrollViewPage {...value} /> },
      { id: 'scroll-viewer', render: (value) => <ScrollViewerPage {...value} /> },
      { id: 'semantic-zoom', render: (value) => <SemanticZoomPage {...value} /> },
    ],
  })
}
