import {
  Show,
  color,
  computed,
  cornerRadius,
  createSolidColorBrush,
  gridLength,
  signal,
  styles,
  theme,
  thickness,
  tokens,
} from 'dynwinrt-jsx'
import {
  Clipboard,
  DataPackage,
  DesktopAcrylicBackdrop,
  HorizontalAlignment,
  MicaBackdrop,
  MicaKind,
  Orientation,
  releaseProjected,
  SolidColorBrush,
  TextWrapping,
  VerticalAlignment,
} from '#winapp/bindings'
import {
  type AppContext,
  GallerySelectorBar,
  LayoutGrid,
  UI,
} from '../../gallery-ui'
import { Page } from '../../components/gallery-components'
import {
  GuidanceText,
} from '../fundamentals/shared'
import { loadGalleryBitmap } from '../../gallery-assets'
import colorSectionsData from './color-sections-data.json'

interface ThemeColorEntry {
  readonly name: string
  readonly resource: string
  readonly background?: string
  readonly backdrop?: 'Base' | 'BaseAlt' | 'Acrylic'
  readonly label?: string
  readonly usage: string
  readonly foreground: string | null
}

interface ThemeColorGridData {
  readonly columns: number
  readonly tiles: readonly ThemeColorEntry[]
}

type ColorPreviewKind =
  | 'text'
  | 'button'
  | 'toggle'
  | 'slider'
  | 'scrollbar'
  | 'info'
  | 'surface'

interface ThemeColorGroupData {
  readonly title: string
  readonly description: string
  readonly background: string
  readonly foreground: string | null
  readonly preview: ColorPreviewKind
  readonly grids: readonly ThemeColorGridData[]
}

type StandardColorSection = Exclude<
  (typeof sections)[number],
  'High Contrast'
>

interface HighContrastEntry {
  readonly name: string
  readonly resource: string
  readonly usage: string
  readonly value: string
  readonly background: SolidColorBrush
  readonly foreground: SolidColorBrush
}

type ColorForeground =
  | ReturnType<typeof theme.ref>
  | SolidColorBrush

const sections = [
  'Text',
  'Fill',
  'Stroke',
  'Background',
  'Signal',
  'High Contrast',
] as const

const standardSections = sections.slice(
  0,
  5,
) as readonly StandardColorSection[]

const colorSections = colorSectionsData as Record<
  StandardColorSection,
  readonly ThemeColorGroupData[]
>

function createBrush(
  value: string,
  createProjected: AppContext['createProjected'],
): SolidColorBrush {
  return createProjected(
    () =>
      createSolidColorBrush(
        SolidColorBrush,
        color(
          Number.parseInt(value.slice(1, 3), 16),
          Number.parseInt(value.slice(3, 5), 16),
          Number.parseInt(value.slice(5, 7), 16),
        ),
      ),
  )
}

function createHighContrastTheme(
  entries: readonly (readonly [
    name: string,
    resource: string,
    usage: string,
    value: string,
    foreground: string,
  ])[],
  createProjected: AppContext['createProjected'],
): readonly HighContrastEntry[] {
  return entries.map(
    ([name, resource, usage, value, foreground]) => ({
      name,
      resource,
      usage,
      value,
      background: createBrush(value, createProjected),
      foreground: createBrush(
        foreground,
        createProjected,
      ),
    }),
  )
}

const highContrastUsage = {
  windowText:
    'Headings, body copy, lists, placeholder text, app and window borders, and non-interactive UI',
  window:
    'Background of pages, panes, popups, and windows',
  highlightText:
    'Foreground for selected, hovered, pressed, or in-progress UI',
  highlight:
    'Background or accent for selected, hovered, pressed, or in-progress UI',
  buttonText:
    'Foreground for buttons and other interactive UI',
  buttonFace:
    'Background for buttons and other interactive UI',
  hotlight:
    'Foreground for hyperlink text',
  grayText:
    'Foreground for inactive or disabled UI',
} as const

