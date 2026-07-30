import { createLazyComponent } from 'dynwinrt-jsx'
import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { createGalleryRouteGroup } from '../route-group'

const StylesCategoryPage = createLazyComponent(
  () => (require('./index') as typeof import('./index')).StylesCategoryPage,
)

const AcrylicBrushPage = createLazyComponent(
  () => (require('./acrylic-brush') as typeof import('./acrylic-brush')).AcrylicBrushPage,
)

const AnimatedIconPage = createLazyComponent(
  () => (require('./animated-icon') as typeof import('./animated-icon')).AnimatedIconPage,
)

const CompactSizingPage = createLazyComponent(
  () => (require('./compact-sizing') as typeof import('./compact-sizing')).CompactSizingPage,
)

const IconElementPage = createLazyComponent(
  () => (require('./icon-element') as typeof import('./icon-element')).IconElementPage,
)

const LinePage = createLazyComponent(
  () => (require('./line') as typeof import('./line')).LinePage,
)

const RadialGradientBrushPage = createLazyComponent(
  () => (require('./radial-gradient-brush') as typeof import('./radial-gradient-brush')).RadialGradientBrushPage,
)

const ShapePage = createLazyComponent(
  () => (require('./shape') as typeof import('./shape')).ShapePage,
)

const SystemBackdropElementPage = createLazyComponent(
  () => (require('./system-backdrop-element') as typeof import('./system-backdrop-element')).SystemBackdropElementPage,
)

const SystemBackdropsPage = createLazyComponent(
  () => (require('./system-backdrops') as typeof import('./system-backdrops')).SystemBackdropsPage,
)

const ThemeShadowPage = createLazyComponent(
  () => (require('./theme-shadow') as typeof import('./theme-shadow')).ThemeShadowPage,
)

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
