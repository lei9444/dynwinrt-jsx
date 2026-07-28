import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { AccessibilityCategoryPage } from './index'
import { ColorContrastPage } from './color-contrast'
import { KeyboardNavigationPage } from './keyboard-navigation'
import { ScreenReaderPage } from './screen-reader'
import { createGalleryRouteGroup } from '../route-group'

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
