import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { SelectionPage } from './selection'
import { SignalsPage } from './signals'

export function createFrameworkRoutes(
  context: AppContext,
): readonly RouteDefinition[] {
  return [
    {
      id: 'signals',
      path: '/framework/signals',
      parentId: 'home',
      render: () => <SignalsPage {...context} />,
    },
    {
      id: 'selection',
      path: '/framework/selection',
      parentId: 'home',
      render: () => <SelectionPage {...context} />,
    },
  ]
}
