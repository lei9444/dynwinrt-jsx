import {
  ErrorBoundary,
  For,
  createControls,
  native,
  signal,
  type Child,
  type RefObject,
  type Renderer,
  type RendererDiagnostics,
} from 'dynwinrt-jsx'
import {
  AccessibilitySettings,
  AutomationProperties,
  Button,
  FocusState,
  StackPanel,
  TextBlock,
  TextBox,
  UISettings,
  Window,
} from '#winapp/bindings'

interface SelfTestItem {
  readonly id: number
  readonly label: string
}

interface NativeSelfTestCase {
  readonly name: string
  readonly passed: boolean
  readonly durationMs: number
  readonly error?: string
  readonly details?: Readonly<Record<string, unknown>>
}

export interface NativeSelfTestResult {
  readonly passed: boolean
  readonly cases: readonly NativeSelfTestCase[]
  readonly environment: {
    readonly highContrast: boolean
    readonly highContrastScheme: string
    readonly textScaleFactor: number
    readonly animationsEnabled: boolean
    readonly advancedEffectsEnabled: boolean
  }
  readonly diagnostics: RendererDiagnostics
}

export interface NativeSelfTest {
  readonly tree: Child
  run(
    complete: (result: NativeSelfTestResult) => void,
    fail: (error: unknown) => void,
  ): void
}

interface NativeSelfTestContext {
  readonly renderer: Renderer
  readonly window: Window
  readonly failureMode?: string | null
}

const UI = createControls({
  Button,
  StackPanel,
  TextBlock,
  TextBox,
})

const ExplodingText = native<
  TextBlock,
  { readonly explode?: boolean }
>(TextBlock, {
  displayName: 'NativeSelfTestExplodingText',
  setProperty(_instance, property, value) {
    if (property !== 'explode') {
      return false
    }
    if (value) {
      throw new Error('intentional property failure')
    }
    return true
  },
})

type SelfTestTimer = ReturnType<
  Window['dispatcherQueue']['createTimer']
>

const activeSelfTestTimers = new Set<SelfTestTimer>()

function errorText(error: unknown): string {
  return error instanceof Error
    ? error.stack ?? error.message
    : String(error)
}

