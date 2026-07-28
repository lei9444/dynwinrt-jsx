import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { DialogsFlyoutsCategoryPage } from './index'
import { ContentDialogPage } from './content-dialog'
import { FlyoutPage } from './flyout'
import { PopupPage } from './popup'
import { TeachingTipPage } from './teaching-tip'
import { createGalleryRouteGroup } from '../route-group'

export function createDialogsFlyoutsRoutes(
  context: AppContext,
): readonly RouteDefinition[] {
  return createGalleryRouteGroup(context, {
    id: 'category-dialogs-flyouts',
    path: '/dialogs-flyouts',
    renderIndex: (value) => (
      <DialogsFlyoutsCategoryPage {...value} />
    ),
    pages: [
      { id: 'content-dialog', render: (value) => <ContentDialogPage {...value} /> },
      { id: 'flyout', render: (value) => <FlyoutPage {...value} /> },
      { id: 'popup', render: (value) => <PopupPage {...value} /> },
      { id: 'teaching-tip', render: (value) => <TeachingTipPage {...value} /> },
    ],
  })
}
