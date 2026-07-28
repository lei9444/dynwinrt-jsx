import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { MotionCategoryPage } from './index'
import { AnimationInteropPage } from './animation-interop'
import { ConnectedAnimationPage } from './connected-animation'
import { EasingFunctionsPage } from './easing-functions'
import { ImplicitTransitionsPage } from './implicit-transitions'
import { PageTransitionsPage } from './page-transitions'
import { ParallaxViewPage } from './parallax-view'
import { ThemeTransitionsPage } from './theme-transitions'
import { createGalleryRouteGroup } from '../route-group'

export function createMotionRoutes(
  context: AppContext,
): readonly RouteDefinition[] {
  return createGalleryRouteGroup(context, {
    id: 'category-motion',
    path: '/motion',
    renderIndex: (value) => <MotionCategoryPage {...value} />,
    pages: [
      { id: 'animation-interop', render: (value) => <AnimationInteropPage {...value} /> },
      { id: 'connected-animation', render: (value) => <ConnectedAnimationPage {...value} /> },
      { id: 'easing-functions', render: (value) => <EasingFunctionsPage {...value} /> },
      { id: 'implicit-transitions', render: (value) => <ImplicitTransitionsPage {...value} /> },
      { id: 'page-transitions', render: (value) => <PageTransitionsPage {...value} /> },
      { id: 'theme-transitions', render: (value) => <ThemeTransitionsPage {...value} /> },
      { id: 'parallax-view', render: (value) => <ParallaxViewPage {...value} /> },
    ],
  })
}