export function createNativeSelfTest(
  context: NativeSelfTestContext,
): NativeSelfTest {
  const status = signal<string>('initial')
  const items = signal<SelfTestItem[]>(
    Array.from({ length: 256 }, (_, index) => ({
      id: index,
      label: `Item ${index}`,
    })),
  )
  const statusRef: RefObject<TextBlock> = { current: null }
  const listRef: RefObject<StackPanel> = { current: null }
  const focusRef: RefObject<Button> = { current: null }
  const firstLabelRef: RefObject<TextBlock> = { current: null }
  const secondLabelRef: RefObject<TextBlock> = { current: null }
  const inputRef: RefObject<TextBox> = { current: null }
  const labeledBy = signal<TextBlock | null>(null)
  const itemRefs = new Map<number, TextBlock>()
  let capturedBoundaryError: unknown
  let loaded = false
  let started = false
  let complete:
    | ((result: NativeSelfTestResult) => void)
    | undefined
  let fail: ((error: unknown) => void) | undefined

  function ItemRow(props: { readonly item: SelfTestItem }) {
    return (
      <UI.TextBlock
        ref={(value) => {
          if (value) {
            itemRefs.set(props.item.id, value)
          }
        }}
        text={props.item.label}
      />
    )
  }

  const tree = (
    <UI.StackPanel
      spacing={4}
      onLoaded={() => {
        loaded = true
        start()
      }}
    >
      <UI.TextBlock
        ref={statusRef}
        automationId="NativeSelfTestStatus"
        automationName="Native selftest status"
        text={status}
      />
      <UI.TextBlock
        ref={(value) => {
          firstLabelRef.current = value
          if (value && !labeledBy.peek()) {
            labeledBy.value = value
          }
        }}
        automationId="NativeSelfTestFirstLabel"
        text="First label"
      />
      <UI.TextBlock
        ref={secondLabelRef}
        automationId="NativeSelfTestSecondLabel"
        text="Second label"
      />
      <UI.TextBox
        ref={inputRef}
        automationId="NativeSelfTestInput"
        automationName="Native selftest input"
        automationLabeledBy={labeledBy}
      />
      <UI.Button
        ref={focusRef}
        automationId="NativeSelfTestFocus"
      >
        Focus target
      </UI.Button>
      <ErrorBoundary
        fallback={(error) => {
          capturedBoundaryError = error
          return <UI.TextBlock text="Boundary recovered" />
        }}
      >
        <ExplodingText explode />
      </ErrorBoundary>
      <UI.StackPanel ref={listRef}>
        <For each={items} key={(item) => item.id}>
          {(item) => <ItemRow item={item} />}
        </For>
      </UI.StackPanel>
    </UI.StackPanel>
  )

  const runCase = (
    cases: NativeSelfTestCase[],
    name: string,
    action: () => void | Readonly<Record<string, unknown>>,
  ) => {
    const startedAt = Date.now()
    try {
      const details = action()
      cases.push({
        name,
        passed: true,
        durationMs: Date.now() - startedAt,
        ...(details ? { details } : {}),
      })
    }
    catch (error) {
      cases.push({
        name,
        passed: false,
        durationMs: Date.now() - startedAt,
        error: errorText(error),
      })
    }
  }

  const finish = (cases: NativeSelfTestCase[]) => {
    const accessibility = new AccessibilitySettings()
    const uiSettings = new UISettings()
    complete?.({
      passed: cases.every((entry) => entry.passed),
      cases,
      environment: {
        highContrast: accessibility.highContrast,
        highContrastScheme: accessibility.highContrastScheme,
        textScaleFactor: uiSettings.textScaleFactor,
        animationsEnabled: uiSettings.animationsEnabled,
        advancedEffectsEnabled: uiSettings.advancedEffectsEnabled,
      },
      diagnostics: context.renderer.diagnostics,
    })
  }

  function start() {
    if (!loaded || !complete || !fail || started) {
      return
    }
    started = true
    status.value = 'running-cases'
    const cases: NativeSelfTestCase[] = []

    try {
      runCase(cases, 'native-property-and-effect', () => {
        if (statusRef.current?.text !== 'running-cases') {
          throw new Error('Initial TextBlock value was not applied.')
        }
        status.value = 'updated'
        if (String(statusRef.current?.text) !== 'updated') {
          throw new Error('Signal update did not reach the native property.')
        }
      })

      runCase(cases, 'keyed-native-identity', () => {
        const initial = new Map(itemRefs)
        const reversed = [...items.value].reverse()
        items.value = reversed
        const children = listRef.current?.children
        if (children?.size !== reversed.length) {
          throw new Error(
            `Expected ${reversed.length} native rows, found ${children?.size ?? 0}.`,
          )
        }
        for (let index = 0; index < reversed.length; index += 1) {
          const item = reversed[index]
          if (!item) {
            throw new Error(`Missing keyed item at index ${index}.`)
          }
          const expected = initial.get(item.id)
          if (!expected || itemRefs.get(item.id) !== expected) {
            throw new Error(`Keyed item ${item.id} lost native identity.`)
          }
          if (children.indexOf(expected) !== index) {
            throw new Error(`Keyed item ${item.id} moved to the wrong position.`)
          }
        }
        return { itemCount: reversed.length }
      })

      runCase(cases, 'renderer-error-boundary', () => {
        if (
          !(capturedBoundaryError instanceof Error) ||
          capturedBoundaryError.message !== 'intentional property failure'
        ) {
          throw new Error('Property error did not reach ErrorBoundary.')
        }
      })

      runCase(cases, 'reactive-automation-relationship', () => {
        const input = inputRef.current
        const first = firstLabelRef.current
        const second = secondLabelRef.current
        if (!input || !first || !second) {
          throw new Error('Automation relationship controls are not mounted.')
        }
        if (AutomationProperties.getAutomationId(input) !== 'NativeSelfTestInput') {
          throw new Error('AutomationId was not applied to the native TextBox.')
        }
        if (AutomationProperties.getName(input) !== 'Native selftest input') {
          throw new Error('AutomationName was not applied to the native TextBox.')
        }
        if (
          AutomationProperties.getAutomationId(
            AutomationProperties.getLabeledBy(input),
          ) !== AutomationProperties.getAutomationId(first)
        ) {
          throw new Error('Initial LabeledBy relationship is incorrect.')
        }
        labeledBy.value = second
        if (
          AutomationProperties.getAutomationId(
            AutomationProperties.getLabeledBy(input),
          ) !== AutomationProperties.getAutomationId(second)
        ) {
          throw new Error('Reactive LabeledBy relationship did not update.')
        }
      })

      runCase(cases, 'native-focus', () => {
        if (!focusRef.current?.focus(FocusState.Programmatic)) {
          throw new Error('Native focus request was rejected.')
        }
      })

      runCase(cases, 'isolated-render-cleanup', () => {
        const baseline = context.renderer.diagnostics
        const container = new StackPanel()
        const value = signal('temporary')
        const textRef: RefObject<TextBlock> = { current: null }
        const handle = context.renderer.render(
          <UI.TextBlock ref={textRef} text={value} />,
          container,
        )
        value.value = 'disposed'
        if (textRef.current?.text !== 'disposed') {
          throw new Error('Isolated native render did not update.')
        }
        handle.dispose()
        const after = context.renderer.diagnostics
        if (
          after.activeNative !== baseline.activeNative ||
          after.activeComponents !== baseline.activeComponents
        ) {
          throw new Error(
            `Isolated render cleanup changed active diagnostics: ${JSON.stringify({
              baseline,
              after,
            })}`,
          )
        }
      })

      if (context.failureMode === 'assertion') {
        runCase(cases, 'intentional-assertion-failure', () => {
          throw new Error('Intentional native selftest assertion failure.')
        })
      }

      const eventStarted = Date.now()
      const timer = context.window.dispatcherQueue.createTimer()
      activeSelfTestTimers.add(timer)
      timer.interval = { duration: 2_500_000n }
      timer.isRepeating = false
      const unsubscribe = timer.onTick(() => {
        let firstError: unknown
        try {
          timer.stop()
        }
        catch (error) {
          firstError = error
        }
        try {
          unsubscribe()
        }
        catch (error) {
          firstError ??= error
        }
        activeSelfTestTimers.delete(timer)
        cases.push(
          firstError === undefined
            ? {
                name: 'native-dispatcher-event',
                passed: true,
                durationMs: Date.now() - eventStarted,
              }
            : {
                name: 'native-dispatcher-event',
                passed: false,
                durationMs: Date.now() - eventStarted,
                error: errorText(firstError),
              },
        )
        try {
          finish(cases)
        }
        catch (error) {
          fail?.(error)
        }
      })
      timer.start()
    }
    catch (error) {
      fail(error)
    }
  }

  return {
    tree,
    run(onComplete, onFail) {
      complete = onComplete
      fail = onFail
      start()
    },
  }
}