const highContrastThemeDefinitions = [
  {
    name: 'Aquatic',
    colors: [
      [
        'Window Text Color',
        'SystemColorWindowTextColor',
        highContrastUsage.windowText,
        '#FFFFFF',
        '#202020',
      ],
      [
        'Highlight Text Color',
        'SystemColorHighlightTextColor',
        highContrastUsage.highlightText,
        '#263B50',
        '#8EE3F0',
      ],
      [
        'Button Text Color',
        'SystemColorButtonTextColor',
        highContrastUsage.buttonText,
        '#FFFFFF',
        '#202020',
      ],
      [
        'Hotlight Color',
        'SystemColorHotlightColor',
        highContrastUsage.hotlight,
        '#75E9FC',
        '#202020',
      ],
      [
        'Window Color',
        'SystemColorWindowColor',
        highContrastUsage.window,
        '#202020',
        '#FFFFFF',
      ],
      [
        'Highlight Color',
        'SystemColorHighlightColor',
        highContrastUsage.highlight,
        '#8EE3F0',
        '#263B50',
      ],
      [
        'Button Face Color',
        'SystemColorButtonFaceColor',
        highContrastUsage.buttonFace,
        '#202020',
        '#FFFFFF',
      ],
      [
        'Gray Text Color / Disabled',
        'SystemColorGrayTextColor',
        highContrastUsage.grayText,
        '#A6A6A6',
        '#FFFFFF',
      ],
    ],
  },
  {
    name: 'Desert',
    colors: [
      [
        'Window Text Color',
        'SystemColorWindowTextColor',
        highContrastUsage.windowText,
        '#3D3D3D',
        '#FFFAEF',
      ],
      [
        'Highlight Text Color',
        'SystemColorHighlightTextColor',
        highContrastUsage.highlightText,
        '#FFF5E3',
        '#903909',
      ],
      [
        'Button Text Color',
        'SystemColorButtonTextColor',
        highContrastUsage.buttonText,
        '#202020',
        '#FFFAEF',
      ],
      [
        'Hotlight Color',
        'SystemColorHotlightColor',
        highContrastUsage.hotlight,
        '#1C5E75',
        '#FFFAEF',
      ],
      [
        'Window Color',
        'SystemColorWindowColor',
        highContrastUsage.window,
        '#FFFAEF',
        '#3D3D3D',
      ],
      [
        'Highlight Color',
        'SystemColorHighlightColor',
        highContrastUsage.highlight,
        '#903909',
        '#FFF5E3',
      ],
      [
        'Button Face Color',
        'SystemColorButtonFaceColor',
        highContrastUsage.buttonFace,
        '#FFFAEF',
        '#202020',
      ],
      [
        'Gray Text Color / Disabled',
        'SystemColorGrayTextColor',
        highContrastUsage.grayText,
        '#676767',
        '#FFFAEF',
      ],
    ],
  },
  {
    name: 'Dusk',
    colors: [
      [
        'Window Text Color',
        'SystemColorWindowTextColor',
        highContrastUsage.windowText,
        '#FFFFFF',
        '#2D3236',
      ],
      [
        'Highlight Text Color',
        'SystemColorHighlightTextColor',
        highContrastUsage.highlightText,
        '#212D3B',
        '#ABCFF2',
      ],
      [
        'Button Text Color',
        'SystemColorButtonTextColor',
        highContrastUsage.buttonText,
        '#B6F6F0',
        '#2D3236',
      ],
      [
        'Hotlight Color',
        'SystemColorHotlightColor',
        highContrastUsage.hotlight,
        '#70EBDE',
        '#202020',
      ],
      [
        'Window Color',
        'SystemColorWindowColor',
        highContrastUsage.window,
        '#2D3236',
        '#FFFFFF',
      ],
      [
        'Highlight Color',
        'SystemColorHighlightColor',
        highContrastUsage.highlight,
        '#ABCFF2',
        '#212D3B',
      ],
      [
        'Button Face Color',
        'SystemColorButtonFaceColor',
        highContrastUsage.buttonFace,
        '#2D3236',
        '#B6F6F0',
      ],
      [
        'Gray Text Color / Disabled',
        'SystemColorGrayTextColor',
        highContrastUsage.grayText,
        '#A6A6A6',
        '#FFFFFF',
      ],
    ],
  },
  {
    name: 'Night Sky',
    colors: [
      [
        'Window Text Color',
        'SystemColorWindowTextColor',
        highContrastUsage.windowText,
        '#FFFFFF',
        '#000000',
      ],
      [
        'Highlight Text Color',
        'SystemColorHighlightTextColor',
        highContrastUsage.highlightText,
        '#2B2B2B',
        '#D6B4FD',
      ],
      [
        'Button Text Color',
        'SystemColorButtonTextColor',
        highContrastUsage.buttonText,
        '#FFEE32',
        '#000000',
      ],
      [
        'Hotlight Color',
        'SystemColorHotlightColor',
        highContrastUsage.hotlight,
        '#8080FF',
        '#FFFFFF',
      ],
      [
        'Window Color',
        'SystemColorWindowColor',
        highContrastUsage.window,
        '#000000',
        '#FFFFFF',
      ],
      [
        'Highlight Color',
        'SystemColorHighlightColor',
        highContrastUsage.highlight,
        '#D6B4FD',
        '#2B2B2B',
      ],
      [
        'Button Face Color',
        'SystemColorButtonFaceColor',
        highContrastUsage.buttonFace,
        '#000000',
        '#FFEE32',
      ],
      [
        'Gray Text Color / Disabled',
        'SystemColorGrayTextColor',
        highContrastUsage.grayText,
        '#A6A6A6',
        '#000000',
      ],
    ],
  },
] as const

