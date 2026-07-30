import { createLazyComponent } from 'dynwinrt-jsx'
import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { createGalleryRouteGroup } from '../route-group'

const MenusToolbarsCategoryPage = createLazyComponent(
  () => (require('./index') as typeof import('./index')).MenusToolbarsCategoryPage,
)

const AppBarButtonPage = createLazyComponent(
  () => (require('./app-bar-button') as typeof import('./app-bar-button')).AppBarButtonPage,
)

const AppBarSeparatorPage = createLazyComponent(
  () => (require('./app-bar-separator') as typeof import('./app-bar-separator')).AppBarSeparatorPage,
)

const AppBarToggleButtonPage = createLazyComponent(
  () => (require('./app-bar-toggle-button') as typeof import('./app-bar-toggle-button')).AppBarToggleButtonPage,
)

const CommandBarPage = createLazyComponent(
  () => (require('./command-bar') as typeof import('./command-bar')).CommandBarPage,
)

const CommandBarFlyoutPage = createLazyComponent(
  () => (require('./command-bar-flyout') as typeof import('./command-bar-flyout')).CommandBarFlyoutPage,
)

const MenuBarPage = createLazyComponent(
  () => (require('./menu-bar') as typeof import('./menu-bar')).MenuBarPage,
)

const MenuFlyoutPage = createLazyComponent(
  () => (require('./menu-flyout') as typeof import('./menu-flyout')).MenuFlyoutPage,
)

const StandardUICommandPage = createLazyComponent(
  () => (require('./standard-ui-command') as typeof import('./standard-ui-command')).StandardUICommandPage,
)

const SwipeControlPage = createLazyComponent(
  () => (require('./swipe-control') as typeof import('./swipe-control')).SwipeControlPage,
)

const XamlUICommandPage = createLazyComponent(
  () => (require('./xaml-ui-command') as typeof import('./xaml-ui-command')).XamlUICommandPage,
)

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
