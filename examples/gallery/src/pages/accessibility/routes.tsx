import { createLazyComponent } from 'dynwinrt-jsx'
import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { createGalleryRouteGroup } from '../route-group'

const AccessibilityCategoryPage = createLazyComponent(
  () => (require('./index') as typeof import('./index')).AccessibilityCategoryPage,
)

const ColorContrastPage = createLazyComponent(
  () => (require('./color-contrast') as typeof import('./color-contrast')).ColorContrastPage,
)

const KeyboardNavigationPage = createLazyComponent(
  () => (require('./keyboard-navigation') as typeof import('./keyboard-navigation')).KeyboardNavigationPage,
)

const ScreenReaderPage = createLazyComponent(
  () => (require('./screen-reader') as typeof import('./screen-reader')).ScreenReaderPage,
)

export function createAccessibilityRoutes(
  context: AppContext,
): readonly RouteDefinition[] {
  return createGalleryRouteGroup(context, {
    id: 'category-accessibility',
    path: '/accessibility',
    renderIndex: (value) => (
      <AccessibilityCategoryPage {...value} />
    ),
    pages: [
      { id: 'color-contrast', render: (value) => <ColorContrastPage {...value} /> },
      { id: 'keyboard-navigation', render: (value) => <KeyboardNavigationPage {...value} /> },
      { id: 'screen-reader', render: (value) => <ScreenReaderPage {...value} /> },
    ],
  })
}