function copyResourceName(value: string): void {
  const data = new DataPackage()
  try {
    data.setText(value)
    Clipboard.setContent(data)
    Clipboard.flush()
  }
  finally {
    releaseProjected(data)
  }
}

function colorForeground(
  resource: string | null,
  blackBrush: SolidColorBrush,
) {
  if (resource === 'Black') {
    return blackBrush
  }
  if (resource === 'TextFillColorPrimary') {
    return theme.primaryText
  }
  return resource ? theme.ref(resource) : theme.primaryText
}

function ColorCopyButton(props: {
  readonly resource: string
  readonly foreground: ColorForeground
  readonly onCopy: () => void
}) {
  return (
    <UI.Button
      gridColumn={1}
      gridRowSpan={2}
      automationName={`Copy ${props.resource}`}
      width={32}
      height={32}
      minWidth={0}
      minHeight={0}
      padding={thickness(6)}
      horizontalAlignment={HorizontalAlignment.Right}
      verticalAlignment={VerticalAlignment.Top}
      background={theme.ref('ControlFillColorTransparentBrush')}
      borderBrush={theme.ref('ControlFillColorTransparentBrush')}
      foreground={props.foreground}
      resourceOverrides={{
        ButtonForegroundPointerOver: props.foreground,
        ButtonForegroundPressed: props.foreground,
        ButtonForegroundDisabled: props.foreground,
      }}
      toolTip="Copy brush name"
      onClick={props.onCopy}
    >
      <UI.FontIcon glyph={'\uE8C8'} fontSize={16} />
    </UI.Button>
  )
}

function ThemeColorTile(props: {
  readonly entry: ThemeColorEntry
  readonly blackBrush: SolidColorBrush
  readonly micaBase: MicaBackdrop
  readonly micaAlt: MicaBackdrop
  readonly acrylic: DesktopAcrylicBackdrop
  readonly onCopy: () => void
}) {
  const foreground = colorForeground(
    props.entry.foreground,
    props.blackBrush,
  )
  const backdrop =
    props.entry.backdrop === 'Base'
      ? props.micaBase
      : props.entry.backdrop === 'BaseAlt'
        ? props.micaAlt
        : props.entry.backdrop === 'Acrylic'
          ? props.acrylic
        : null
  return (
    <LayoutGrid
      automationId={`GalleryDesignColor${(props.entry.resource || props.entry.name).replaceAll(/[^A-Za-z0-9]/g, '')}`}
      minHeight={132}
      padding={thickness(12)}
      background={theme.ref(
        props.entry.background ?? props.entry.resource,
      )}
      rowDefinitions={[
        gridLength.auto(),
        gridLength.auto(),
        gridLength.star(),
        gridLength.auto(),
      ]}
      columnDefinitions={[
        gridLength.star(),
        gridLength.auto(),
      ]}
      rowSpacing={6}
      horizontalAlignment={HorizontalAlignment.Stretch}
    >
      {backdrop ? (
        <UI.SystemBackdropElement
          gridRowSpan={4}
          gridColumnSpan={2}
          systemBackdrop={backdrop}
          cornerRadius={tokens.radius.card}
        />
      ) : null}
      <UI.TextBlock
        {...styles.heading({ level: 'bodyStrong' })}
        foreground={foreground}
        isTextSelectionEnabled
        text={props.entry.name}
        textWrapping={TextWrapping.WrapWholeWords}
      />
      {props.entry.resource ? (
        <ColorCopyButton
          resource={props.entry.resource}
          foreground={foreground}
          onCopy={props.onCopy}
        />
      ) : null}
      <UI.TextBlock
        gridRow={1}
        margin={thickness(0, -4, 0, 0)}
        foreground={foreground}
        opacity={0.8}
        text={props.entry.usage}
        textWrapping={TextWrapping.WrapWholeWords}
      />
      <UI.TextBlock
        gridRow={3}
        gridColumnSpan={2}
        foreground={foreground}
        isTextSelectionEnabled
        text={props.entry.label ?? props.entry.resource}
        textWrapping={TextWrapping.Wrap}
      />
    </LayoutGrid>
  )
}

