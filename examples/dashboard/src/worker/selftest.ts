import {
  assertRendererIdle,
} from 'dynwinrt-jsx/diagnostics'
import type {
  Renderer,
} from 'dynwinrt-jsx/native'
import type {
  NativeSelfTest,
  NativeSelfTestResult,
} from '../native-selftest'
import type { DashboardWorkerParentPort } from './contracts'

export interface DashboardSelfTestWindow {
  close(): void
}

export interface RunDashboardSelfTestOptions {
  readonly nativeSelfTest: NativeSelfTest
  readonly renderer: Pick<Renderer, 'diagnostics'>
  readonly window: DashboardSelfTestWindow
  readonly parentPort: DashboardWorkerParentPort
  readonly disposeRender: () => void
  readonly setExitCode: (value: number) => void
  readonly exitApplication: () => void
}

export function runDashboardSelfTest(
  options: RunDashboardSelfTestOptions,
): void {
  const closeWindow = () => {
    try {
      options.window.close()
    }
    catch (error) {
      options.setExitCode(1)
      options.parentPort.postMessage({
        type: 'error',
        message:
          error instanceof Error
            ? error.stack ?? error.message
            : String(error),
      })
      options.exitApplication()
    }
  }

  options.nativeSelfTest.run(
    (result: NativeSelfTestResult) => {
      const cleanupStarted = Date.now()
      let completedResult: NativeSelfTestResult
      try {
        options.disposeRender()
        const diagnostics = options.renderer.diagnostics
        assertRendererIdle(
          diagnostics,
          'Native selftest root cleanup',
        )
        completedResult = {
          ...result,
          cases: [
            ...result.cases,
            {
              name: 'root-render-cleanup',
              passed: true,
              durationMs: Date.now() - cleanupStarted,
            },
          ],
          diagnostics,
        }
      }
      catch (error) {
        completedResult = {
          ...result,
          passed: false,
          cases: [
            ...result.cases,
            {
              name: 'root-render-cleanup',
              passed: false,
              durationMs: Date.now() - cleanupStarted,
              error:
                error instanceof Error
                  ? error.stack ?? error.message
                  : String(error),
            },
          ],
          diagnostics: options.renderer.diagnostics,
        }
      }
      options.parentPort.postMessage({
        type: 'native-selftest',
        value: completedResult,
      })
      if (!completedResult.passed) {
        options.setExitCode(1)
      }
      closeWindow()
    },
    (error: unknown) => {
      options.setExitCode(1)
      options.parentPort.postMessage({
        type: 'native-selftest',
        value: {
          passed: false,
          cases: [],
          environment: {
            highContrast: false,
            highContrastScheme: '',
            textScaleFactor: 1,
            animationsEnabled: true,
            advancedEffectsEnabled: true,
          },
          diagnostics: options.renderer.diagnostics,
          error:
            error instanceof Error
              ? error.stack ?? error.message
              : String(error),
        },
      })
      closeWindow()
    },
  )
}
