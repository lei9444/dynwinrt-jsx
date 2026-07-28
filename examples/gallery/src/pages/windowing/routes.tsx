import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { WindowingCategoryPage } from './index'
import { AppWindowPage } from './app-window'
import { AppWindowTitleBarPage } from './app-window-title-bar'
import { MultipleWindowsPage } from './multiple-windows'
import { TitleBarPage } from './title-bar'
import { createGalleryRouteGroup } from '../route-group'

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
