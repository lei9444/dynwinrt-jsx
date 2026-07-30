import { createLazyComponent } from 'dynwinrt-jsx'
import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'

const SelectionPage = createLazyComponent(
  () => (require('./selection') as typeof import('./selection')).SelectionPage,
)

const SignalsPage = createLazyComponent(
  () => (require('./signals') as typeof import('./signals')).SignalsPage,
)

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
