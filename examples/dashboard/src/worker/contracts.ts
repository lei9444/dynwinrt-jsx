import type { DashboardState } from '../dashboard-model'

export interface DashboardWorkerParentPort {
  postMessage(message: unknown): void
}

export interface DashboardWorkerStatePort {
  postMessage(message: unknown): void
  on(
    type: 'message',
    listener: (message: unknown) => void,
  ): unknown
  off(
    type: 'message',
    listener: (message: unknown) => void,
  ): unknown
  close(): void
}

export interface DashboardWorkerData {
  readonly statePort: DashboardWorkerStatePort
  readonly hotStatePath: string | null
  readonly initialState: DashboardState
  readonly selfTest: boolean
  readonly selfTestFailure: string | null
  readonly startupEpochMs: number
}

export type DashboardStartupStageReporter = (
  stage: string,
  details?: Record<string, unknown>,
) => void
