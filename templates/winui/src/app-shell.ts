import type {
  ProjectedOwnership,
  Renderer,
} from 'dynwinrt-jsx/native'
import type {
  Window,
} from '#winapp/bindings'
import type { AppModel } from './app-model'

export interface AppContext extends ProjectedOwnership {
  readonly model: AppModel
  readonly renderer: Renderer
  readonly window: Window
  refreshDiagnostics(): void
}
