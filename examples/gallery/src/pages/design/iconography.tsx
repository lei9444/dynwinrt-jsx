import {
  For,
  computed,
  cornerRadius,
  gridLength,
  signal,
  styles,
  theme,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  AutomationLiveSetting,
  HorizontalAlignment,
  ItemsView,
  ItemsViewSelectionMode,
  Orientation,
  TextTrimming,
  TextWrapping,
  UniformGridLayout,
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
  }))

function filterIcons(query: string): readonly IconData[] {
  const tokens = query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (tokens.length === 0) {
    return iconCatalog
  }
  return iconCatalog.filter((item) =>
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
  return (
    <UI.StackPanel spacing={4}>
      <UI.TextBlock
        foreground={theme.secondaryText}
        text={props.label}
      />
      <UI.Border
        {...styles.card({ surface: 'layer' })}
        minHeight={32}
        padding={thickness(8, 6)}
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
    </UI.StackPanel>
  )
}

export function IconographyPage(context: AppContext) {
  const search = signal('')
  const itemsView: RefObject<ItemsView> = { current: null }
  const filteredIcons = computed(() => filterIcons(search.value))
  const selectedCode = signal(iconCatalog[0]?.code ?? '')
  const selectedIcon = computed(() =>
    filteredIcons.value.find(
      (item) => item.code === selectedCode.value,
    ) ??
    filteredIcons.value[0] ??
    iconCatalog[0]!,
  )
  const resultStatus = computed(() => {
    const count = filteredIcons.value.length
    return count === 0
      ? 'No icons found.'
      : count === 1
        ? '1 icon found.'
        : `${count} icons found.`
  })
  const layout = new UniformGridLayout()
  layout.minItemWidth = 96
  layout.minItemHeight = 96
  layout.minColumnSpacing = 8
  layout.minRowSpacing = 8
  layout.orientation = Orientation.Horizontal

  return (
    <Page
      title="Iconography"
      subtitle="Icons are a visual design language that can communicate information quickly and effectively."
      automationId="IconographyPageHeading"
      pageId="iconography"
      model={context.model}
    >
      <UI.AutoSuggestBox
        automationId="GalleryIconographySearch"
        minWidth={304}
        maxWidth={320}
        horizontalAlignment={HorizontalAlignment.Left}
        placeholderText="Search icons by name, code, or tags"
        text={search}
        onTextChanged={(sender) => {
          search.value = sender.text
          const next = filterIcons(sender.text)[0]
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
        text={resultStatus}
      />

      <LayoutGrid
        automationId="GalleryIconographySample"
        columnDefinitions={[
          { size: gridLength.star(), min: 320 },
          { size: gridLength.pixel(334), max: 334 },
        ]}
        height={560}
        minHeight={560}
      >
        <GalleryItemsView
          ref={itemsView}
          automationId="GalleryIconographyItems"
          each={filteredIcons}
          key={(item) => item.code}
          layout={layout}
          height={560}
          isItemInvokedEnabled
          selectionMode={ItemsViewSelectionMode.Single}
          onLoaded={() => {
            itemsView.current?.select(0)
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
              {...styles.card({ surface: 'layer' })}
              automationName={item.name}
              width={96}
              height={96}
              padding={thickness(8)}
            >
              <UI.StackPanel spacing={8}>
                <UI.Viewbox width={28} height={28}>
                  <UI.FontIcon glyph={item.character} />
                </UI.Viewbox>
                <UI.TextBlock
                  horizontalAlignment={HorizontalAlignment.Center}
                  foreground={theme.secondaryText}
                  text={item.name}
                  textTrimming={TextTrimming.CharacterEllipsis}
                  textWrapping={TextWrapping.NoWrap}
                />
              </UI.StackPanel>
            </UI.Border>
          )}
        </GalleryItemsView>

        <UI.Border
          gridColumn={1}
          background={theme.cardBackground}
          borderBrush={theme.dividerStroke}
          borderThickness={thickness(1, 0, 0, 0)}
          padding={thickness(16)}
          visibility={computed(() =>
            filteredIcons.value.length > 0
              ? Visibility.Visible
              : Visibility.Collapsed,
          )}
        >
          <UI.ScrollViewer>
            <UI.StackPanel spacing={8}>
              <UI.Border
                width={72}
                height={72}
                padding={thickness(8)}
                horizontalAlignment={HorizontalAlignment.Left}
                background={theme.controlFill}
                borderBrush={theme.controlStroke}
                borderThickness={thickness(1)}
                cornerRadius={cornerRadius(4)}
              >
                <UI.FontIcon
                  fontSize={48}
                  glyph={computed(() => selectedIcon.value.character)}
                />
              </UI.Border>
              <UI.TextBlock
                foreground={theme.systemCaution}
                text="Only supported in Segoe Fluent Icons"
                textWrapping={TextWrapping.Wrap}
                visibility={computed(() =>
                  selectedIcon.value.isSegoeFluentOnly
                    ? Visibility.Visible
                    : Visibility.Collapsed,
                )}
              />
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
              <UI.TextBlock
                foreground={theme.secondaryText}
                text="Tags"
              />
              <UI.StackPanel spacing={4}>
                <For
                  each={computed(() => selectedIcon.value.tags)}
                  key={(tag) => tag}
                >
                  {(tag) => (
                  <UI.Button
                    horizontalAlignment={HorizontalAlignment.Left}
                    onClick={() => {
                      search.value = tag
                      const next = filterIcons(tag)[0]
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
              </UI.StackPanel>
            </UI.StackPanel>
          </UI.ScrollViewer>
        </UI.Border>
      </LayoutGrid>
    </Page>
  )
}
