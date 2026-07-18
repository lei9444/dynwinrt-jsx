import {
  ErrorBoundary,
  For,
  Portal,
  Show,
  VirtualFor,
  bind,
  color,
  computed,
  cornerRadius,
  createContext,
  createControls,
  createGridControl,
  gridLength,
  resource,
  signal,
  thickness,
  useContext,
  type WinUIGridLength,
} from 'dynwinrt-jsx'

class TypeVector {
  readonly values: unknown[] = []

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

class TypeButton {
  content: unknown = null
  isEnabled = true

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
  TextBlock: TypeTextBlock,
  TextBox: TypeTextBox,
})
const LayoutGrid = createGridControl({
  Grid: TypeGrid,
  RowDefinition: TypeRowDefinition,
  ColumnDefinition: TypeColumnDefinition,
})

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

    <UI.TextBlock
      text={computed(() => `Count: ${count.value}`)}
      fontSize={resource('BodyStrongFontSize', 24, enabled)}
    />

    <UI.Button
      isEnabled={enabled}
      onClick={clickHandler}
    >
      Increment
    </UI.Button>

    <UI.CheckBox isChecked={enabled} />
    <UI.TextBox {...oneWayBinding} />
    <UI.TextBox {...twoWayBinding} />

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
