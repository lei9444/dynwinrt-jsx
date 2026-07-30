import { createLazyComponent } from 'dynwinrt-jsx'
import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { createGalleryRouteGroup } from '../route-group'

const DesignCategoryPage = createLazyComponent(
  () => (require('./index') as typeof import('./index')).DesignCategoryPage,
)

const ColorPage = createLazyComponent(
  () => (require('./color') as typeof import('./color')).ColorPage,
)

const GeometryPage = createLazyComponent(
  () => (require('./geometry') as typeof import('./geometry')).GeometryPage,
)

const IconographyPage = createLazyComponent(
  () => (require('./iconography') as typeof import('./iconography')).IconographyPage,
)

const SpacingPage = createLazyComponent(
  () => (require('./spacing') as typeof import('./spacing')).SpacingPage,
)

const TypographyPage = createLazyComponent(
  () => (require('./typography') as typeof import('./typography')).TypographyPage,
)

export function createDesignRoutes(
  context: AppContext,
): readonly RouteDefinition[] {
  return createGalleryRouteGroup(context, {
    id: 'category-design',
    path: '/design',
    renderIndex: (value) => <DesignCategoryPage {...value} />,
    pages: [
      { id: 'color', render: (value) => <ColorPage {...value} /> },
      { id: 'geometry', render: (value) => <GeometryPage {...value} /> },
      { id: 'iconography', render: (value) => <IconographyPage {...value} /> },
      { id: 'spacing', render: (value) => <SpacingPage {...value} /> },
      { id: 'typography', render: (value) => <TypographyPage {...value} /> },
    ],
  })
}
