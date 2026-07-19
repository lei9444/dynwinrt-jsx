import type { RendererDiagnostics } from './renderer'

export type DiagnosticLevel = 'info' | 'warning' | 'error'

export interface DiagnosticRecord {
  readonly timestamp: string
  readonly source: string
  readonly event: string
  readonly level: DiagnosticLevel
  readonly details: Readonly<Record<string, unknown>>
}

export function createDiagnosticRecord(
  source: string,
  event: string,
  details: Readonly<Record<string, unknown>> = {},
  level: DiagnosticLevel = 'info',
): DiagnosticRecord {
  return {
    timestamp: new Date().toISOString(),
    source,
    event,
    level,
    details,
  }
}

export function formatDiagnosticRecord(
  record: DiagnosticRecord,
): string {
  return JSON.stringify(record)
}

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
