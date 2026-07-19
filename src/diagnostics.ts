import type { RendererDiagnostics } from './renderer'

export function hasActiveRendererRecords(
  diagnostics: RendererDiagnostics,
): boolean {
  return (
    diagnostics.activeNative !== 0 ||
    diagnostics.activeComponents !== 0
  )
}

export function assertRendererIdle(
  diagnostics: RendererDiagnostics,
  label = 'Renderer disposal',
): void {
  if (hasActiveRendererRecords(diagnostics)) {
    throw new Error(
      `${label} left active records: ${JSON.stringify(diagnostics)}`,
    )
  }
}

export function formatRendererDiagnostics(
  diagnostics: RendererDiagnostics,
): string {
  return [
    `native ${diagnostics.activeNative} active`,
    `components ${diagnostics.activeComponents} active`,
    `lists ${diagnostics.listEntriesCreated} created`,
    `${diagnostics.listEntriesReused} reused`,
  ].join(' · ')
}
