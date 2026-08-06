import {
  For,
  Show,
  computed,
  cornerRadius,
  createSymbolIcon,
  gridLength,
  onCleanup,
  signal,
  styles,
  theme,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  AutomationLiveSetting,
  Clipboard,
  DataPackage,
  DispatcherQueuePriority,
  HorizontalAlignment,
  ItemsView,
  ItemsViewSelectionMode,
  Orientation,
  releaseProjected,
  Symbol,
  SymbolIcon,
  TextTrimming,
  TextWrapping,
  UniformGridLayout,
  VerticalAlignment,
  Visibility,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryItemsView,
  LayoutGrid,
  UI,
} from '../../gallery-ui'
import { Page } from '../../components/gallery-components'
import iconsJson from './icons-data.json'

interface RawIconData {
  readonly Code: string
  readonly Name: string
  readonly Tags?: readonly string[]
  readonly IsSegoeFluentOnly?: boolean
}

interface IconData {
  readonly code: string
  readonly name: string
  readonly tags: readonly string[]
  readonly isSegoeFluentOnly: boolean
  readonly character: string
  readonly textGlyph: string
  readonly codeGlyph: string
  readonly symbolName: string | null
}

const iconCatalog: readonly IconData[] =
  (iconsJson as readonly RawIconData[]).map((entry) => ({
    code: entry.Code,
    name: entry.Name,
    tags: [...new Set(entry.Tags ?? [])],
    isSegoeFluentOnly: entry.IsSegoeFluentOnly ?? false,
    character: String.fromCodePoint(
      Number.parseInt(entry.Code, 16),
    ),
    textGlyph: `\\u${entry.Code}`,
    codeGlyph: `0x${entry.Code}`,
    symbolName: Reflect.has(Symbol, entry.Name)
      ? entry.Name
      : null,
  }))

function filterIcons(
  query: string,
  icons: readonly IconData[] = iconCatalog,
): readonly IconData[] {
  const tokens = query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (tokens.length === 0) {
    return icons
  }
  return icons.filter((item) =>
    tokens.every((token) =>
      item.code.toLocaleLowerCase().includes(token) ||
      item.name.toLocaleLowerCase().includes(token) ||
      item.tags.some((tag) =>
        tag.toLocaleLowerCase().includes(token),
      ),
    ),
  )
}

function CodeValue(props: {
  readonly label: string
  readonly value: ReturnType<typeof computed<string>>
  readonly automationId?: string
}) {
  const copyValue = () => {
    const data = new DataPackage()
    try {
      data.setText(props.value.value)
      Clipboard.setContent(data)
      Clipboard.flush()
    }
    finally {
      releaseProjected(data)
    }
  }
  return (
    <UI.StackPanel spacing={4}>
      <UI.TextBlock
        fontSize={12}
        foreground={theme.secondaryText}
        text={props.label}
      />
      <LayoutGrid
        minHeight={32}
        margin={thickness(0, 0, 0, 8)}
        columnDefinitions={[
          gridLength.star(),
          gridLength.auto(),
        ]}
      >
        <UI.Border
          minHeight={32}
          padding={thickness(8, 6)}
          background={theme.ref(
            'ControlFillColorTransparentBrush',
          )}
          borderBrush={theme.ref(
            'ControlFillColorTransparentBrush',
          )}
          borderThickness={thickness(1)}
          cornerRadius={cornerRadius(0)}
        >
          <UI.TextBlock
            {...(props.automationId
              ? { automationId: props.automationId }
              : {})}
            isTextSelectionEnabled
            text={props.value}
            textWrapping={TextWrapping.Wrap}
          />
        </UI.Border>
        <UI.Button
          gridColumn={1}
          automationName={`Copy ${props.label}`}
          width={32}
          height={32}
          minWidth={0}
          minHeight={0}
          padding={thickness(6)}
          background={theme.ref(
            'ControlFillColorTransparentBrush',
          )}
          borderBrush={theme.ref(
            'ControlFillColorTransparentBrush',
          )}
          toolTip="Copy to clipboard"
          onClick={copyValue}
        >
          <UI.FontIcon glyph={'\uE8C8'} fontSize={16} />
        </UI.Button>
      </LayoutGrid>
    </UI.StackPanel>
  )
}

