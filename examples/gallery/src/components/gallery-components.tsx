import {
  Show,
  computed,
  gridLength,
  signal,
  styles,
  theme,
  thickness,
  tokens,
  type Child,
  type MaybeSignal,
} from 'dynwinrt-jsx'
import {
  HorizontalAlignment,
  ScrollBarVisibility,
  Stretch,
  Symbol,
  TextWrapping,
  VerticalAlignment,
} from '#winapp/bindings'
import { LayoutGrid, UI } from '../gallery-ui'
import { loadGalleryBitmap, type BitmapImageInstance } from '../gallery-assets'
import type {
  GalleryPageId,
  GalleryPageInfo,
  GalleryRoute,
} from '../gallery-data'
import type { AppModel } from '../app-model'

export type StatusTone =
  | 'neutral'
  | 'attention'
  | 'success'
  | 'caution'
  | 'critical'

export function Card(props: {
  readonly children: Child
  readonly automationName?: string
}) {
  return (
    <UI.Border
      {...styles.card({ surface: 'layer' })}
      {...(props.automationName
        ? { automationName: props.automationName }
        : {})}
      padding={thickness(tokens.spacing.xl)}
    >
      {props.children}
    </UI.Border>
  )
}

export function CodeBlock(props: { readonly code: string }) {
  return (
    <UI.TextBox
      automationName="TypeScript JSX sample code"
      text={props.code.trim()}
      isReadOnly
      acceptsReturn
      textWrapping={TextWrapping.Wrap}
      minHeight={120}
      maxHeight={320}
    />
  )
}

export function SampleCard(props: {
  readonly title: string
  readonly description: string
  readonly code: string
  readonly children: Child
  readonly automationId?: string
}) {
  const sourceVisible = signal(false)
  return (
    <UI.StackPanel
      {...(props.automationId
        ? { automationId: props.automationId }
        : {})}
      automationName={props.title}
      spacing={tokens.spacing.md}
    >
      <UI.TextBlock
        {...styles.heading({ level: 'bodyStrong' })}
        automationHeadingLevel={3}
        text={props.title}
      />
      <UI.TextBlock
        foreground={theme.secondaryText}
        text={props.description}
        textWrapping={TextWrapping.Wrap}
      />
      <UI.Border
        {...styles.card({ surface: 'card' })}
        padding={thickness(tokens.spacing.lg)}
      >
        {props.children}
      </UI.Border>
      <UI.Button
        horizontalAlignment={HorizontalAlignment.Left}
        onClick={() => {
          sourceVisible.value = !sourceVisible.value
        }}
      >
        {computed(() =>
          sourceVisible.value ? 'Hide source code' : 'Show source code',
        )}
      </UI.Button>
      <Show when={sourceVisible}>
        <CodeBlock code={props.code} />
      </Show>
    </UI.StackPanel>
  )
}

export function Page(props: {
  readonly title: string
  readonly subtitle: MaybeSignal<string>
  readonly automationId: string
  readonly children: Child
  readonly onLoaded?: () => void
  readonly pageId?: GalleryPageId
  readonly model?: AppModel
}) {
  const isFavorite = computed(() =>
    props.pageId !== undefined &&
    props.model !== undefined &&
    props.model.favoritePageIds.value.includes(props.pageId),
  )
  return (
    <LayoutGrid
      rowDefinitions={[
        gridLength.auto(),
        gridLength.star(),
      ]}
    >
      <LayoutGrid
        padding={thickness(36, 24, 36, 0)}
        rowDefinitions={[
          gridLength.auto(),
          gridLength.auto(),
        ]}
        columnDefinitions={[
          gridLength.star(),
          gridLength.auto(),
        ]}
        rowSpacing={tokens.spacing.sm}
        columnSpacing={12}
        maxWidth={1112}
        horizontalAlignment={HorizontalAlignment.Stretch}
      >
        <UI.TextBlock
          {...styles.heading({ level: 'title' })}
          {...(props.onLoaded
            ? { onLoaded: props.onLoaded }
            : {})}
          automationId={props.automationId}
          automationName={props.title}
          automationHeadingLevel={1}
          text={props.title}
        />
        {props.pageId !== undefined &&
        props.model !== undefined ? (
          <UI.Button
            {...styles.button({ variant: 'subtle' })}
            gridColumn={1}
            gridRowSpan={2}
            automationId={`GalleryFavoriteButton-${props.pageId}`}
            automationName={computed(() =>
              isFavorite.value
                ? `Remove ${props.title} from favorites`
                : `Add ${props.title} to favorites`,
            )}
            verticalAlignment={VerticalAlignment.Top}
            onClick={() => {
              props.model?.toggleFavorite(props.pageId!)
            }}
          >
            <UI.SymbolIcon
              symbol={computed(() =>
                isFavorite.value
                  ? Symbol.Favorite
                  : Symbol.OutlineStar,
              )}
            />
          </UI.Button>
        ) : null}
        <UI.TextBlock
          {...styles.heading({
            level: 'body',
            tone: 'secondary',
          })}
          gridRow={1}
          text={props.subtitle}
          textWrapping={TextWrapping.Wrap}
        />
      </LayoutGrid>
      <UI.ScrollViewer
        gridRow={1}
        horizontalScrollBarVisibility={ScrollBarVisibility.Disabled}
        verticalScrollBarVisibility={ScrollBarVisibility.Auto}
      >
        <UI.StackPanel
          padding={thickness(36, 16, 36, 36)}
          spacing={tokens.spacing.xl}
          maxWidth={1112}
          horizontalAlignment={HorizontalAlignment.Stretch}
        >
          {props.children}
        </UI.StackPanel>
      </UI.ScrollViewer>
    </LayoutGrid>
  )
}