function ThemeColorGrid(props: {
  readonly grid: ThemeColorGridData
  readonly blackBrush: SolidColorBrush
  readonly micaBase: MicaBackdrop
  readonly micaAlt: MicaBackdrop
  readonly acrylic: DesktopAcrylicBackdrop
  readonly onCopy: (entry: ThemeColorEntry) => void
}) {
  const columnCount = props.grid.columns
  const rowCount = Math.ceil(
    props.grid.tiles.length / columnCount,
  )
  return (
    <UI.Border
      background={theme.solidBackground}
      borderBrush={theme.cardStroke}
      borderThickness={thickness(1)}
      cornerRadius={tokens.radius.overlay}
      padding={thickness(0)}
      horizontalAlignment={HorizontalAlignment.Stretch}
    >
      <LayoutGrid
        rowDefinitions={Array.from(
          { length: rowCount },
          () => gridLength.star(),
        )}
        columnDefinitions={Array.from(
          { length: columnCount },
          () => gridLength.star(),
        )}
        horizontalAlignment={HorizontalAlignment.Stretch}
      >
        {props.grid.tiles.map((entry, index) => {
          const row = Math.floor(index / columnCount)
          const column = index % columnCount
          return (
            <UI.Border
              key={entry.resource || entry.name}
              gridRow={row}
              gridColumn={column}
              borderBrush={theme.cardStroke}
              borderThickness={thickness(
                column === 0 ? 0 : 1,
                row === 0 ? 0 : 1,
                0,
                0,
              )}
              cornerRadius={{
                topLeft: row === 0 && column === 0 ? 8 : 0,
                topRight:
                  row === 0 &&
                  column === columnCount - 1
                    ? 8
                    : 0,
                bottomRight:
                  row === rowCount - 1 &&
                  column === columnCount - 1
                    ? 8
                    : 0,
                bottomLeft:
                  row === rowCount - 1 && column === 0
                    ? 8
                    : 0,
              }}
              horizontalAlignment={HorizontalAlignment.Stretch}
            >
              <ThemeColorTile
                entry={entry}
                blackBrush={props.blackBrush}
                micaBase={props.micaBase}
                micaAlt={props.micaAlt}
                acrylic={props.acrylic}
                onCopy={() => props.onCopy(entry)}
              />
            </UI.Border>
          )
        })}
      </LayoutGrid>
    </UI.Border>
  )
}

function ColorPreviewContent(props: {
  readonly group: ThemeColorGroupData
  readonly foreground: ColorForeground
  readonly micaBase: MicaBackdrop
  readonly micaAlt: MicaBackdrop
  readonly acrylic: DesktopAcrylicBackdrop
  readonly ownProjected: AppContext['ownProjected']
}) {
  switch (props.group.preview) {
    case 'text':
      return (
        <UI.TextBlock
          foreground={
            props.group.title === 'Accent Text'
              ? theme.ref('AccentTextFillColorPrimaryBrush')
              : props.foreground
          }
          fontSize={42}
          fontWeight={{ weight: 600 }}
          text="Aa"
        />
      )
    case 'button':
      return <UI.Button content="Text" />
    case 'toggle':
      return (
        <UI.ToggleSwitch
          minWidth={40}
          maxWidth={40}
          offContent=""
          onContent=""
        />
      )
    case 'slider':
      return <UI.Slider width={220} value={50} />
    case 'scrollbar':
      return (
        <UI.StackPanel
          width={220}
          orientation={Orientation.Horizontal}
          spacing={8}
        >
          <UI.Border
            width={160}
            height={4}
            background={theme.controlStroke}
            cornerRadius={tokens.radius.control}
          />
          <UI.Border
            width={32}
            height={8}
            background={theme.accent}
            cornerRadius={tokens.radius.control}
          />
        </UI.StackPanel>
      )
    case 'info':
      return (
        <UI.InfoBar
          isOpen
          title="Informational message"
          message="System colors communicate status."
        />
      )
    case 'surface':
      if (props.group.title === 'Accent Fill') {
        return (
          <UI.Button
            background={theme.accent}
            foreground={theme.textOnAccent}
            content="Text"
          />
        )
      }
      if (props.group.title === 'Control On Image Fill') {
        return (
          <ControlOnImagePreview
            ownProjected={props.ownProjected}
          />
        )
      }
      if (props.group.title === 'Subtle Fill') {
        return (
          <UI.StackPanel>
            <LayoutGrid padding={thickness(8)}>
              <UI.TextBlock text="Rest" />
            </LayoutGrid>
            <LayoutGrid
              minWidth={120}
              padding={thickness(12)}
              background={theme.ref(
                'SubtleFillColorSecondaryBrush',
              )}
              cornerRadius={tokens.radius.control}
            >
              <UI.TextBlock text="Hover" />
            </LayoutGrid>
          </UI.StackPanel>
        )
      }
      return (
        <ColorSurfacePreview
          title={props.group.title}
          micaBase={props.micaBase}
          micaAlt={props.micaAlt}
          acrylic={props.acrylic}
        />
      )
  }
}

