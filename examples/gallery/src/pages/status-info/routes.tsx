import { createLazyComponent } from 'dynwinrt-jsx'
import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { createGalleryRouteGroup } from '../route-group'

const StatusInfoCategoryPage = createLazyComponent(
  () => (require('./index') as typeof import('./index')).StatusInfoCategoryPage,
)

const InfoBadgePage = createLazyComponent(
  () => (require('./info-badge') as typeof import('./info-badge')).InfoBadgePage,
)

const InfoBarPage = createLazyComponent(
  () => (require('./info-bar') as typeof import('./info-bar')).InfoBarPage,
)

const ProgressBarPage = createLazyComponent(
  () => (require('./progress-bar') as typeof import('./progress-bar')).ProgressBarPage,
)

const ProgressRingPage = createLazyComponent(
  () => (require('./progress-ring') as typeof import('./progress-ring')).ProgressRingPage,
)

const ToolTipPage = createLazyComponent(
  () => (require('./tool-tip') as typeof import('./tool-tip')).ToolTipPage,
)

export function createStatusInfoRoutes(
  context: AppContext,
): readonly RouteDefinition[] {
  return createGalleryRouteGroup(context, {
    id: 'category-status-info',
    path: '/status-info',
    renderIndex: (value) => (
      <StatusInfoCategoryPage {...value} />
    ),
    pages: [
      { id: 'info-badge', render: (value) => <InfoBadgePage {...value} /> },
      { id: 'info-bar', render: (value) => <InfoBarPage {...value} /> },
      { id: 'progress-bar', render: (value) => <ProgressBarPage {...value} /> },
      { id: 'progress-ring', render: (value) => <ProgressRingPage {...value} /> },
      { id: 'tool-tip', render: (value) => <ToolTipPage {...value} /> },
    ],
  })
}
