import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { DesignCategoryPage } from './index'
import { ColorPage } from './color'
import { GeometryPage } from './geometry'
import { IconographyPage } from './iconography'
import { SpacingPage } from './spacing'
import { TypographyPage } from './typography'
import { createGalleryRouteGroup } from '../route-group'

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
