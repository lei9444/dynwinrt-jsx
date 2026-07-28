import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../gallery-ui'
import type { GalleryRoute } from '../gallery-data'
import { HomePage } from './home'
import { SearchPage } from './search'
import { DiagnosticsPage } from './diagnostics'
import { SettingsPage } from './settings'
import { createFrameworkRoutes } from './framework/routes'
import { createBasicInputRoutes } from './basic-input/routes'
import { createCollectionsRoutes } from './collections/routes'
import { createDateTimeRoutes } from './date-time/routes'
import { createDialogsFlyoutsRoutes } from './dialogs-flyouts/routes'
import { createStatusInfoRoutes } from './status-info/routes'
import { createLayoutRoutes } from './layout/routes'
import { createMediaRoutes } from './media/routes'
import { createMotionRoutes } from './motion/routes'
import { createWindowingRoutes } from './windowing/routes'
import { createSystemRoutes } from './system/routes'
import { createShellRoutes } from './shell/routes'
import { createMenusToolbarsRoutes } from './menus-toolbars/routes'
import { createNavigationRoutes } from './navigation/routes'
import { createScrollingRoutes } from './scrolling/routes'
import { createTextRoutes } from './text/routes'
import { createFundamentalsRoutes } from './fundamentals/routes'
import { createDesignRoutes } from './design/routes'
import { createAccessibilityRoutes } from './accessibility/routes'
import { createStylesRoutes } from './styles/routes'

export const galleryCategoryRouteIds =
  new Map<string, GalleryRoute>([
    ['Basic input', 'category-basic-input'],
    ['Collections', 'category-collections'],
    ['Date & time', 'category-date-time'],
    ['Dialogs & flyouts', 'category-dialogs-flyouts'],
    ['Status & info', 'category-status-info'],
    ['Layout', 'category-layout'],
    ['Media', 'category-media'],
    ['Motion', 'category-motion'],
    ['Windowing', 'category-windowing'],
    ['System', 'category-system'],
    ['Shell', 'category-shell'],
    ['Menus & toolbars', 'category-menus-toolbars'],
    ['Navigation', 'category-navigation'],
    ['Scrolling', 'category-scrolling'],
    ['Text', 'category-text'],
    ['Fundamentals', 'category-fundamentals'],
    ['Design', 'category-design'],
    ['Accessibility', 'category-accessibility'],
    ['Styles', 'category-styles'],
  ])

export function createGalleryRoutes(
  context: AppContext,
): readonly RouteDefinition[] {
  return [
    {
      id: 'home',
      path: '/',
      render: () => <HomePage {...context} />,
    },
    {
      id: 'search',
      path: '/search',
      parentId: 'home',
      render: () => <SearchPage {...context} />,
    },
    {
      id: 'diagnostics',
      path: '/diagnostics',
      parentId: 'home',
      render: () => <DiagnosticsPage {...context} />,
    },
    {
      id: 'settings',
      path: '/settings',
      parentId: 'home',
      render: () => <SettingsPage {...context} />,
    },
    ...createFrameworkRoutes(context),
    ...createBasicInputRoutes(context),
    ...createCollectionsRoutes(context),
    ...createDateTimeRoutes(context),
    ...createDialogsFlyoutsRoutes(context),
    ...createStatusInfoRoutes(context),
    ...createLayoutRoutes(context),
    ...createMediaRoutes(context),
    ...createMotionRoutes(context),
    ...createWindowingRoutes(context),
    ...createSystemRoutes(context),
    ...createShellRoutes(context),
    ...createMenusToolbarsRoutes(context),
    ...createNavigationRoutes(context),
    ...createScrollingRoutes(context),
    ...createTextRoutes(context),
    ...createFundamentalsRoutes(context),
    ...createDesignRoutes(context),
    ...createAccessibilityRoutes(context),
    ...createStylesRoutes(context),
  ]
}
