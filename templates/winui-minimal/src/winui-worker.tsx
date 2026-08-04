import {
  createWinUIWorkerRuntime,
  defineWinUIApp,
} from 'dynwinrt-jsx/worker'
import { roInitialize } from '@microsoft/dynwinrt'
import * as WinUIBindings from '#winapp/bindings'
import { renderApp } from './app'
import { createAppModel } from './app-model'
import { isAppState, type AppState } from './app-state'

const runtime = createWinUIWorkerRuntime<AppState>({
  channel: 'app-state',
  moduleId: './dist/app.js',
  validateState: isAppState,
})
const {
  bridge,
  workerData,
} = runtime

const app = defineWinUIApp({
  bindings: WinUIBindings,
  initializeRuntime() {
    roInitialize(0)
  },
  configureWindow({ window }) {
    window.title = 'dynwinrt-jsx minimal'
  },
  mount({ bindings, window }) {
    window.systemBackdrop = new bindings.MicaBackdrop()
    const model = createAppModel(
      bridge,
      workerData.initialState,
    )
    return {
      child: renderApp(model, () => window.close()),
      beforeClose() {
        model.status.value = 'closed'
      },
      disposeAfterRender: model.dispose,
      afterActivate() {
        model.status.value = 'running'
      },
    }
  },
  ...runtime.appCallbacks,
})

void runtime.run(app)
