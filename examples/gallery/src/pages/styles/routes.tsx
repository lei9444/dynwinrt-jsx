import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { StylesCategoryPage } from './index'
import { AcrylicBrushPage } from './acrylic-brush'
import { AnimatedIconPage } from './animated-icon'
import { CompactSizingPage } from './compact-sizing'
import { IconElementPage } from './icon-element'
import { LinePage } from './line'
import { RadialGradientBrushPage } from './radial-gradient-brush'
import { ShapePage } from './shape'
import { SystemBackdropElementPage } from './system-backdrop-element'
import { SystemBackdropsPage } from './system-backdrops'
import { ThemeShadowPage } from './theme-shadow'
import { createGalleryRouteGroup } from '../route-group'

export function createStylesRoutes(
  context: AppContext,
): readonly RouteDefinition[] {
  return createGalleryRouteGroup(context, {
    id: 'category-styles',
    path: '/styles',
    renderIndex: (value) => <StylesCategoryPage {...value} />,
    pages: [
      { id: 'acrylic-brush', render: (value) => <AcrylicBrushPage {...value} /> },
      { id: 'animated-icon', render: (value) => <AnimatedIconPage {...value} /> },
      { id: 'compact-sizing', render: (value) => <CompactSizingPage {...value} /> },
      { id: 'icon-element', render: (value) => <IconElementPage {...value} /> },
      { id: 'line', render: (value) => <LinePage {...value} /> },
      { id: 'shape', render: (value) => <ShapePage {...value} /> },
      { id: 'radial-gradient-brush', render: (value) => <RadialGradientBrushPage {...value} /> },
      { id: 'system-backdrops', render: (value) => <SystemBackdropsPage {...value} /> },
      { id: 'system-backdrop-element', render: (value) => <SystemBackdropElementPage {...value} /> },
      { id: 'theme-shadow', render: (value) => <ThemeShadowPage {...value} /> },
    ],
  })
}