function ControlOnImagePreview(props: {
  readonly ownProjected: AppContext['ownProjected']
}) {
  const image = loadGalleryBitmap(
    'SampleMedia/valley.jpg',
    320,
    props.ownProjected,
  )
  return (
    <LayoutGrid
      height={150}
      cornerRadius={tokens.radius.control}
    >
      <UI.Image
        maxHeight={150}
        source={image}
      />
      <UI.Border
        width={20}
        height={20}
        margin={thickness(8)}
        horizontalAlignment={HorizontalAlignment.Right}
        verticalAlignment={VerticalAlignment.Top}
        background={theme.ref(
          'ControlOnImageFillColorDefaultBrush',
        )}
        borderBrush={theme.ref(
          'ControlStrongStrokeColorDefaultBrush',
        )}
        borderThickness={thickness(1)}
        cornerRadius={tokens.radius.control}
      />
    </LayoutGrid>
  )
}

function ColorSurfacePreview(props: {
  readonly title: string
  readonly micaBase: MicaBackdrop
  readonly micaAlt: MicaBackdrop
  readonly acrylic: DesktopAcrylicBackdrop
}) {
  switch (props.title) {
    case 'Card Stroke':
      return (
        <UI.Border
          width={60}
          height={48}
          background={theme.cardBackground}
          borderBrush={theme.cardStroke}
          borderThickness={thickness(1)}
          cornerRadius={tokens.radius.control}
        />
      )
    case 'Surface Stroke':
      return (
        <UI.Border
          width={120}
          height={40}
          background={theme.ref(
            'AcrylicBackgroundFillColorBaseBrush',
          )}
          borderBrush={theme.ref(
            'SurfaceStrokeColorDefaultBrush',
          )}
          borderThickness={thickness(1)}
          cornerRadius={tokens.radius.overlay}
        />
      )
    case 'Divider Stroke':
      return (
        <UI.Border
          width={120}
          height={40}
          background={theme.ref(
            'AcrylicBackgroundFillColorBaseBrush',
          )}
          borderBrush={theme.ref(
            'SurfaceStrokeColorDefaultBrush',
          )}
          borderThickness={thickness(1)}
          cornerRadius={tokens.radius.overlay}
        >
          <UI.Border
            width={1}
            horizontalAlignment={HorizontalAlignment.Center}
            verticalAlignment={VerticalAlignment.Stretch}
            background={theme.dividerStroke}
          />
        </UI.Border>
      )
    case 'Focus Stroke':
      return (
        <UI.Border
          borderBrush={theme.ref('FocusStrokeColorOuterBrush')}
          borderThickness={thickness(2)}
          cornerRadius={cornerRadius(10)}
        >
          <UI.Border
            borderBrush={theme.ref('FocusStrokeColorInnerBrush')}
            borderThickness={thickness(2)}
            cornerRadius={cornerRadius(9)}
          >
            <UI.Border
              width={120}
              height={40}
              borderBrush={theme.ref(
                'SurfaceStrokeColorDefaultBrush',
              )}
              borderThickness={thickness(1)}
              cornerRadius={tokens.radius.overlay}
            >
              <UI.TextBlock
                horizontalAlignment={HorizontalAlignment.Center}
                verticalAlignment={VerticalAlignment.Center}
                text="Text"
              />
            </UI.Border>
          </UI.Border>
        </UI.Border>
      )
    case 'Card Background':
      return (
        <UI.Border
          width={60}
          height={30}
          background={theme.cardBackground}
          borderBrush={theme.cardStroke}
          borderThickness={thickness(1)}
          cornerRadius={tokens.radius.control}
        />
      )
    case 'Smoke Background':
      return (
        <UI.Border
          width={120}
          height={40}
          background={theme.cardBackground}
          borderBrush={theme.cardStroke}
          borderThickness={thickness(1)}
          cornerRadius={tokens.radius.overlay}
        />
      )
    case 'Layer':
      return (
        <UI.Border
          width={120}
          height={40}
          background={theme.ref(
            'AcrylicBackgroundFillColorBaseBrush',
          )}
          borderBrush={theme.cardStroke}
          borderThickness={thickness(1)}
          cornerRadius={tokens.radius.overlay}
        >
          <LayoutGrid
            columnDefinitions={[
              gridLength.pixel(30),
              gridLength.pixel(90),
            ]}
          >
            <UI.SystemBackdropElement
              gridColumnSpan={2}
              systemBackdrop={props.acrylic}
              cornerRadius={tokens.radius.overlay}
            />
            <UI.Border
              gridColumn={1}
              background={theme.layerFill}
              borderBrush={theme.cardStroke}
              borderThickness={thickness(1, 0, 0, 0)}
            />
          </LayoutGrid>
        </UI.Border>
      )
    case 'Layer on Acrylic':
      return (
        <UI.Border
          width={120}
          height={40}
          background={theme.ref(
            'AcrylicBackgroundFillColorBaseBrush',
          )}
          borderBrush={theme.cardStroke}
          borderThickness={thickness(1)}
          cornerRadius={tokens.radius.overlay}
        >
          <LayoutGrid
            columnDefinitions={[
              gridLength.pixel(30),
              gridLength.pixel(90),
            ]}
          >
            <UI.Border
              gridColumn={1}
              background={theme.ref(
                'LayerOnAcrylicFillColorDefaultBrush',
              )}
              borderBrush={theme.cardStroke}
              borderThickness={thickness(1, 0, 0, 0)}
            />
          </LayoutGrid>
        </UI.Border>
      )
    case 'Layer on Mica Base Alt':
      return (
        <LayoutGrid>
          <UI.SystemBackdropElement
            systemBackdrop={props.micaAlt}
            cornerRadius={tokens.radius.overlay}
          />
          <UI.TabViewItem
            width={150}
            height={30}
            margin={thickness(8)}
            header="Text"
            borderBrush={theme.controlStroke}
            borderThickness={thickness(1)}
          />
        </LayoutGrid>
      )
    case 'Solid Background':
      return (
        <UI.Border
          width={120}
          height={40}
          background={theme.ref(
            'SolidBackgroundFillColorBaseBrush',
          )}
          borderBrush={theme.cardStroke}
          borderThickness={thickness(1)}
          cornerRadius={tokens.radius.control}
        />
      )
    case 'Mica Background':
      return (
        <UI.Border
          width={120}
          height={40}
          background={theme.ref(
            'AcrylicBackgroundFillColorBaseBrush',
          )}
          borderBrush={theme.cardStroke}
          borderThickness={thickness(1)}
          cornerRadius={tokens.radius.overlay}
        >
          <UI.SystemBackdropElement
            systemBackdrop={props.micaBase}
            cornerRadius={tokens.radius.overlay}
          />
        </UI.Border>
      )
    case 'Acrylic Background':
      return (
        <UI.Border
          width={120}
          height={40}
          background={theme.ref(
            'AcrylicBackgroundFillColorBaseBrush',
          )}
          borderBrush={theme.cardStroke}
          borderThickness={thickness(1)}
          cornerRadius={tokens.radius.overlay}
        >
          <UI.SystemBackdropElement
            systemBackdrop={props.acrylic}
            cornerRadius={tokens.radius.overlay}
          />
        </UI.Border>
      )
    case 'Accent Acrylic Background':
      return (
        <UI.Border
          width={120}
          height={40}
          background={theme.ref(
            'AccentAcrylicBackgroundFillColorBaseBrush',
          )}
          borderBrush={theme.cardStroke}
          borderThickness={thickness(1)}
          cornerRadius={tokens.radius.overlay}
        />
      )
    default:
      return (
        <UI.Border
          width={120}
          height={40}
          background={theme.cardBackground}
          borderBrush={theme.cardStroke}
          borderThickness={thickness(1)}
          cornerRadius={tokens.radius.overlay}
        />
      )
  }
}