export function IconographyPage(context: AppContext) {
  const search = signal('')
  const itemsView: RefObject<ItemsView> = { current: null }
  const panelHeight = signal(
    Math.max(320, Math.round(context.window.bounds.height - 260)),
  )
  const updatePanelHeight = (effectiveHeight: number) => {
    panelHeight.value = Math.max(
      320,
      Math.round(effectiveHeight - 260),
    )
  }
  onCleanup(
    context.window.onSizeChanged((_sender, args) => {
      updatePanelHeight(args.size.height)
    }),
  )
  const loadedIcons = signal<readonly IconData[]>([])
  const iconsLoaded = signal(false)
  const filteredIcons = computed(() =>
    filterIcons(search.value, loadedIcons.value),
  )
  const selectedCode = signal(iconCatalog[0]?.code ?? '')
  const selectedIcon = computed(() =>
    filteredIcons.value.find(
      (item) => item.code === selectedCode.value,
    ) ??
    filteredIcons.value[0] ??
    iconCatalog[0]!,
  )
  const resultStatus = computed(() => {
    if (!iconsLoaded.value) {
      return ''
    }
    const count = filteredIcons.value.length
    return count === 0
      ? 'No icons found.'
      : count === 1
        ? '1 icon found.'
        : `${count} icons found.`
  })
  const layout = context.createProjected(
    () => new UniformGridLayout(),
  )
  layout.minItemWidth = 96
  layout.minItemHeight = 96
  layout.minColumnSpacing = 8
  layout.minRowSpacing = 8
  layout.orientation = Orientation.Horizontal
  const queryIcon = context.createProjected(
    () => createSymbolIcon(SymbolIcon, Symbol.Find),
  )
  let loadQueued = false
  const loadIcons = () => {
    if (iconsLoaded.value || loadQueued) {
      return
    }
    loadQueued = true
    const queued =
      context.window.dispatcherQueue.tryEnqueue(
        DispatcherQueuePriority.High,
        () => {
          loadQueued = false
          loadedIcons.value = iconCatalog
          iconsLoaded.value = true
          selectedCode.value = iconCatalog[0]?.code ?? ''
          itemsView.current?.select(0)
        },
      )
    if (!queued) {
      loadQueued = false
      throw new Error(
        'Iconography data could not be queued.',
      )
    }
  }

  return (
    <Page
      title="Iconography"
      subtitle="Icons are a visual design language that can communicate information quickly and effectively."
      automationId="IconographyPageHeading"
      pageId="iconography"
      model={context.model}
    >
      <LayoutGrid
        rowDefinitions={[
          gridLength.auto(),
          gridLength.star(),
        ]}
        rowSpacing={8}
      >
        <UI.AutoSuggestBox
          automationId="GalleryIconographySearch"
          minWidth={304}
          maxWidth={320}
          margin={thickness(0, 16, 0, 0)}
          horizontalAlignment={HorizontalAlignment.Left}
          placeholderText="Search icons by name, code, or tags"
          queryIcon={queryIcon}
          text={search}
          onTextChanged={(sender) => {
            search.value = sender.text
            const next = filterIcons(
              sender.text,
              loadedIcons.value,
            )[0]
            if (next) {
              selectedCode.value = next.code
              itemsView.current?.select(0)
            }
            else {
              itemsView.current?.deselectAll()
            }
            context.model.recordInteraction()
          }}
        />
        <UI.TextBlock
          automationId="GalleryIconographySearchStatus"
          automationLiveSetting={AutomationLiveSetting.Polite}
          height={1}
          opacity={0}
          text={resultStatus}
        />

      <UI.Border
        automationId="GalleryIconographySample"
        gridRow={1}
        {...styles.card({ surface: 'layer' })}
        padding={thickness(0)}
        horizontalAlignment={HorizontalAlignment.Stretch}
      >
        <LayoutGrid
          columnDefinitions={[
            { size: gridLength.star(), min: 320 },
            { size: gridLength.pixel(334), max: 334 },
          ]}
          height={panelHeight}
          minHeight={320}
        >
          <GalleryItemsView
            ref={itemsView}
            automationId="GalleryIconographyItems"
            each={filteredIcons}
            key={(item) => item.code}
            layout={layout}
            height={panelHeight}
            padding={thickness(16)}
            isItemInvokedEnabled
            selectionMode={ItemsViewSelectionMode.Single}
            onLoaded={() => {
              loadIcons()
            }}
            onSelectionChanged={(sender) => {
              const selectedIndex = filteredIcons.value.findIndex(
                (_item, index) => sender.isSelected(index),
              )
              const item = filteredIcons.value[selectedIndex]
              if (item) {
                selectedCode.value = item.code
              }
            }}
            onItemInvoked={(sender) => {
              const item = filteredIcons.value[sender.currentItemIndex]
              if (item) {
                selectedCode.value = item.code
                sender.select(sender.currentItemIndex)
                context.model.recordInteraction()
              }
            }}
          >
            {(item) => (
              <UI.Border
                {...styles.card({ surface: 'card' })}
                automationName={item.name}
                width={96}
                height={96}
                padding={thickness(8)}
              >
                <LayoutGrid>
                  <UI.Viewbox
                    width={28}
                    height={28}
                    margin={thickness(0, 0, 0, 16)}
                    horizontalAlignment={HorizontalAlignment.Center}
                    verticalAlignment={VerticalAlignment.Center}
                  >
                    <UI.FontIcon glyph={item.character} />
                  </UI.Viewbox>
                  <UI.TextBlock
                    margin={thickness(8, 0, 8, 8)}
                    horizontalAlignment={HorizontalAlignment.Center}
                    verticalAlignment={VerticalAlignment.Bottom}
                    fontSize={12}
                    foreground={theme.secondaryText}
                    text={item.name}
                    textTrimming={TextTrimming.CharacterEllipsis}
                    textWrapping={TextWrapping.NoWrap}
                  />
                </LayoutGrid>
              </UI.Border>
            )}
          </GalleryItemsView>

          <UI.Border
            gridColumn={1}
            background={theme.cardBackground}
            borderBrush={theme.dividerStroke}
            borderThickness={thickness(1, 0, 0, 0)}
            cornerRadius={{
              topLeft: 0,
              topRight: 8,
              bottomRight: 8,
              bottomLeft: 0,
            }}
            padding={thickness(16, 16, 8, 16)}
            visibility={computed(() =>
              filteredIcons.value.length > 0
                ? Visibility.Visible
                : Visibility.Collapsed,
            )}
          >
            <UI.ScrollViewer>
              <UI.StackPanel spacing={2}>
                <LayoutGrid
                  margin={thickness(0, 0, 0, 24)}
                  columnDefinitions={[
                    gridLength.auto(),
                    gridLength.star(),
                  ]}
                >
                  <UI.Border
                    margin={thickness(0, 0, 8, 0)}
                    padding={thickness(8)}
                    horizontalAlignment={HorizontalAlignment.Left}
                    background={theme.controlFill}
                    borderBrush={theme.controlStroke}
                    borderThickness={thickness(1)}
                    cornerRadius={cornerRadius(4)}
                  >
                    <UI.FontIcon
                      fontSize={48}
                      glyph={computed(
                        () => selectedIcon.value.character,
                      )}
                    />
                  </UI.Border>
                  <UI.StackPanel
                    gridColumn={1}
                    margin={thickness(0, 4, 0, 0)}
                    orientation={Orientation.Horizontal}
                    spacing={8}
                    verticalAlignment={VerticalAlignment.Top}
                    visibility={computed(() =>
                      selectedIcon.value.isSegoeFluentOnly
                        ? Visibility.Visible
                        : Visibility.Collapsed,
                    )}
                  >
                    <UI.FontIcon
                      fontSize={12}
                      foreground={theme.systemCaution}
                      glyph={'\uE7BA'}
                      verticalAlignment={VerticalAlignment.Center}
                    />
                    <UI.TextBlock
                      fontSize={12}
                      foreground={theme.systemCaution}
                      text="Only supported in Segoe Fluent Icons"
                      textWrapping={TextWrapping.Wrap}
                      verticalAlignment={VerticalAlignment.Center}
                    />
                  </UI.StackPanel>
                </LayoutGrid>
                <CodeValue
                  label="Icon name"
                  value={computed(() => selectedIcon.value.name)}
                  automationId="GalleryIconographySelectedName"
                />
                <CodeValue
                  label="Text glyph"
                  value={computed(() => selectedIcon.value.textGlyph)}
                />
                <CodeValue
                  label="Code glyph"
                  value={computed(() => selectedIcon.value.codeGlyph)}
                />
                <CodeValue
                  label="FontIcon TSX"
                  value={computed(
                    () =>
                      `<UI.FontIcon glyph={'${selectedIcon.value.textGlyph}'} />`,
                  )}
                />
                <CodeValue
                  label="FontIcon JavaScript"
                  value={computed(
                    () =>
                      `const icon = new FontIcon()\nicon.glyph = '${selectedIcon.value.textGlyph}'`,
                  )}
                />
                <Show
                  when={computed(
                    () => selectedIcon.value.symbolName,
                  )}
                >
                  {(symbolName) => (
                    <>
                      <CodeValue
                        label="SymbolIcon TSX"
                        value={computed(
                          () =>
                            `<UI.SymbolIcon symbol={Symbol.${symbolName}} />`,
                        )}
                      />
                      <CodeValue
                        label="SymbolIcon JavaScript"
                        value={computed(
                          () =>
                            `const icon = new SymbolIcon()\nicon.symbol = Symbol.${symbolName}`,
                        )}
                      />
                    </>
                  )}
                </Show>
                <UI.TextBlock
                  margin={thickness(0, 4, 0, 0)}
                  fontSize={12}
                  foreground={theme.secondaryText}
                  text="Tags"
                />
                <Show
                  when={computed(
                    () => selectedIcon.value.tags.length > 0,
                  )}
                  fallback={
                    <UI.TextBlock
                      margin={thickness(0, 4, 0, 0)}
                      text="No tags available."
                    />
                  }
                >
                  <UI.VariableSizedWrapGrid
                    automationName="Tags"
                    margin={thickness(0, 8, 0, 4)}
                    itemWidth={4}
                    itemHeight={28}
                    orientation={Orientation.Horizontal}
                  >
                    <For
                      each={computed(
                        () => selectedIcon.value.tags,
                      )}
                      key={(tag) => tag}
                    >
                      {(tag) => (
                        <UI.Button
                          variableSizedWrapGridColumnSpan={Math.max(
                            8,
                            Math.ceil(
                              (tag.length * 9 + 24) / 4,
                            ),
                          )}
                          minHeight={24}
                          margin={thickness(0, 0, 4, 4)}
                          padding={thickness(8, 2)}
                          horizontalAlignment={HorizontalAlignment.Stretch}
                          background={theme.cardBackground}
                          borderBrush={theme.cardStroke}
                          borderThickness={thickness(1)}
                          cornerRadius={cornerRadius(12)}
                          foreground={theme.secondaryText}
                          onClick={() => {
                            search.value = tag
                            const next = filterIcons(
                              tag,
                              loadedIcons.value,
                            )[0]
                            if (next) {
                              selectedCode.value = next.code
                              itemsView.current?.select(0)
                            }
                            context.model.recordInteraction()
                          }}
                        >
                          {tag}
                        </UI.Button>
                      )}
                    </For>
                  </UI.VariableSizedWrapGrid>
                </Show>
              </UI.StackPanel>
            </UI.ScrollViewer>
          </UI.Border>
        </LayoutGrid>
      </UI.Border>
      </LayoutGrid>
    </Page>
  )
}
