import {
  ErrorBoundary,
  For,
  computed,
  signal,
  type Child,
  type ReadonlySignal,
} from 'dynwinrt-jsx/core'
import {
  createComboBoxControl,
  createItemsRepeaterControl,
  createListViewControl,
  createWinUIControls,
  type RefObject,
} from 'dynwinrt-jsx/controls'
import {
  native,
  type Renderer,
} from 'dynwinrt-jsx/native'
import type {
  RendererDiagnostics,
} from 'dynwinrt-jsx/diagnostics'
import * as WinUIBindings from '#winapp/bindings'
import {
  AccessibilitySettings,
  AutomationProperties,
  Button,
  ComboBox,
  ContentControl,
  FocusState,
  IElementFactory,
  IObservableVector_Object,
  IReference_Int32,
  ItemsRepeater,
  ListView,
  PropertyValue,
  ScrollViewer,
  Selector,
  StackLayout,
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

const UI = createWinUIControls(WinUIBindings)

const SelfTestListView = createListViewControl({
  ListView,
  selectedIndexProperty: Selector.selectedIndexProperty,
})

const SelfTestComboBox = createComboBoxControl({
  ComboBox,
  selectedIndexProperty: Selector.selectedIndexProperty,
})

const SelfTestItemsRepeater = createItemsRepeaterControl({
  ItemsRepeater,
  ContentControl,
  IElementFactory,
  IObservableVector_Object,
  PropertyValue,
  IReference_Int32,
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
  const selectionRef: RefObject<ListView> = { current: null }
  const comboBoxRef: RefObject<ComboBox> = { current: null }
  const repeaterRef: RefObject<ItemsRepeater> = { current: null }
  const repeaterScrollRef: RefObject<ScrollViewer> = {
    current: null,
  }
  const selectedIndex = signal(0)
  const selectionChanges: number[] = []
  const comboBoxIndex = signal(0)
  const comboBoxChanges: number[] = []
  const comboBoxItems = signal([
    { id: 0, label: 'Combo zero' },
    { id: 1, label: 'Combo one' },
    { id: 2, label: 'Combo two' },
  ])
  let acceptComboBoxChange = true
  const selectionItems = signal([
    { id: 0, label: 'Selection zero' },
    { id: 1, label: 'Selection one' },
  ])
  const virtualItems = signal<SelfTestItem[]>(
    Array.from({ length: 1000 }, (_, id) => ({
      id,
      label: `Virtual item ${id}`,
    })),
  )
  const virtualLayout = new StackLayout()
  virtualLayout.spacing = 2
  let virtualMountId = 0
  let virtualIndexChanges = 0
  let firstVirtualMountId: number | undefined
  const virtualMountByItem = new Map<number, number>()
  const virtualIndexByItem =
    new Map<number, ReadonlySignal<number>>()
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

  function VirtualItemRow(props: {
    readonly item: SelfTestItem
    readonly index: ReadonlySignal<number>
  }) {
    const mountId = virtualMountId
    virtualMountId += 1
    virtualMountByItem.set(props.item.id, mountId)
    virtualIndexByItem.set(props.item.id, props.index)
    return (
      <UI.TextBlock
        height={24 + (props.item.id % 3) * 12}
        text={computed(
          () =>
            `${mountId}|${props.index.value}|${props.item.id}`,
        )}
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
      <SelfTestListView
        ref={selectionRef}
        selectedIndex={selectedIndex}
        onSelectedIndexChange={(index) => {
          selectionChanges.push(index)
        }}
      >
        <For
          each={selectionItems}
          key={(item) => item.id}
        >
          {(item) => (
            <UI.TextBlock text={item.label} />
          )}
        </For>
      </SelfTestListView>
      <SelfTestComboBox
        ref={comboBoxRef}
        selectedIndex={comboBoxIndex}
        onSelectedIndexChange={(index) => {
          comboBoxChanges.push(index)
          if (acceptComboBoxChange) {
            comboBoxIndex.value = index
          }
        }}
        header={<UI.TextBlock text="Combo selection" />}
      >
        <For
          each={comboBoxItems}
          key={(item) => item.id}
        >
          {(item) => (
            <UI.TextBlock text={item.label} />
          )}
        </For>
      </SelfTestComboBox>
      <UI.ScrollViewer
        ref={repeaterScrollRef}
        height={180}
      >
        <SelfTestItemsRepeater
          ref={repeaterRef}
          each={virtualItems}
          key={(item) => item.id}
          layout={virtualLayout}
          verticalCacheLength={0.5}
          onElementIndexChanged={() => {
            virtualIndexChanges += 1
          }}
        >
          {(item, index) => (
            <VirtualItemRow
              item={item}
              index={index}
            />
          )}
        </SelfTestItemsRepeater>
      </UI.ScrollViewer>
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

      runCase(cases, 'controlled-listview-model-authority', () => {
        const list = selectionRef.current
        if (!list) {
          throw new Error('Controlled ListView did not mount.')
        }

        selectionChanges.length = 0
        selectedIndex.value = 1
        if (list.selectedIndex !== 1) {
          throw new Error('Controlled ListView did not apply the model value.')
        }
        if (selectionChanges.length !== 0) {
          throw new Error('Programmatic selection leaked a change callback.')
        }

        list.selectedIndex = 0
        const observedChanges = selectionChanges.slice()
        if (
          observedChanges.length !== 1 ||
          observedChanges[0] !== 0
        ) {
          throw new Error('Native selection did not reach the change callback.')
        }
        if (selectedIndex.value !== 1 || list.selectedIndex !== 1) {
          throw new Error('Rejected native selection was not reasserted.')
        }

        selectionChanges.length = 0
        selectionItems.value = [
          { id: 0, label: 'Selection zero updated' },
          { id: 1, label: 'Selection one updated' },
        ]
        if (list.selectedIndex !== selectedIndex.value) {
          throw new Error(
            'Selection diverged while updating ListView items.',
          )
        }
      })

      runCase(cases, 'controlled-combobox-selection', () => {
        const comboBox = comboBoxRef.current
        if (!comboBox) {
          throw new Error('Controlled ComboBox did not mount.')
        }

        comboBoxChanges.length = 0
        comboBoxIndex.value = 1
        if (
          comboBox.selectedIndex !== 1 ||
          comboBoxChanges.length !== 0
        ) {
          throw new Error(
            'Programmatic ComboBox selection leaked a callback.',
          )
        }

        comboBox.selectedIndex = 2
        if (
          comboBoxIndex.value !== 2 ||
          comboBoxChanges.at(-1) !== 2
        ) {
          throw new Error(
            'Native ComboBox selection was not accepted.',
          )
        }

        acceptComboBoxChange = false
        comboBox.selectedIndex = 0
        if (
          comboBoxIndex.value !== 2 ||
          comboBox.selectedIndex !== 2
        ) {
          throw new Error(
            'Rejected ComboBox selection was not restored.',
          )
        }

        comboBoxItems.value = [
          { id: 0, label: 'Combo zero updated' },
          { id: 1, label: 'Combo one updated' },
          { id: 2, label: 'Combo two updated' },
        ]
        if (comboBox.selectedIndex !== comboBoxIndex.value) {
          throw new Error(
            'ComboBox selection diverged while updating items.',
          )
        }
        acceptComboBoxChange = true
      })

      runCase(cases, 'native-items-repeater-initial-window', () => {
        const repeater = repeaterRef.current
        const scroll = repeaterScrollRef.current
        if (!repeater || !scroll) {
          throw new Error('ItemsRepeater did not mount.')
        }
        scroll.updateLayout()
        repeater.updateLayout()
        scroll.scrollToVerticalOffset(
          scroll.scrollableHeight,
        )
        scroll.updateLayout()
        repeater.updateLayout()
        const realized = virtualItems.value.reduce(
          (count, _item, index) =>
            repeater.tryGetElement(index)
              ? count + 1
              : count,
          0,
        )
        if (realized === 0 || realized >= 100) {
          throw new Error(
            `Expected a bounded initial ItemsRepeater window, found ${realized}.`,
          )
        }

        const first = repeater.tryGetElement(0)
        if (!first) {
          throw new Error('ItemsRepeater did not realize its first row.')
        }
        firstVirtualMountId = virtualMountByItem.get(0)
        if (firstVirtualMountId === undefined) {
          throw new Error(
            'ItemsRepeater did not mount the first JSX row.',
          )
        }

        virtualItems.value = [...virtualItems.value].reverse()
        scroll.updateLayout()
        repeater.updateLayout()
        scroll.scrollToVerticalOffset(scroll.scrollableHeight)
        return { itemCount: 1000, realized }
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
        runCase(cases, 'native-items-repeater-recycling', () => {
          const repeater = repeaterRef.current
          const scroll = repeaterScrollRef.current
          if (
            !repeater ||
            !scroll ||
            firstVirtualMountId === undefined
          ) {
            throw new Error(
              'ItemsRepeater recycling state was not initialized.',
            )
          }
          scroll.updateLayout()
          repeater.updateLayout()
          const realized = virtualItems.value.reduce(
            (count, _item, index) =>
              repeater.tryGetElement(index)
                ? count + 1
                : count,
            0,
          )
          if (realized === 0 || realized >= 100) {
            throw new Error(
              `Expected a bounded scrolled ItemsRepeater window, found ${realized}.`,
            )
          }

          repeater.getOrCreateElement(999)
          if (
            virtualMountByItem.get(0) !==
              firstVirtualMountId ||
            virtualIndexByItem.get(0)?.value !== 999
          ) {
            throw new Error(
              `ItemsRepeater keyed row mismatch: mount=${virtualMountByItem.get(0)}, expectedMount=${firstVirtualMountId}, index=${virtualIndexByItem.get(0)?.value}.`,
            )
          }
          if (virtualIndexChanges === 0) {
            throw new Error(
              'Observable vector updates did not produce native index changes.',
            )
          }
          return {
            realized,
            mountCount: virtualMountId,
            indexChanges: virtualIndexChanges,
          }
        })
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
