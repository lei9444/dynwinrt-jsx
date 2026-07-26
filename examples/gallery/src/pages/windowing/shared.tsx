import { onCleanup } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'

export function formatNativeError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : String(error)
}

export function useSecondaryWindowScope(
  context: AppContext,
) {
  const scope = context.secondaryWindows.createScope()
  onCleanup(scope.dispose)
  return scope
}
