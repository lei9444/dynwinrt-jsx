import {
  ErrorBoundary,
  For,
  Portal,
  Show,
  VirtualFor,
  adapter,
  bind,
  boxNullable,
  color,
  computed,
  cornerRadius,
  createBitmapIcon,
  createBitmapImage,
  createContext,
  createComboBoxControl,
  createControls,
  createFocusTarget,
  createFontFamily,
  createGridControl,
  createItemsRepeaterControl,
  createVirtualizedItemsControl,
  createJsonStateStore,
  createListViewControl,
  createListViewScrollTarget,
  createNavigationItem,
  createNavigationViewControl,
  createReferenceBoxing,
  createRelativeUri,
  createScrollViewerController,
  createSelectorBarControl,
  createSolidColorBrush,
  createStyleRecipe,
  createSymbolIcon,
  createTeachingTip,
  createUri,
  createWinUIThemeController,
  createWinUIRendererPreset,
  gridLength,
  native,
  resource,
  signal,
  showFlyout,
  showMenuFlyout,
  showPopup,
  styles,
  theme,
  themeResource,
  thickness,
  tokens,
  useContext,
  type MaybeSignal,
  type NativePropertyPhase,
  type Renderer,
  type RendererInspectionSnapshot,
  type RendererInspectorOptions,
  type ScrollViewerController,
  type WinUIRendererCapability,
  type WinUIGridLength,
} from 'dynwinrt-jsx'

class TypeVector {
  readonly values: unknown[] = []

  get size(): number {
    return this.values.length
  }
  getAt(index: number): unknown {
    return this.values[index]
  }
  insertAt(_index: number, _value: unknown): void {}
  removeAt(_index: number): void {}
  append(_value: unknown): void {}
  clear(): void {}
}

class TypePanel {
  readonly children = new TypeVector()
  spacing = 0
}

class TypeGrid extends TypePanel {
  readonly rowDefinitions = new TypeVector()
  readonly columnDefinitions = new TypeVector()
}

class TypeNavigationView {
  readonly menuItems = new TypeVector()
  readonly footerMenuItems = new TypeVector()
  content: unknown = null
  selectedItem: unknown = null

  onSelectionChanged(
    _callback: (
      sender: TypeNavigationView,
      args: { selectedItemContainer: TypeNavigationItem },
    ) => void,
  ): () => void {
    return () => {}
  }
}

class TypeNavigationItem {
  name = ''
  content: unknown = null
  icon: TypeSymbolIcon | null = null
  selectsOnInvoked = true
  focus(_state: number): boolean {
    return true
  }
}

class TypeListView {
  readonly items = new TypeVector()
  header: unknown = null
  footer: unknown = null
  selectedIndex = -1
  selectedItem: unknown = null

  focus(_state: number): boolean {
    return true
  }
  scrollIntoView(_item: unknown, _alignment?: number): void {}
  onSelectionChanged(
    _callback: (sender: TypeListView, args: unknown) => void,
  ): () => void {
    return () => {}
  }
  registerPropertyChangedCallback(
    _property: unknown,
    _callback: (sender: unknown, property: unknown) => void,
  ): bigint {
    return 1n
  }
  unregisterPropertyChangedCallback(
    _property: unknown,
    _token: bigint,
  ): void {}
}

class TypeComboBox {
  readonly items = new TypeVector()
  header: unknown = null
  selectedIndex = -1
  selectedItem: unknown = null
  placeholderText = ''
  isEditable = false

  onSelectionChanged(
    _callback: (sender: TypeComboBox, args: unknown) => void,
  ): () => void {
    return () => {}
  }

  registerPropertyChangedCallback(
    _property: unknown,
    _callback: (sender: unknown, property: unknown) => void,
  ): bigint {
    return 1n
  }
  unregisterPropertyChangedCallback(
    _property: unknown,
    _token: bigint,
  ): void {}
}