function ColorGroupPreview(props: {
  readonly group: ThemeColorGroupData
  readonly blackBrush: SolidColorBrush
  readonly micaBase: MicaBackdrop
  readonly micaAlt: MicaBackdrop
  readonly acrylic: DesktopAcrylicBackdrop
  readonly ownProjected: AppContext['ownProjected']
}) {
  const foreground = colorForeground(
    props.group.foreground,
    props.blackBrush,
  )
  return (
    <LayoutGrid
      margin={thickness(0, 36, 0, 8)}
      padding={thickness(12)}
      background={theme.ref(props.group.background)}
      borderBrush={theme.cardStroke}
      borderThickness={thickness(1)}
      cornerRadius={tokens.radius.overlay}
      rowDefinitions={[
        gridLength.auto(),
        gridLength.auto(),
        gridLength.auto(),
      ]}
      rowSpacing={4}
    >
      <UI.TextBlock
        {...styles.heading({ level: 'subtitle' })}
        foreground={foreground}
        text={props.group.title}
      />
      <UI.TextBlock
        gridRow={1}
        foreground={foreground}
        opacity={0.8}
        text={props.group.description}
        textWrapping={TextWrapping.Wrap}
      />
      <UI.Border
        gridRow={2}
        margin={thickness(0, 8, 0, 0)}
        horizontalAlignment={HorizontalAlignment.Center}
      >
        <ColorPreviewContent
          group={props.group}
          foreground={foreground}
          micaBase={props.micaBase}
          micaAlt={props.micaAlt}
          acrylic={props.acrylic}
          ownProjected={props.ownProjected}
        />
      </UI.Border>
    </LayoutGrid>
  )
}

