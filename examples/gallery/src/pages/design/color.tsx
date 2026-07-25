import {
  color,
  computed,
  createSolidColorBrush,
  gridLength,
  signal,
  styles,
  theme,
  thickness,
  tokens,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  Border,
  HorizontalAlignment,
  SolidColorBrush,
  TextWrapping,
  Visibility,
} from '#winapp/bindings'
import {
  type AppContext,
  GallerySelectorBar,
  LayoutGrid,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import {
  GuidanceText,
} from '../fundamentals/shared'

interface ThemeColorEntry {
  readonly id: string
  readonly name: string
  readonly resource: string
  readonly usage: string
  readonly value: string
}

interface HighContrastEntry {
  readonly name: string
  readonly value: string
  readonly brush: SolidColorBrush
}

const sections = [
  'Text',
  'Fill',
  'Stroke',
  'Background',
  'Signal',
  'High Contrast',
] as const

const textColors: readonly ThemeColorEntry[] = [
  {
    id: 'TextPrimary',
    name: 'Text / Primary',
    resource: 'TextFillColorPrimaryBrush',
    usage: 'Rest or hover',
    value: '#000000 (E4, 89.56%)',
  },
  {
    id: 'TextSecondary',
    name: 'Text / Secondary',
    resource: 'TextFillColorSecondaryBrush',
    usage: 'Secondary labels',
    value: '#000000 (9E, 61.86%)',
  },
  {
    id: 'TextTertiary',
    name: 'Text / Tertiary',
    resource: 'TextFillColorTertiaryBrush',
    usage: 'Pressed only; not accessible for body text',
    value: '#000000 (72, 44.58%)',
  },
  {
    id: 'TextDisabled',
    name: 'Text / Disabled',
    resource: 'TextFillColorDisabledBrush',
    usage: 'Disabled only',
    value: '#000000 (5C, 36.14%)',
  },
  {
    id: 'AccentTextPrimary',
    name: 'Accent Text / Primary',
    resource: 'AccentTextFillColorPrimaryBrush',
    usage: 'Links at rest or hover',
    value: 'Accent dark 2',
  },
  {
    id: 'TextOnAccentPrimary',
    name: 'Text on Accent / Primary',
    resource: 'TextOnAccentFillColorPrimaryBrush',
    usage: 'Text on accent controls and fills',
    value: '#FFFFFF (FF, 100%)',
  },
]

const fillColors: readonly ThemeColorEntry[] = [
  {
    id: 'ControlDefault',
    name: 'Control / Default',
    resource: 'ControlFillColorDefaultBrush',
    usage: 'Standard controls at rest',
    value: '#FFFFFF (B3, 70%)',
  },
  {
    id: 'ControlSecondary',
    name: 'Control / Secondary',
    resource: 'ControlFillColorSecondaryBrush',
    usage: 'Standard controls on hover',
    value: '#F9F9F9 (80, 50%)',
  },
  {
    id: 'ControlTertiary',
    name: 'Control / Tertiary',
    resource: 'ControlFillColorTertiaryBrush',
    usage: 'Standard controls when pressed',
    value: '#F9F9F9 (4D, 30%)',
  },
  {
    id: 'ControlInputActive',
    name: 'Control / Input Active',
    resource: 'ControlFillColorInputActiveBrush',
    usage: 'Active or focused text input',
    value: '#FFFFFF (FF, 100%)',
  },
  {
    id: 'SubtleSecondary',
    name: 'Subtle / Secondary',
    resource: 'SubtleFillColorSecondaryBrush',
    usage: 'List item hover',
    value: '#000000 (09, 3.73%)',
  },
  {
    id: 'AccentDefault',
    name: 'Accent / Default',
    resource: 'AccentFillColorDefaultBrush',
    usage: 'Accent controls at rest',
    value: 'Accent dark 1 (100%)',
  },
]

const strokeColors: readonly ThemeColorEntry[] = [
  {
    id: 'CardStroke',
    name: 'Card Stroke / Default',
    resource: 'CardStrokeColorDefaultBrush',
    usage: 'Card layers and strokes',
    value: '#000000 (0F, 5.78%)',
  },
  {
    id: 'ControlStroke',
    name: 'Control Stroke / Default',
    resource: 'ControlStrokeColorDefaultBrush',
    usage: 'Control elevation and pressed states',
    value: '#000000 (0F, 5.78%)',
  },
  {
    id: 'ControlStrokeSecondary',
    name: 'Control Stroke / Secondary',
    resource: 'ControlStrokeColorSecondaryBrush',
    usage: 'Control elevation gradients',
    value: '#000000 (29, 16.22%)',
  },
  {
    id: 'StrongStroke',
    name: 'Control Strong Stroke / Default',
    resource: 'ControlStrongStrokeColorDefaultBrush',
    usage: '3:1 control borders',
    value: '#000000 (72, 44.58%)',
  },
  {
    id: 'SurfaceStroke',
    name: 'Surface Stroke / Default',
    resource: 'SurfaceStrokeColorDefaultBrush',
    usage: 'Window and dialog borders',
    value: '#757575 (66, 40%)',
  },
  {
    id: 'DividerStroke',
    name: 'Divider Stroke / Default',
    resource: 'DividerStrokeColorDefaultBrush',
    usage: 'Content dividers and graphic lines',
    value: '#000000 (0F, 5.78%)',
  },
]

const backgroundColors: readonly ThemeColorEntry[] = [
  {
    id: 'CardBackground',
    name: 'Card Background / Default',
    resource: 'CardBackgroundFillColorDefaultBrush',
    usage: 'Cards on page and layer backgrounds',
    value: '#FFFFFF (B3, 70%)',
  },
  {
    id: 'SmokeBackground',
    name: 'Smoke / Default',
    resource: 'SmokeFillColorDefaultBrush',
    usage: 'Dims inaccessible content behind dialogs',
    value: '#000000 (4D, 30%)',
  },
  {
    id: 'LayerBackground',
    name: 'Layer / Default',
    resource: 'LayerFillColorDefaultBrush',
    usage: 'Content layer color',
    value: '#FFFFFF (80, 50%)',
  },
  {
    id: 'LayerAcrylic',
    name: 'Layer on Acrylic / Default',
    resource: 'LayerOnAcrylicFillColorDefaultBrush',
    usage: 'Content layer on acrylic',
    value: '#FFFFFF (40, 25%)',
  },
  {
    id: 'SolidBase',
    name: 'Solid Background / Base',
    resource: 'SolidBackgroundFillColorBaseBrush',
    usage: 'Bottom-most experience layer',
    value: '#F3F3F3 (FF, 100%)',
  },
  {
    id: 'AcrylicBase',
    name: 'Acrylic Background / Base',
    resource: 'AcrylicBackgroundFillColorDefaultBrush',
    usage: 'Acrylic background tint',
    value: 'Theme-dependent acrylic color',
  },
]

const signalColors: readonly ThemeColorEntry[] = [
  {
    id: 'Success',
    name: 'System / Success',
    resource: 'SystemFillColorSuccessBrush',
    usage: 'Success badges and status icons',
    value: '#6CCB5F',
  },
  {
    id: 'Caution',
    name: 'System / Caution',
    resource: 'SystemFillColorCautionBrush',
    usage: 'Caution badges and status icons',
    value: '#FCE100',
  },
  {
    id: 'Critical',
    name: 'System / Critical',
    resource: 'SystemFillColorCriticalBrush',
    usage: 'Critical badges and status icons',
    value: '#FF99A4',
  },
  {
    id: 'Attention',
    name: 'System / Attention',
    resource: 'SystemFillColorAttentionBrush',
    usage: 'Attention badges',
    value: '#60CDFF',
  },
  {
    id: 'Neutral',
    name: 'System / Neutral',
    resource: 'SystemFillColorNeutralBrush',
    usage: 'Neutral badges',
    value: 'Theme-dependent neutral',
  },
  {
    id: 'CriticalBackground',
    name: 'System / Critical Background',
    resource: 'SystemFillColorCriticalBackgroundBrush',
    usage: 'Critical InfoBar backgrounds',
    value: '#442726',
  },
]

function createHighContrastTheme(
  entries: readonly (readonly [string, string])[],
): readonly HighContrastEntry[] {
  return entries.map(([name, value]) => ({
    name,
    value,
    brush: createSolidColorBrush(
      SolidColorBrush,
      color(
        Number.parseInt(value.slice(1, 3), 16),
        Number.parseInt(value.slice(3, 5), 16),
        Number.parseInt(value.slice(5, 7), 16),
      ),
    ),
  }))
}

const highContrastThemeDefinitions = [
  {
    name: 'Aquatic',
    colors: [
      ['Window Text Color', '#FFFFFF'],
      ['Window Color', '#202020'],
      ['Highlight Color', '#8EE3F0'],
      ['Hotlight Color', '#75E9FC'],
    ],
  },
  {
    name: 'Desert',
    colors: [
      ['Window Text Color', '#3D3D3D'],
      ['Window Color', '#FFFAEF'],
      ['Highlight Color', '#903909'],
      ['Hotlight Color', '#1C5E75'],
    ],
  },
  {
    name: 'Dusk',
    colors: [
      ['Window Text Color', '#FFFFFF'],
      ['Window Color', '#2D3236'],
      ['Highlight Color', '#ABCFF2'],
      ['Hotlight Color', '#70EBDE'],
    ],
  },
  {
    name: 'Night Sky',
    colors: [
      ['Window Text Color', '#FFFFFF'],
      ['Window Color', '#000000'],
      ['Highlight Color', '#D6B4FD'],
      ['Hotlight Color', '#8080FF'],
    ],
  },
] as const

function ThemeColorTile(props: {
  readonly entry: ThemeColorEntry
  readonly onSelect: () => void
}) {
  return (
    <UI.Button
      automationId={`GalleryDesignColor${props.entry.id}`}
      padding={thickness(0)}
      horizontalContentAlignment={HorizontalAlignment.Stretch}
      onClick={props.onSelect}
    >
      <UI.StackPanel>
        <UI.Border
          height={72}
          background={theme.ref(props.entry.resource)}
          cornerRadius={{
            topLeft: 8,
            topRight: 8,
            bottomRight: 0,
            bottomLeft: 0,
          }}
        />
        <UI.StackPanel padding={thickness(12)} spacing={4}>
          <UI.TextBlock
            {...styles.heading({ level: 'bodyStrong' })}
            text={props.entry.name}
          />
          <UI.TextBlock
            foreground={theme.secondaryText}
            text={props.entry.resource}
            textWrapping={TextWrapping.Wrap}
          />
          <UI.TextBlock
            foreground={theme.secondaryText}
            text={props.entry.usage}
            textWrapping={TextWrapping.Wrap}
          />
          <UI.TextBlock
            foreground={theme.secondaryText}
            text={props.entry.value}
          />
        </UI.StackPanel>
      </UI.StackPanel>
    </UI.Button>
  )
}

function ThemeColorGrid(props: {
  readonly entries: readonly ThemeColorEntry[]
  readonly onSelect: (entry: ThemeColorEntry) => void
}) {
  return (
    <LayoutGrid
      rowDefinitions={Array.from(
        { length: Math.ceil(props.entries.length / 3) },
        () => gridLength.auto(),
      )}
      columnDefinitions={[
        gridLength.star(),
        gridLength.star(),
        gridLength.star(),
      ]}
      rowSpacing={12}
      columnSpacing={12}
    >
      {props.entries.map((entry, index) => (
        <UI.Border
          key={entry.id}
          {...styles.card({ surface: 'layer' })}
          gridRow={Math.floor(index / 3)}
          gridColumn={index % 3}
          padding={thickness(0)}
        >
          <ThemeColorTile
            entry={entry}
            onSelect={() => props.onSelect(entry)}
          />
        </UI.Border>
      ))}
    </LayoutGrid>
  )
}

function HighContrastGrid(props: {
  readonly themes: readonly {
    readonly name: string
    readonly colors: readonly HighContrastEntry[]
  }[]
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
          <LayoutGrid
            columnDefinitions={[
              gridLength.star(),
              gridLength.star(),
              gridLength.star(),
              gridLength.star(),
            ]}
            columnSpacing={8}
          >
            {palette.colors.map((entry, index) => (
              <UI.Border
                key={entry.name}
                {...styles.card({ surface: 'layer' })}
                gridColumn={index}
                padding={thickness(0)}
                cornerRadius={tokens.radius.card}
              >
                <UI.StackPanel spacing={4}>
                  <UI.Border
                    height={52}
                    background={entry.brush}
                    cornerRadius={{
                      topLeft: 8,
                      topRight: 8,
                      bottomRight: 0,
                      bottomLeft: 0,
                    }}
                  />
                  <UI.TextBlock
                    margin={thickness(10, 4, 10, 0)}
                    foreground={theme.primaryText}
                    text={entry.name}
                    textWrapping={TextWrapping.Wrap}
                  />
                  <UI.TextBlock
                    margin={thickness(10, 0, 10, 10)}
                    foreground={theme.primaryText}
                    text={entry.value}
                  />
                </UI.StackPanel>
              </UI.Border>
            ))}
          </LayoutGrid>
        </UI.StackPanel>
      ))}
    </UI.StackPanel>
  )
}