class TypeScrollViewer {
  horizontalOffset = 0
  verticalOffset = 0
  scrollableWidth = 0
  scrollableHeight = 0
  viewportWidth = 0
  viewportHeight = 0

  changeView(
    _horizontalOffset: number | null,
    _verticalOffset: number | null,
    _zoomFactor: number | null,
    _disableAnimation: boolean,
  ): boolean {
    return true
  }
  onViewChanged(
    _callback: (...args: unknown[]) => void,
  ): () => void {
    return () => {}
  }
  onSizeChanged(
    _callback: (...args: unknown[]) => void,
  ): () => void {
    return () => {}
  }
  onLoaded(
    _callback: (...args: unknown[]) => void,
  ): () => void {
    return () => {}
  }
  onLayoutUpdated(
    _callback: (...args: unknown[]) => void,
  ): () => void {
    return () => {}
  }
}

class TypeSelectorBarItem {
  text = ''
}

class TypeSelectorBar {
  readonly items = new TypeVector()
  selectedItem: TypeSelectorBarItem | null = null

  onSelectionChanged(
    _callback: (...args: unknown[]) => void,
  ): () => void {
    return () => {}
  }
}

class TypeSymbolIcon {
  constructor(readonly symbol: number) {}
}

class TypeUri {
  constructor(
    readonly uri: string,
    readonly relativeUri?: string,
  ) {}
}

class TypeBitmapImage {
  uriSource = new TypeUri('about:blank')
  decodePixelWidth = 0
  decodePixelHeight = 0
}

class TypeBitmapIcon {
  uriSource = new TypeUri('about:blank')
  showAsMonochrome = false
}

class TypeFontFamily {
  constructor(readonly source: string) {}
}

class TypeSolidColorBrush {
  constructor(readonly colorValue: ReturnType<typeof color>) {}
}

class TypeFlyout {
  content: unknown = null
  xamlRoot: unknown = null
  isOpen = false

  showAt(_target: TypePanel): void
  showAt(_target: TypePanel, _options: { placement: number }): void
  showAt(_target: TypePanel, _options?: { placement: number }): void {
    this.isOpen = true
  }
  hide(): void {
    this.isOpen = false
  }
  onClosed(
    _callback: (sender: unknown, args: unknown) => void,
  ): () => void {
    return () => {}
  }
}

class TypeMenuFlyout {
  readonly items = new TypeVector()
  xamlRoot: unknown = null
  isOpen = false

  showAt(_target: TypePanel, _point: { x: number; y: number }): void {
    this.isOpen = true
  }
  hide(): void {
    this.isOpen = false
  }
  onClosed(
    _callback: (sender: unknown, args: unknown) => void,
  ): () => void {
    return () => {}
  }
}

class TypeTeachingTip {
  content: unknown = null
  xamlRoot: unknown = null
  target?: TypePanel
  isOpen = false

  onClosed(
    _callback: (sender: unknown, args: unknown) => void,
  ): () => void {
    return () => {}
  }
}

class TypePopup {
  child: unknown = null
  xamlRoot: unknown = null
  isOpen = false

  onClosed(
    _callback: (sender: unknown, args: unknown) => void,
  ): () => void {
    return () => {}
  }
}

class TypeNumberReference {
  private constructor(readonly value: number) {}

  static from(value: unknown): TypeNumberReference {
    return new TypeNumberReference(Number(value))
  }
}

class TypeRowDefinition {
  height = gridLength.star()
  minHeight = 0
  maxHeight = Number.POSITIVE_INFINITY
}

class TypeColumnDefinition {
  width = gridLength.star()
  minWidth = 0
  maxWidth = Number.POSITIVE_INFINITY
}

class TypeTextBlock {
  text = ''
  fontSize = 14
  foreground: unknown = null
}

class TypeItemsRepeater {
  itemsSource: unknown = null
  itemTemplate: unknown = null
  layout: object | null = null
}

class TypeContentControl {
  content: unknown = null
}

class TypeItemContainer {
  readonly mountHost = new TypeContentControl()
}

