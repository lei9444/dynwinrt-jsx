import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { MenusToolbarsCategoryPage } from './index'
import { AppBarButtonPage } from './app-bar-button'
import { AppBarSeparatorPage } from './app-bar-separator'
import { AppBarToggleButtonPage } from './app-bar-toggle-button'
import { CommandBarPage } from './command-bar'
import { CommandBarFlyoutPage } from './command-bar-flyout'
import { MenuBarPage } from './menu-bar'
import { MenuFlyoutPage } from './menu-flyout'
import { StandardUICommandPage } from './standard-ui-command'
import { SwipeControlPage } from './swipe-control'
import { XamlUICommandPage } from './xaml-ui-command'
import { createGalleryRouteGroup } from '../route-group'

export function createMenusToolbarsRoutes(
  context: AppContext,
): readonly RouteDefinition[] {
  return createGalleryRouteGroup(context, {
    id: 'category-menus-toolbars',
    path: '/menus-toolbars',
    renderIndex: (value) => (
      <MenusToolbarsCategoryPage {...value} />
    ),
    pages: [
      { id: 'app-bar-button', render: (value) => <AppBarButtonPage {...value} /> },
      { id: 'app-bar-separator', render: (value) => <AppBarSeparatorPage {...value} /> },
      { id: 'app-bar-toggle-button', render: (value) => <AppBarToggleButtonPage {...value} /> },
      { id: 'command-bar', render: (value) => <CommandBarPage {...value} /> },
      { id: 'command-bar-flyout', render: (value) => <CommandBarFlyoutPage {...value} /> },
      { id: 'menu-bar', render: (value) => <MenuBarPage {...value} /> },
      { id: 'menu-flyout', render: (value) => <MenuFlyoutPage {...value} /> },
      { id: 'swipe-control', render: (value) => <SwipeControlPage {...value} /> },
      { id: 'standard-ui-command', render: (value) => <StandardUICommandPage {...value} /> },
      { id: 'xaml-ui-command', render: (value) => <XamlUICommandPage {...value} /> },
    ],
  })
}
