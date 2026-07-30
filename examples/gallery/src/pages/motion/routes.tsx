import { createLazyComponent } from 'dynwinrt-jsx'
import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { createGalleryRouteGroup } from '../route-group'

const MotionCategoryPage = createLazyComponent(
  () => (require('./index') as typeof import('./index')).MotionCategoryPage,
)

const AnimationInteropPage = createLazyComponent(
  () => (require('./animation-interop') as typeof import('./animation-interop')).AnimationInteropPage,
)

const ConnectedAnimationPage = createLazyComponent(
  () => (require('./connected-animation') as typeof import('./connected-animation')).ConnectedAnimationPage,
)

const EasingFunctionsPage = createLazyComponent(
  () => (require('./easing-functions') as typeof import('./easing-functions')).EasingFunctionsPage,
)

const ImplicitTransitionsPage = createLazyComponent(
  () => (require('./implicit-transitions') as typeof import('./implicit-transitions')).ImplicitTransitionsPage,
)

const PageTransitionsPage = createLazyComponent(
  () => (require('./page-transitions') as typeof import('./page-transitions')).PageTransitionsPage,
)

const ParallaxViewPage = createLazyComponent(
  () => (require('./parallax-view') as typeof import('./parallax-view')).ParallaxViewPage,
)

const ThemeTransitionsPage = createLazyComponent(
  () => (require('./theme-transitions') as typeof import('./theme-transitions')).ThemeTransitionsPage,
)

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