class TypeTextBox {
  text = ''

  onTextChanged(
    _callback: (sender: TypeTextBox) => void,
  ): () => void {
    return () => {}
  }
}

class TypeBooleanReference {}

class TypeCheckBox {
  isChecked: TypeBooleanReference | null = null
}

class TypeToggleSplitButton {
  isChecked = false
}

class TypeButton {
  content: unknown = null
  isEnabled = true
  padding = thickness(0)

  onClick(
    _callback: (
      sender: TypeButton,
      args: { handled: boolean },
    ) => void,
  ): () => void {
    return () => {}
  }
}

const UI = createControls({
  Button: TypeButton,
  CheckBox: TypeCheckBox,
  Panel: TypePanel,
  SelectorBarItem: TypeSelectorBarItem,
  TextBlock: TypeTextBlock,
  TextBox: TypeTextBox,
  ToggleSplitButton: TypeToggleSplitButton,
})
const DockedPanel = native<
  TypePanel,
  { dock?: MaybeSignal<number> }
>(TypePanel, {
  adapters: {
    spacing: adapter.initialOnly<TypePanel>(),
  },
})
const ControlledTypeList = native<
  TypeListView,
  {
    onSelectedIndexChange?: (
      value: number,
      instance: TypeListView,
    ) => void
  }
>(TypeListView, {
  adapters: {
    selectedIndex: adapter.controlled<TypeListView>({
      changeProperty: 'onSelectedIndexChange',
      read: (instance) => instance.selectedIndex,
      write: (instance, value) => {
        instance.selectedIndex = value as number
      },
      subscribe: (instance, callback) =>
        instance.onSelectionChanged(callback),
      echo: 'synchronous',
    }),
  },
})
const selectedIndexPhase: NativePropertyPhase = 'afterChildren'
adapter.withPhase(
  adapter.oneWay<TypeListView>(),
  selectedIndexPhase,
)
// @ts-expect-error Native property phases are a closed set.
adapter.withPhase(adapter.oneWay<TypeListView>(), 'later')
const rendererPreset = createWinUIRendererPreset({
  TextBlock: TypeTextBlock,
})
const textCapability: WinUIRendererCapability = 'text'
const presetRenderer: Renderer = rendererPreset.createRenderer()
void rendererPreset.capabilities[textCapability]
void presetRenderer
const inspectorOptions: RendererInspectorOptions = {
  maxOperations: 128,
}
declare const inspectedRenderer: Renderer
const inspectionSnapshot: RendererInspectionSnapshot =
  inspectedRenderer.inspector.snapshot()
void inspectorOptions
void inspectionSnapshot.reactive.observers
void inspectedRenderer.inspector.getOperations()
const VirtualizedTypeList = createItemsRepeaterControl({
  ItemsRepeater: TypeItemsRepeater,
  ContentControl: TypeContentControl,
  IElementFactory: {
    create(getElement, recycleElement) {
      return {
        getElement,
        recycleElement,
        releaseCallbacks() {},
      }
    },
  },
  IObservableVector_Object: {
    create(values) {
      const items = [...values]
      return {
        insertAt(index: number, value: unknown) {
          items.splice(index, 0, value)
        },
        removeAt(index: number) {
          items.splice(index, 1)
        },
        append(value: unknown) {
          items.push(value)
        },
        clear() {
          items.length = 0
        },
      }
    },
  },
  PropertyValue: {
    createInt32(value) {
      return value
    },
  },
  IReference_Int32: {
    from(value) {
      return { value: Number(value) }
    },
  },
})
const VirtualizedTypeItemsView =
  createVirtualizedItemsControl({
    Control: TypeItemsRepeater,
    ItemHost: TypeItemContainer,
    getItemMountHost(host) {
      return host.mountHost
    },
    IElementFactory: {
      create(getElement, recycleElement) {
        return {
          getElement,
          recycleElement,
          releaseCallbacks() {},
        }
      },
    },
    IObservableVector_Object: {
      create(values) {
        const items = [...values]
        return {
          insertAt(index: number, value: unknown) {
            items.splice(index, 0, value)
          },
          removeAt(index: number) {
            items.splice(index, 1)
          },
          append(value: unknown) {
            items.push(value)
          },
          clear() {
            items.length = 0
          },
        }
      },
    },
    PropertyValue: {
      createInt32(value) {
        return value
      },
    },
    IReference_Int32: {
      from(value) {
        return { value: Number(value) }
      },
    },
  }, {
    displayName: 'ItemsView',
  })
