import { createLazyComponent } from 'dynwinrt-jsx'
import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { createGalleryRouteGroup } from '../route-group'

const DialogsFlyoutsCategoryPage = createLazyComponent(
  () => (require('./index') as typeof import('./index')).DialogsFlyoutsCategoryPage,
)

const ContentDialogPage = createLazyComponent(
  () => (require('./content-dialog') as typeof import('./content-dialog')).ContentDialogPage,
)

const FlyoutPage = createLazyComponent(
  () => (require('./flyout') as typeof import('./flyout')).FlyoutPage,
)

const PopupPage = createLazyComponent(
  () => (require('./popup') as typeof import('./popup')).PopupPage,
)

const TeachingTipPage = createLazyComponent(
  () => (require('./teaching-tip') as typeof import('./teaching-tip')).TeachingTipPage,
)

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
