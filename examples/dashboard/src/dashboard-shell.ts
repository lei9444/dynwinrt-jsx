import type {
  DiagnosticChannel,
} from 'dynwinrt-jsx/diagnostics'
import type {
  ProjectedOwnership,
  Renderer,
} from 'dynwinrt-jsx/native'
import type {
  Window,
  XamlRoot,
} from '#winapp/bindings'
import type { DashboardModel } from './dashboard-model'

export interface DashboardAppContext
extends ProjectedOwnership {
  readonly model: DashboardModel
  readonly renderer: Renderer
  readonly window: Window
  readonly diagnostics: DiagnosticChannel
  getXamlRoot(): XamlRoot
  refreshDiagnostics(): void
  exportDiagnostics(): void
}