adapter.controlled<TypeListView>({
  changeProperty: 'onSelectedIndexChange',
  read: (instance) => instance.selectedIndex,
  write: (instance, value) => {
    instance.selectedIndex = value as number
  },
  subscribe: (instance, callback) =>
    instance.onSelectionChanged(callback),
  echo: 'deferred',
  // @ts-expect-error Deferred controlled writes cannot provide transactional rollback.
  rollback: (instance: TypeListView, previous: unknown) => {
    instance.selectedIndex = previous as number
  },
})
const LayoutGrid = createGridControl({
  Grid: TypeGrid,
  RowDefinition: TypeRowDefinition,
  ColumnDefinition: TypeColumnDefinition,
})
const Navigation = createNavigationViewControl<
  TypeNavigationView,
  TypeNavigationItem
>({
  NavigationView: TypeNavigationView,
})
const List = createListViewControl({
  ListView: TypeListView,
  selectedIndexProperty: {},
})
const Combo = createComboBoxControl({
  ComboBox: TypeComboBox,
  selectedIndexProperty: {},
})
const SelectorBar = createSelectorBarControl<
  TypeSelectorBar,
  TypeSelectorBarItem
>({
  SelectorBar: TypeSelectorBar,
})
const scrollViewerController:
  ScrollViewerController<TypeScrollViewer> =
    createScrollViewerController<TypeScrollViewer>()
scrollViewerController.scrollHorizontalByViewport(1)
const listScroll = createListViewScrollTarget<TypeListView>()
const navItem = createNavigationItem(
  {
    NavigationViewItem: TypeNavigationItem,
    TextBlock: TypeTextBlock,
  },
  {
    name: 'dashboard',
    label: 'Dashboard',
    icon: createSymbolIcon(TypeSymbolIcon, 1),
  },
)
createNavigationItem(
  {
    NavigationViewItem: TypeNavigationItem,
    TextBlock: TypeTextBlock,
  },
  {
    name: 'invalid',
    label: 'Invalid',
    // @ts-expect-error NavigationViewItem icon must retain its native type.
    icon: 'not-an-icon',
  },
)
const navFocus = createFocusTarget<TypeNavigationItem>(3)
const stateStore = createJsonStateStore({
  path: 'state.json',
  defaultState: () => ({ version: 1 as const, count: 0 }),
  validate(value): value is { version: 1; count: number } {
    return (
      typeof value === 'object' &&
      value !== null &&
      (value as { version?: unknown }).version === 1 &&
      typeof (value as { count?: unknown }).count === 'number'
    )
  },
})
stateStore.save({ version: 1, count: 1 })

const count = signal(0)
const enabled = signal(true)
const clickHandler = signal((
  _sender: TypeButton,
  args: { handled: boolean },
) => {
  args.handled = true
})
const items = signal([
  { id: 1, title: 'First' },
])
const windowStart = signal(0)
const portalTarget = signal<object | null>(new TypePanel())
const Locale = createContext('en-US')
const invalidGridLength: WinUIGridLength = {
  value: 1,
  // @ts-expect-error GridUnitType only accepts Auto, Pixel, or Star.
  gridUnitType: 3,
}
void invalidGridLength

const name = signal('name')
const oneWayBinding = bind.oneWay(name, 'text')
const twoWayBinding = bind.twoWay(
  name,
  'text',
  'onTextChanged',
)