function ColorSectionContent(props: {
  readonly groups: readonly ThemeColorGroupData[]
  readonly blackBrush: SolidColorBrush
  readonly micaBase: MicaBackdrop
  readonly micaAlt: MicaBackdrop
  readonly acrylic: DesktopAcrylicBackdrop
  readonly ownProjected: AppContext['ownProjected']
  readonly onCopy: (entry: ThemeColorEntry) => void
}) {
  return (
    <UI.StackPanel>
      {props.groups.map((group) => (
        <UI.StackPanel key={group.title} spacing={8}>
          <ColorGroupPreview
            group={group}
            blackBrush={props.blackBrush}
            micaBase={props.micaBase}
            micaAlt={props.micaAlt}
            acrylic={props.acrylic}
            ownProjected={props.ownProjected}
          />
          {group.grids.map((grid, index) => (
            <ThemeColorGrid
              key={`${group.title}-${index}`}
              grid={grid}
              blackBrush={props.blackBrush}
              micaBase={props.micaBase}
              micaAlt={props.micaAlt}
              acrylic={props.acrylic}
              onCopy={props.onCopy}
            />
          ))}
        </UI.StackPanel>
      ))}
    </UI.StackPanel>
  )
}

function HighContrastGrid(props: {
  readonly themes: readonly {
    readonly name: string
    readonly colors: readonly HighContrastEntry[]
  }[]
  readonly onCopy: (resource: string) => void
}) {
  return (
    <UI.StackPanel spacing={24}>
      <GuidanceText text="The default High Contrast themes use the same system brush names; Windows chooses the active colors from the selected OS theme." />
      {props.themes.map((palette) => (
        <UI.StackPanel key={palette.name} spacing={8}>
          <UI.TextBlock
            {...styles.heading({ level: 'subtitle' })}
            text={palette.name}
          />
          <UI.Border
            background={theme.solidBackground}
            borderBrush={theme.cardStroke}
            borderThickness={thickness(1)}
            cornerRadius={tokens.radius.overlay}
            padding={thickness(0)}
            horizontalAlignment={HorizontalAlignment.Stretch}
          >
            <LayoutGrid
              rowDefinitions={[
                gridLength.star(),
                gridLength.star(),
              ]}
              columnDefinitions={[
                gridLength.star(),
                gridLength.star(),
                gridLength.star(),
                gridLength.star(),
              ]}
              horizontalAlignment={HorizontalAlignment.Stretch}
            >
              {palette.colors.map((entry, index) => {
                const row = Math.floor(index / 4)
                const column = index % 4
                return (
                  <UI.Border
                    key={entry.resource}
                    gridRow={row}
                    gridColumn={column}
                    borderBrush={theme.cardStroke}
                    borderThickness={thickness(
                      column === 0 ? 0 : 1,
                      row === 0 ? 0 : 1,
                      0,
                      0,
                    )}
                    cornerRadius={{
                      topLeft:
                        row === 0 && column === 0 ? 8 : 0,
                      topRight:
                        row === 0 && column === 3 ? 8 : 0,
                      bottomRight:
                        row === 1 && column === 3 ? 8 : 0,
                      bottomLeft:
                        row === 1 && column === 0 ? 8 : 0,
                    }}
                  >
                    <LayoutGrid
                      minHeight={132}
                      padding={thickness(12)}
                      background={entry.background}
                      rowDefinitions={[
                        gridLength.auto(),
                        gridLength.auto(),
                        gridLength.star(),
                        gridLength.auto(),
                      ]}
                      columnDefinitions={[
                        gridLength.star(),
                        gridLength.auto(),
                      ]}
                      rowSpacing={6}
                      horizontalAlignment={HorizontalAlignment.Stretch}
                    >
                      <UI.TextBlock
                        {...styles.heading({
                          level: 'bodyStrong',
                        })}
                        foreground={entry.foreground}
                        isTextSelectionEnabled
                        text={entry.name}
                        textWrapping={TextWrapping.WrapWholeWords}
                      />
                      <ColorCopyButton
                        resource={entry.resource}
                        foreground={entry.foreground}
                        onCopy={() =>
                          props.onCopy(entry.resource)}
                      />
                      <UI.TextBlock
                        gridRow={1}
                        margin={thickness(0, -4, 0, 0)}
                        foreground={entry.foreground}
                        opacity={0.8}
                        text={entry.usage}
                        textWrapping={TextWrapping.WrapWholeWords}
                      />
                      <UI.TextBlock
                        gridRow={3}
                        gridColumnSpan={2}
                        foreground={entry.foreground}
                        isTextSelectionEnabled
                        text={entry.resource}
                        textWrapping={TextWrapping.Wrap}
                      />
                    </LayoutGrid>
                  </UI.Border>
                )
              })}
            </LayoutGrid>
          </UI.Border>
        </UI.StackPanel>
      ))}
    </UI.StackPanel>
  )
}

