import { createLazyComponent } from 'dynwinrt-jsx'
import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { createGalleryRouteGroup } from '../route-group'

const LayoutCategoryPage = createLazyComponent(
  () => (require('./index') as typeof import('./index')).LayoutCategoryPage,
)

const BorderPage = createLazyComponent(
  () => (require('./border') as typeof import('./border')).BorderPage,
)

const CanvasPage = createLazyComponent(
  () => (require('./canvas') as typeof import('./canvas')).CanvasPage,
)

const ExpanderPage = createLazyComponent(
  () => (require('./expander') as typeof import('./expander')).ExpanderPage,
)

const GridPage = createLazyComponent(
  () => (require('./grid') as typeof import('./grid')).GridPage,
)

const RelativePanelPage = createLazyComponent(
  () => (require('./relative-panel') as typeof import('./relative-panel')).RelativePanelPage,
)

const SplitViewPage = createLazyComponent(
  () => (require('./split-view') as typeof import('./split-view')).SplitViewPage,
)

const StackPanelPage = createLazyComponent(
  () => (require('./stack-panel') as typeof import('./stack-panel')).StackPanelPage,
)

const VariableSizedWrapGridPage = createLazyComponent(
  () => (require('./variable-sized-wrap-grid') as typeof import('./variable-sized-wrap-grid')).VariableSizedWrapGridPage,
)

const ViewboxPage = createLazyComponent(
  () => (require('./viewbox') as typeof import('./viewbox')).ViewboxPage,
)

export function createLayoutRoutes(
  context: AppContext,
): readonly RouteDefinition[] {
  return createGalleryRouteGroup(context, {
    id: 'category-layout',
    path: '/layout',
    renderIndex: (value) => <LayoutCategoryPage {...value} />,
    pages: [
      { id: 'border', render: (value) => <BorderPage {...value} /> },
      { id: 'canvas', render: (value) => <CanvasPage {...value} /> },
      { id: 'expander', render: (value) => <ExpanderPage {...value} /> },
      { id: 'grid', render: (value) => <GridPage {...value} /> },
      { id: 'relative-panel', render: (value) => <RelativePanelPage {...value} /> },
      { id: 'split-view', render: (value) => <SplitViewPage {...value} /> },
      { id: 'stack-panel', render: (value) => <StackPanelPage {...value} /> },
      { id: 'variable-sized-wrap-grid', render: (value) => <VariableSizedWrapGridPage {...value} /> },
      { id: 'viewbox', render: (value) => <ViewboxPage {...value} /> },
    ],
  })
}
