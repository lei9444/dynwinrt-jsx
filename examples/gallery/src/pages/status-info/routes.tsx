import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { StatusInfoCategoryPage } from './index'
import { InfoBadgePage } from './info-badge'
import { InfoBarPage } from './info-bar'
import { ProgressBarPage } from './progress-bar'
import { ProgressRingPage } from './progress-ring'
import { ToolTipPage } from './tool-tip'
import { createGalleryRouteGroup } from '../route-group'

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
