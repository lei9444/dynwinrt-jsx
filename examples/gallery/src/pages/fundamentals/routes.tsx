import { createLazyComponent } from 'dynwinrt-jsx'
import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { createGalleryRouteGroup } from '../route-group'

const FundamentalsCategoryPage = createLazyComponent(
  () => (require('./index') as typeof import('./index')).FundamentalsCategoryPage,
)

const BindingPage = createLazyComponent(
  () => (require('./binding') as typeof import('./binding')).BindingPage,
)

const CustomUserControlsPage = createLazyComponent(
  () => (require('./custom-user-controls') as typeof import('./custom-user-controls')).CustomUserControlsPage,
)

const ScratchPadPage = createLazyComponent(
  () => (require('./scratch-pad') as typeof import('./scratch-pad')).ScratchPadPage,
)

const StylePage = createLazyComponent(
  () => (require('./style') as typeof import('./style')).StylePage,
)

const TemplatesPage = createLazyComponent(
  () => (require('./templates') as typeof import('./templates')).TemplatesPage,
)

const XamlConditionsPage = createLazyComponent(
  () => (require('./xaml-conditions') as typeof import('./xaml-conditions')).XamlConditionsPage,
)

const ResourcesPage = createLazyComponent(
  () => (require('./resources') as typeof import('./resources')).ResourcesPage,
)

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
