import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { FundamentalsCategoryPage } from './index'
import { BindingPage } from './binding'
import { CustomUserControlsPage } from './custom-user-controls'
import { ScratchPadPage } from './scratch-pad'
import { StylePage } from './style'
import { TemplatesPage } from './templates'
import { XamlConditionsPage } from './xaml-conditions'
import { ResourcesPage } from './resources'
import { createGalleryRouteGroup } from '../route-group'

export function createFundamentalsRoutes(
  context: AppContext,
): readonly RouteDefinition[] {
  return createGalleryRouteGroup(context, {
    id: 'category-fundamentals',
    path: '/fundamentals',
    renderIndex: (value) => (
      <FundamentalsCategoryPage {...value} />
    ),
    pages: [
      { id: 'style', render: (value) => <StylePage {...value} /> },
      { id: 'binding', render: (value) => <BindingPage {...value} /> },
      { id: 'templates', render: (value) => <TemplatesPage {...value} /> },
      { id: 'custom-user-controls', render: (value) => <CustomUserControlsPage {...value} /> },
      { id: 'xaml-conditions', render: (value) => <XamlConditionsPage {...value} /> },
      { id: 'scratch-pad', render: (value) => <ScratchPadPage {...value} /> },
      { id: 'resources', render: (value) => <ResourcesPage {...value} /> },
    ],
  })
}