thickness(8)
cornerRadius(8)
color(0, 120, 212)
const imageUri = createUri(TypeUri, 'ms-appx:///Assets/Logo.png')
createRelativeUri(TypeUri, 'ms-appx:///Assets/', 'Logo.png')
createBitmapImage(TypeBitmapImage, imageUri, { decodePixelWidth: 64 })
createBitmapIcon(TypeBitmapIcon, imageUri, { showAsMonochrome: true })
createFontFamily(TypeFontFamily, 'Segoe UI')
createSolidColorBrush(TypeSolidColorBrush, color(0, 120, 212))
boxNullable(
  createReferenceBoxing<number, TypeNumberReference>(
    (value) => value,
    TypeNumberReference,
  ),
  1,
)
declare const typeRenderer: Renderer
declare const overlayTarget: TypePanel
showFlyout(
  typeRenderer,
  new TypeFlyout(),
  overlayTarget,
  <UI.TextBlock text="Flyout" />,
  { showOptions: { placement: 1 } },
)
showMenuFlyout(
  typeRenderer,
  new TypeMenuFlyout(),
  overlayTarget,
  <UI.TextBlock text="Menu" />,
)
showPopup(
  typeRenderer,
  new TypePopup(),
  <UI.TextBlock text="Popup" />,
)
createTeachingTip(
  typeRenderer,
  new TypeTeachingTip(),
  { target: overlayTarget },
)

function LocaleLabel() {
  const locale = useContext(Locale)
  return <UI.TextBlock text={locale} />
}

