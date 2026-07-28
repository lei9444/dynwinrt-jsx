import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { LayoutCategoryPage } from './index'
import { BorderPage } from './border'
import { CanvasPage } from './canvas'
import { ExpanderPage } from './expander'
import { GridPage } from './grid'
import { RelativePanelPage } from './relative-panel'
import { SplitViewPage } from './split-view'
import { StackPanelPage } from './stack-panel'
import { VariableSizedWrapGridPage } from './variable-sized-wrap-grid'
import { ViewboxPage } from './viewbox'
import { createGalleryRouteGroup } from '../route-group'

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
