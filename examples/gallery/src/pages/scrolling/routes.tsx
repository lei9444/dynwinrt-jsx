import { createLazyComponent } from 'dynwinrt-jsx'
import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { createGalleryRouteGroup } from '../route-group'

const ScrollingCategoryPage = createLazyComponent(
  () => (require('./index') as typeof import('./index')).ScrollingCategoryPage,
)

const AnnotatedScrollBarPage = createLazyComponent(
  () => (require('./annotated-scroll-bar') as typeof import('./annotated-scroll-bar')).AnnotatedScrollBarPage,
)

const PipsPagerPage = createLazyComponent(
  () => (require('./pips-pager') as typeof import('./pips-pager')).PipsPagerPage,
)

const ScrollViewPage = createLazyComponent(
  () => (require('./scroll-view') as typeof import('./scroll-view')).ScrollViewPage,
)

const ScrollViewerPage = createLazyComponent(
  () => (require('./scroll-viewer') as typeof import('./scroll-viewer')).ScrollViewerPage,
)

const SemanticZoomPage = createLazyComponent(
  () => (require('./semantic-zoom') as typeof import('./semantic-zoom')).SemanticZoomPage,
)

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