export const typeCheckedTree = (
  <UI.Panel spacing={12}>
    <LayoutGrid
      rowDefinitions={[
        gridLength.auto(),
        { size: gridLength.star(2), min: 32 },
        new TypeRowDefinition(),
      ]}
      columnDefinitions={[
        gridLength.pixel(240),
        gridLength.star(),
      ]}
    >
      <UI.TextBlock gridRow={1} gridColumn={1} text="Grid child" />
    </LayoutGrid>

    <Navigation
      menuItems={[navItem]}
      footerMenuItems={signal<TypeNavigationItem[]>([])}
      selectedItem={navItem}
      onSelectionChanged={(_sender, args) => {
        navFocus.current = args.selectedItemContainer
        navFocus.focus()
      }}
    >
      <UI.TextBlock text="Navigation content" />
    </Navigation>

    <List
      ref={listScroll}
      selectedIndex={signal(0)}
      onSelectedIndexChange={(index, sender) => {
        sender.scrollIntoView(sender.items.values[index])
      }}
      header={<UI.TextBlock text="Header" />}
      footer={<UI.TextBlock text="Footer" />}
    >
      <UI.TextBlock text="Item" />
    </List>
    <Combo
      selectedIndex={signal(0)}
      onSelectedIndexChange={(index, sender) => {
        sender.selectedIndex = index
      }}
      header={<UI.TextBlock text="Priority" />}
      placeholderText="Choose"
    >
      <UI.TextBlock text="Low" />
      <UI.TextBlock text="High" />
    </Combo>
    {/* @ts-expect-error Specialized ComboBox selection is controlled by index. */}
    <Combo selectedItem={{}} />
    <SelectorBar
      selectedIndex={signal(0)}
      onSelectedIndexChange={(index, sender) => {
        sender.selectedItem =
          sender.items.getAt?.(index) as
            | TypeSelectorBarItem
            | null
      }}
    >
      <UI.SelectorBarItem text="Recent" />
    </SelectorBar>
    {/* @ts-expect-error Specialized SelectorBar selection is controlled by index. */}
    <SelectorBar selectedItem={new TypeSelectorBarItem()} />
    <ControlledTypeList
      selectedIndex={signal(0)}
      onSelectedIndexChange={(index, instance) => {
        instance.selectedIndex = index
      }}
    />
    <VirtualizedTypeList
      each={items}
      key={(item) => item.id}
      layout={{}}
    >
      {(item, index) => (
        <UI.TextBlock
          text={computed(
            () => `${index.value}:${item.title}`,
          )}
        />
      )}
    </VirtualizedTypeList>
    <VirtualizedTypeItemsView
      each={items}
      key={(item) => item.id}
      layout={{}}
    >
      {(item) => <UI.TextBlock text={item.title} />}
    </VirtualizedTypeItemsView>

    <UI.TextBlock
      text={computed(() => `Count: ${count.value}`)}
      fontSize={resource('BodyStrongFontSize', 24, enabled)}
      foreground={theme.primaryText}
      resourceOverrides={{
        TextControlForeground: theme.secondaryText,
        CustomFontSize: themeResource<number>('BodyFontSize', 14),
      }}
      automationHeadingLevel={1}
      automationPositionInSet={1}
      automationSizeOfSet={3}
    />

    <UI.Button
      {...styles.button({
        variant: signal<'standard' | 'accent'>('accent'),
      })}
      isEnabled={enabled}
      canvasZIndex={2}
      relativePanelAlignRightWithPanel
      variableSizedWrapGridColumnSpan={2}
      toolTip="Increment the current count"
      toolTipPlacement={1}
      onClick={clickHandler}
    >
      Increment
    </UI.Button>

    <UI.CheckBox isChecked={enabled} />
    <UI.ToggleSplitButton isChecked={enabled} />
    {/* @ts-expect-error Non-nullable native isChecked properties reject null. */}
    <UI.ToggleSplitButton isChecked={null} />
    <UI.TextBox {...oneWayBinding} />
    <UI.TextBox {...twoWayBinding} />
    <DockedPanel dock={signal(2)} spacing={8} />
    {/* @ts-expect-error Custom attached props require an explicit component contract. */}
    <UI.Panel dock={2} />

    <Show when={enabled} fallback={<UI.TextBlock text="Disabled" />}>
      <UI.TextBlock text="Enabled" />
    </Show>

    <For each={items} key={(item) => item.id}>
      {(item, index) => (
        <UI.TextBlock
          text={computed(() => `${index.value}: ${item.title}`)}
        />
      )}
    </For>

    <VirtualFor
      each={items}
      start={windowStart}
      count={20}
      itemSize={32}
      renderSpacer={(size) => <UI.Panel spacing={size} />}
      key={(item) => item.id}
    >
      {(item) => <UI.TextBlock text={item.title} />}
    </VirtualFor>

    <Locale.Provider value="fr-FR">
      <LocaleLabel />
    </Locale.Provider>

    <ErrorBoundary
      reset={enabled}
      fallback={(error, context) => (
        <UI.Button onClick={() => {
          enabled.value = !enabled.value
        }}>
          {context.phase}:
          {String(error)}
        </UI.Button>
      )}
    >
      <UI.TextBlock text="Safe" />
    </ErrorBoundary>

    <Portal mount={portalTarget}>
      <UI.TextBlock text="Overlay" />
    </Portal>
  </UI.Panel>
)

const typeThemeController = createWinUIThemeController({
  isDark: signal(false),
  setDark() {},
  application: { requestedTheme: 0 },
  applicationTheme: { Light: 0, Dark: 1 },
  elementTheme: { Light: 0, Dark: 1 },
})
typeThemeController.requestedTheme.value
tokens.spacing.md

const baseOnlyRecipe = createStyleRecipe({
  base: { opacity: 1 },
})
baseOnlyRecipe()
// @ts-expect-error Base-only recipes do not accept variant selections.
baseOnlyRecipe({ tone: 'muted' })

createWinUIThemeController({
  isDark: signal(false),
  setDark() {},
  application: { requestedTheme: 0 },
  applicationTheme: { Light: 0, Dark: 1 },
  elementTheme: { Light: 0, Dark: 1 },
  // @ts-expect-error titleBar and titleBarTheme must be provided together.
  titleBar: { preferredTheme: 0 },
})