function HighContrastSection(props: {
  readonly createProjected: AppContext['createProjected']
  readonly onCopy: (resource: string) => void
}) {
  const themes = highContrastThemeDefinitions.map(
    (palette) => ({
      name: palette.name,
      colors: createHighContrastTheme(
        palette.colors,
        props.createProjected,
      ),
    }),
  )
  return (
    <HighContrastGrid
      themes={themes}
      onCopy={props.onCopy}
    />
  )
}

export function ColorPage(context: AppContext) {
  const selectedSection = signal(0)
  const blackBrush = createBrush(
    '#000000',
    context.createProjected,
  )
  const micaBase = context.createProjected(() => {
    const backdrop = new MicaBackdrop()
    backdrop.kind = MicaKind.Base
    return backdrop
  })
  const micaAlt = context.createProjected(() => {
    const backdrop = new MicaBackdrop()
    backdrop.kind = MicaKind.BaseAlt
    return backdrop
  })
  const acrylic = context.createProjected(
    () => new DesktopAcrylicBackdrop(),
  )
  const copyResource = (resource: string) => {
    copyResourceName(resource)
    context.model.recordInteraction()
  }
  const copyEntry = (entry: ThemeColorEntry) => {
    copyResource(entry.resource)
  }

  return (
    <Page
      title="Color"
      subtitle="Balanced color design creates clarity and aesthetic harmony."
      automationId="ColorPageHeading"
      pageId="color"
      model={context.model}
    >
      <GuidanceText text="The brushes below are part of WinUI 3 and can be referenced from any native property that accepts a Brush." />
      <UI.Border
        automationId="GalleryDesignColorSample"
        background={theme.controlFill}
        borderBrush={theme.cardStroke}
        borderThickness={thickness(1)}
        cornerRadius={tokens.radius.overlay}
        padding={thickness(16)}
      >
        <UI.TextBlock
          isTextSelectionEnabled
          text={'<UI.TextBlock text="..." foreground={theme.ref("TextFillColorPrimaryBrush")} />'}
          textWrapping={TextWrapping.Wrap}
        />
      </UI.Border>

      <GallerySelectorBar
        automationId="GalleryDesignColorSelector"
        selectedIndex={selectedSection}
        onSelectedIndexChange={(index) => {
          selectedSection.value = index
          context.model.recordInteraction()
        }}
      >
        {sections.map((section) => (
          <UI.SelectorBarItem key={section} text={section} />
        ))}
      </GallerySelectorBar>

      {standardSections.map((section, index) => (
        <Show
          key={section}
          when={computed(
            () => selectedSection.value === index,
          )}
        >
          <ColorSectionContent
            groups={colorSections[section]}
            blackBrush={blackBrush}
            micaBase={micaBase}
            micaAlt={micaAlt}
            acrylic={acrylic}
            ownProjected={context.ownProjected}
            onCopy={copyEntry}
          />
        </Show>
      ))}
      <Show
        when={computed(
          () => selectedSection.value === 5,
        )}
      >
        <HighContrastSection
          createProjected={context.createProjected}
          onCopy={copyResource}
        />
      </Show>
    </Page>
  )
}