export function ColorPage(context: AppContext) {
  const selectedSection = signal(0)
  const selectedResource = signal(textColors[0]!.resource)
  const selectedName = signal(textColors[0]!.name)
  const selectedSurface: RefObject<Border> = { current: null }
  const nativeStatus = signal('Native theme brush is mounted.')
  const highContrastThemes = highContrastThemeDefinitions.map(
    (palette) => ({
      name: palette.name,
      colors: createHighContrastTheme(palette.colors),
    }),
  )
  const selectEntry = (entry: ThemeColorEntry) => {
    selectedResource.value = entry.resource
    selectedName.value = entry.name
    nativeStatus.value = selectedSurface.current?.background
      ? `Native brush applied: ${entry.resource}`
      : 'Native brush is missing.'
    context.model.recordInteraction()
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
      <SampleCard
        automationId="GalleryDesignColorSample"
        title="Reference a WinUI theme brush"
        description="Select any tile to apply that named ThemeResource to the native preview surface."
        code={`
<UI.TextBlock
  foreground={theme.ref('TextFillColorPrimaryBrush')}
  text="..."
/>
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryDesignColorStatus"
              text={computed(() =>
                `Selected color: ${selectedName.value}`,
              )}
            />
            <UI.TextBlock
              automationId="GalleryDesignColorNativeStatus"
              text={nativeStatus}
            />
          </UI.StackPanel>
        }
      >
        <UI.Border
          ref={selectedSurface}
          height={96}
          background={computed(() =>
            theme.ref(selectedResource.value),
          )}
          cornerRadius={tokens.radius.card}
        />
      </SampleCard>

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

      <UI.StackPanel
        visibility={computed(() =>
          selectedSection.value === 0
            ? Visibility.Visible
            : Visibility.Collapsed,
        )}
      >
        <ThemeColorGrid entries={textColors} onSelect={selectEntry} />
      </UI.StackPanel>
      <UI.StackPanel
        visibility={computed(() =>
          selectedSection.value === 1
            ? Visibility.Visible
            : Visibility.Collapsed,
        )}
      >
        <ThemeColorGrid entries={fillColors} onSelect={selectEntry} />
      </UI.StackPanel>
      <UI.StackPanel
        visibility={computed(() =>
          selectedSection.value === 2
            ? Visibility.Visible
            : Visibility.Collapsed,
        )}
      >
        <ThemeColorGrid entries={strokeColors} onSelect={selectEntry} />
      </UI.StackPanel>
      <UI.StackPanel
        visibility={computed(() =>
          selectedSection.value === 3
            ? Visibility.Visible
            : Visibility.Collapsed,
        )}
      >
        <ThemeColorGrid
          entries={backgroundColors}
          onSelect={selectEntry}
        />
      </UI.StackPanel>
      <UI.StackPanel
        visibility={computed(() =>
          selectedSection.value === 4
            ? Visibility.Visible
            : Visibility.Collapsed,
        )}
      >
        <ThemeColorGrid entries={signalColors} onSelect={selectEntry} />
      </UI.StackPanel>
      <UI.StackPanel
        visibility={computed(() =>
          selectedSection.value === 5
            ? Visibility.Visible
            : Visibility.Collapsed,
        )}
      >
        <HighContrastGrid themes={highContrastThemes} />
      </UI.StackPanel>
    </Page>
  )
}
