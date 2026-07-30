import { createLazyComponent } from 'dynwinrt-jsx'
import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { createGalleryRouteGroup } from '../route-group'

const WindowingCategoryPage = createLazyComponent(
  () => (require('./index') as typeof import('./index')).WindowingCategoryPage,
)

const AppWindowPage = createLazyComponent(
  () => (require('./app-window') as typeof import('./app-window')).AppWindowPage,
)

const AppWindowTitleBarPage = createLazyComponent(
  () => (require('./app-window-title-bar') as typeof import('./app-window-title-bar')).AppWindowTitleBarPage,
)

const MultipleWindowsPage = createLazyComponent(
  () => (require('./multiple-windows') as typeof import('./multiple-windows')).MultipleWindowsPage,
)

const TitleBarPage = createLazyComponent(
  () => (require('./title-bar') as typeof import('./title-bar')).TitleBarPage,
)

export function createWindowingRoutes(
  context: AppContext,
): readonly RouteDefinition[] {
  return createGalleryRouteGroup(context, {
    id: 'category-windowing',
    path: '/windowing',
    renderIndex: (value) => <WindowingCategoryPage {...value} />,
    pages: [
      { id: 'app-window', render: (value) => <AppWindowPage {...value} /> },
      { id: 'app-window-title-bar', render: (value) => <AppWindowTitleBarPage {...value} /> },
      { id: 'multiple-windows', render: (value) => <MultipleWindowsPage {...value} /> },
      { id: 'title-bar', render: (value) => <TitleBarPage {...value} /> },
    ],
  })
}