export function PageLink(props: {
  readonly page: GalleryPageInfo
  readonly model: AppModel
  readonly gridRow?: MaybeSignal<number>
  readonly gridColumn?: MaybeSignal<number>
  readonly width?: number
  readonly compact?: boolean
}) {
  const compact = props.compact ?? false
  const image = loadGalleryBitmap(
    props.page.image,
    compact ? 28 : 36,
  )
  return (
    <UI.Button
      automationName={`Open ${props.page.title}`}
      {...(props.gridRow === undefined
        ? {}
        : { gridRow: props.gridRow })}
      {...(props.gridColumn === undefined
        ? {}
        : { gridColumn: props.gridColumn })}
      horizontalContentAlignment={HorizontalAlignment.Stretch}
      {...(props.width === undefined
        ? {}
        : { width: props.width })}
      minHeight={compact ? 84 : 96}
      padding={thickness(compact ? 12 : 16)}
      onClick={() => {
        props.model.navigate(props.page.id as GalleryPageId)
      }}
    >
      <LayoutGrid
        columnDefinitions={[
          gridLength.pixel(compact ? 32 : 40),
          gridLength.star(),
        ]}
        rowDefinitions={[
          gridLength.auto(),
          gridLength.auto(),
        ]}
        columnSpacing={12}
      >
        <UI.Border
          gridRowSpan={2}
          width={compact ? 28 : 36}
          height={compact ? 28 : 36}
          verticalAlignment={VerticalAlignment.Top}
        >
          <UI.Image
            source={image}
            stretch={Stretch.Uniform}
            width={compact ? 28 : 36}
            height={compact ? 28 : 36}
          />
        </UI.Border>
        <UI.TextBlock
          {...styles.heading({ level: 'bodyStrong' })}
          gridColumn={1}
          text={props.page.title}
        />
        <UI.TextBlock
          gridRow={1}
          gridColumn={1}
          foreground={theme.secondaryText}
          text={props.page.subtitle}
          textWrapping={TextWrapping.Wrap}
        />
      </LayoutGrid>
    </UI.Button>
  )
}

export function HomeFeatureTile(props: {
  readonly title: string
  readonly description: string
  readonly symbol: Symbol
  readonly route: GalleryRoute
  readonly model: AppModel
  readonly tone: StatusTone
  readonly image?: MaybeSignal<BitmapImageInstance>
  readonly glyph?: string
}) {
  return (
    <UI.Border
      width={232}
      height={172}
      background={theme.ref('AcrylicBackgroundFillColorDefaultBrush')}
      cornerRadius={tokens.radius.card}
    >
      <UI.Button
        automationName={`Open ${props.title}`}
        width={232}
        height={172}
        padding={thickness(24)}
        background={theme.ref('SubtleFillColorTransparentBrush')}
        borderBrush={theme.ref('SurfaceStrokeColorFlyoutBrush')}
        borderThickness={thickness(1)}
        cornerRadius={tokens.radius.card}
        resourceOverrides={{
          ButtonBackgroundPointerOver: theme.ref(
            'SubtleFillColorSecondaryBrush',
          ),
          ButtonBackgroundPressed: theme.ref(
            'SubtleFillColorTertiaryBrush',
          ),
          ButtonBorderBrushPointerOver: theme.controlStrokeSecondary,
          ButtonBorderBrushPressed: theme.controlStroke,
        }}
        horizontalContentAlignment={HorizontalAlignment.Stretch}
        verticalContentAlignment={VerticalAlignment.Stretch}
        onClick={() => {
          props.model.navigate(props.route)
        }}
      >
        <LayoutGrid>
          <UI.FontIcon
            glyph={'\uE8A7'}
            fontSize={14}
            foreground={theme.secondaryText}
            margin={thickness(-12)}
            horizontalAlignment={HorizontalAlignment.Right}
            verticalAlignment={VerticalAlignment.Bottom}
          />
          <UI.StackPanel spacing={10}>
            {props.image ? (
              <UI.Image
                source={props.image}
                stretch={Stretch.Uniform}
                width={36}
                height={36}
                horizontalAlignment={HorizontalAlignment.Left}
              />
            ) : props.glyph ? (
              <UI.FontIcon
                glyph={props.glyph}
                fontSize={28}
                horizontalAlignment={HorizontalAlignment.Left}
              />
            ) : (
              <UI.Border
                {...styles.status({ tone: props.tone })}
                width={36}
                height={36}
                padding={thickness(8)}
                horizontalAlignment={HorizontalAlignment.Left}
              >
                <UI.SymbolIcon symbol={props.symbol} />
              </UI.Border>
            )}
            <UI.TextBlock
              {...styles.heading({ level: 'bodyStrong' })}
              text={props.title}
            />
            <UI.TextBlock
              foreground={theme.secondaryText}
              fontSize={12}
              text={props.description}
              textWrapping={TextWrapping.Wrap}
            />
          </UI.StackPanel>
        </LayoutGrid>
      </UI.Button>
    </UI.Border>
  )
}
