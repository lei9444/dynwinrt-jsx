import {
  computed,
  createFontFamily,
  gridLength,
  signal,
  styles,
  theme,
  thickness,
  tokens,
  type Child,
  type MaybeSignal,
  type RefObject,
  type ReadonlySignal,
} from 'dynwinrt-jsx'
import {
  Clipboard,
  DataPackage,
  FontFamily,
  Grid,
  HorizontalAlignment,
  Orientation,
  ScrollBarVisibility,
  ScrollMode,
  Stretch,
  Symbol,
  TextWrapping,
  VerticalAlignment,
} from '#winapp/bindings'
import {
  LayoutGrid,
  type ScrollViewerInstance,
  UI,
} from '../gallery-ui'
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

export function CodeBlock(props: {
  readonly code: string
  readonly automationId?: string
  readonly copyAutomationId?: string
  readonly copied: ReadonlySignal<boolean>
  readonly onCopy: () => void
}) {
  const codeFont = createFontFamily(
    FontFamily,
    'Cascadia Code, Consolas',
  )
  return (
    <LayoutGrid>
      <UI.ScrollViewer
        {...(props.automationId
          ? { automationId: props.automationId }
          : {})}
        automationName="TypeScript JSX sample code"
        horizontalScrollBarVisibility={ScrollBarVisibility.Auto}
        horizontalScrollMode={ScrollMode.Auto}
        verticalScrollBarVisibility={ScrollBarVisibility.Auto}
        verticalScrollMode={ScrollMode.Auto}
        maxHeight={320}
      >
        <UI.TextBlock
          padding={thickness(16, 16, 56, 16)}
          fontFamily={codeFont}
          isTextSelectionEnabled
          text={props.code.trim()}
          textWrapping={TextWrapping.NoWrap}
        />
      </UI.ScrollViewer>
      <UI.Button
        {...(props.copyAutomationId
          ? { automationId: props.copyAutomationId }
          : {})}
        automationName={computed(() =>
          props.copied.value
            ? 'Copied TypeScript JSX code'
            : 'Copy TypeScript JSX code',
        )}
        width={32}
        height={32}
        minWidth={0}
        minHeight={0}
        margin={thickness(0, 8, 8, 0)}
        padding={thickness(6)}
        horizontalAlignment={HorizontalAlignment.Right}
        verticalAlignment={VerticalAlignment.Top}
        background={theme.ref(
          'ControlOnImageFillColorDefaultBrush',
        )}
        borderBrush={theme.controlStroke}
        borderThickness={thickness(1)}
        cornerRadius={tokens.radius.control}
        onClick={props.onCopy}
      >
        <UI.FontIcon
          fontSize={16}
          glyph={computed(() =>
            props.copied.value ? '\uE73E' : '\uE8C8',
          )}
        />
      </UI.Button>
    </LayoutGrid>
  )
}

export function SampleCard(props: {
  readonly title: string
  readonly description: string
  readonly code: string
  readonly children: Child
  readonly output?: Child
  readonly options?: Child
  readonly automationId?: string
}) {
  const copied = signal(false)
  const sourceCode = props.code.trim()
  const sourceToggleAutomationId = props.automationId
    ? `${props.automationId}SourceToggle`
    : undefined
  const copyAutomationId = props.automationId
    ? `${props.automationId}Copy`
    : undefined
  const sourceCodeAutomationId = props.automationId
    ? `${props.automationId}SourceCode`
    : undefined
  const topCornerRadius = {
    topLeft: 8,
    topRight: 8,
    bottomRight: 0,
    bottomLeft: 0,
  }
  const bottomCornerRadius = {
    topLeft: 0,
    topRight: 0,
    bottomRight: 8,
    bottomLeft: 8,
  }
  const optionsCornerRadius = {
    topLeft: 0,
    topRight: 8,
    bottomRight: 0,
    bottomLeft: 0,
  }
  const hasOutput = props.output !== undefined
  const hasOptions = props.options !== undefined
  const outputColumn = 1
  const optionsColumn = hasOutput ? 2 : 1
  const exampleColumns = [
    gridLength.star(),
    ...(hasOutput
      ? [{ size: gridLength.auto(), max: 320 }]
      : []),
    ...(hasOptions
      ? [{ size: gridLength.auto(), max: 320 }]
      : []),
  ]

  const copySource = () => {
    const data = new DataPackage()
    data.setText(sourceCode)
    Clipboard.setContent(data)
    Clipboard.flush()
    copied.value = true
  }

  return (
    <UI.StackPanel
      {...(props.automationId
        ? { automationId: props.automationId }
        : {})}
      automationName={props.title}
      spacing={tokens.spacing.md}
      horizontalAlignment={HorizontalAlignment.Stretch}
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
        padding={thickness(0)}
      >
        <UI.StackPanel>
          <UI.Border
            background={theme.solidBackground}
            cornerRadius={topCornerRadius}
          >
            <LayoutGrid
              columnDefinitions={exampleColumns}
              horizontalAlignment={HorizontalAlignment.Stretch}
            >
              <UI.Border padding={thickness(12)}>
                {props.children}
              </UI.Border>
              {hasOutput ? (
                <UI.StackPanel
                  gridColumn={outputColumn}
                  margin={thickness(0, 12, 12, 12)}
                  padding={thickness(16)}
                  spacing={4}
                  background={theme.solidBackground}
                  cornerRadius={tokens.radius.card}
                  horizontalAlignment={HorizontalAlignment.Right}
                >
                  <UI.TextBlock text="Output:" />
                  {props.output}
                </UI.StackPanel>
              ) : null}
              {hasOptions ? (
                <UI.Border
                  gridColumn={optionsColumn}
                  padding={thickness(16)}
                  background={theme.cardBackground}
                  borderBrush={theme.dividerStroke}
                  borderThickness={thickness(1, 0, 0, 0)}
                  cornerRadius={optionsCornerRadius}
                >
                  {props.options}
                </UI.Border>
              ) : null}
            </LayoutGrid>
          </UI.Border>
          <UI.Expander
            {...(sourceToggleAutomationId
              ? { automationId: sourceToggleAutomationId }
              : {})}
            header="Source code"
            padding={thickness(0)}
            horizontalAlignment={HorizontalAlignment.Stretch}
            horizontalContentAlignment={HorizontalAlignment.Stretch}
            background={theme.ref(
              'CardBackgroundFillColorSecondaryBrush',
            )}
            cornerRadius={bottomCornerRadius}
            onCollapsed={() => {
              copied.value = false
            }}
          >
            <CodeBlock
              code={sourceCode}
              copied={copied}
              onCopy={copySource}
              {...(copyAutomationId
                ? { copyAutomationId }
                : {})}
              {...(sourceCodeAutomationId
                ? { automationId: sourceCodeAutomationId }
                : {})}
            />
          </UI.Expander>
        </UI.StackPanel>
      </UI.Border>
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
  const scrollViewer: RefObject<ScrollViewerInstance> = {
    current: null,
  }
  const contentWidth = signal(1100)
  const pageLinkCopied = signal(false)
  const updateContentWidth = () => {
    const width = scrollViewer.current?.actualWidth
    if (width !== undefined && width > 0) {
      contentWidth.value = Math.min(width, 1100)
    }
  }
  const isFavorite = computed(() =>
    props.pageId !== undefined &&
    props.model !== undefined &&
    props.model.favoritePageIds.value.includes(props.pageId),
  )
  const copyPageLink = () => {
    if (props.pageId === undefined) {
      return
    }
    const data = new DataPackage()
    data.setText(
      `dynwinrt-jsx-gallery://item/${props.pageId}`,
    )
    Clipboard.setContent(data)
    Clipboard.flush()
    pageLinkCopied.value = true
  }
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
        width={contentWidth}
        horizontalAlignment={HorizontalAlignment.Left}
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
          <UI.StackPanel
            gridColumn={1}
            gridRow={1}
            orientation={Orientation.Horizontal}
            spacing={4}
            verticalAlignment={VerticalAlignment.Center}
          >
            <UI.Button
              automationId={`GalleryThemeButton-${props.pageId}`}
              automationName={computed(() =>
                props.model!.darkTheme.value
                  ? 'Switch to light theme'
                  : 'Switch to dark theme',
              )}
              width={32}
              height={32}
              minWidth={0}
              minHeight={0}
              padding={thickness(6)}
              onClick={() => {
                props.model?.setDarkTheme(
                  !props.model.darkTheme.value,
                )
              }}
            >
              <UI.FontIcon fontSize={16} glyph={'\uE793'} />
            </UI.Button>
            <UI.Border
              width={1}
              height={24}
              margin={thickness(2, 4)}
              background={theme.dividerStroke}
            />
            <UI.Button
              automationId={`GalleryCopyLinkButton-${props.pageId}`}
              automationName={computed(() =>
                pageLinkCopied.value
                  ? 'Page link copied'
                  : 'Copy page link',
              )}
              width={32}
              height={32}
              minWidth={0}
              minHeight={0}
              padding={thickness(6)}
              onClick={copyPageLink}
            >
              <UI.FontIcon
                fontSize={16}
                glyph={computed(() =>
                  pageLinkCopied.value
                    ? '\uE73E'
                    : '\uE71B',
                )}
              />
            </UI.Button>
            <UI.ToggleButton
              automationId={`GalleryFavoriteButton-${props.pageId}`}
              automationName={computed(() =>
                isFavorite.value
                  ? `Remove ${props.title} from favorites`
                  : `Add ${props.title} to favorites`,
              )}
              isChecked={isFavorite}
              width={32}
              height={32}
              minWidth={0}
              minHeight={0}
              padding={thickness(6)}
              onClick={() => {
                props.model?.toggleFavorite(props.pageId!)
              }}
            >
              <UI.FontIcon
                fontSize={16}
                glyph={computed(() =>
                  isFavorite.value ? '\uE735' : '\uE734',
                )}
              />
            </UI.ToggleButton>
          </UI.StackPanel>
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
        ref={scrollViewer}
        gridRow={1}
        horizontalScrollBarVisibility={ScrollBarVisibility.Disabled}
        verticalScrollBarVisibility={ScrollBarVisibility.Auto}
        onLoaded={updateContentWidth}
        onSizeChanged={updateContentWidth}
      >
        <UI.StackPanel
          padding={thickness(36, 16, 36, 36)}
          spacing={tokens.spacing.xl}
          width={contentWidth}
          horizontalAlignment={HorizontalAlignment.Left}
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
  readonly height?: MaybeSignal<number>
  readonly compact?: boolean
}) {
  const compact = props.compact ?? false
  const image = loadGalleryBitmap(
    props.page.image,
    compact ? 28 : 36,
  )
  return (
    <UI.Button
      automationId={`GalleryOpenPage-${props.page.id}`}
      automationName={`Open ${props.page.title}`}
      {...(props.gridRow === undefined
        ? {}
        : { gridRow: props.gridRow })}
      {...(props.gridColumn === undefined
        ? {}
        : { gridColumn: props.gridColumn })}
      horizontalContentAlignment={HorizontalAlignment.Stretch}
      horizontalAlignment={
        props.width === undefined
          ? HorizontalAlignment.Stretch
          : HorizontalAlignment.Left
      }
      {...(props.width === undefined
        ? {}
        : { width: props.width })}
      height={props.height ?? (compact ? 84 : 96)}
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

export function CategoryPage(props: {
  readonly title: string
  readonly subtitle: string
  readonly automationId: string
  readonly pages: readonly GalleryPageInfo[]
  readonly model: AppModel
}) {
  const layout: RefObject<InstanceType<typeof Grid>> = {
    current: null,
  }
  const columnCount = signal(2)
  const updateColumns = () => {
    const width = layout.current?.actualWidth
    if (width === undefined || width <= 0) {
      return
    }
    const next = width >= 960 ? 3 : width >= 640 ? 2 : 1
    if (next !== columnCount.value) {
      columnCount.value = next
    }
  }
  const columns = computed(() =>
    Array.from(
      { length: columnCount.value },
      () => gridLength.star(),
    ),
  )
  const rows = computed(() =>
    Array.from(
      {
        length: Math.ceil(
          props.pages.length / columnCount.value,
        ),
      },
      () => gridLength.auto(),
    ),
  )

  return (
    <Page
      title={props.title}
      subtitle={props.subtitle}
      automationId={props.automationId}
    >
      <LayoutGrid
        ref={layout}
        columnDefinitions={columns}
        rowDefinitions={rows}
        rowSpacing={12}
        columnSpacing={12}
        onLoaded={updateColumns}
        onSizeChanged={updateColumns}
      >
        {props.pages.map((page, index) => (
          <PageLink
            key={page.id}
            page={page}
            model={props.model}
            height={computed(() =>
              columnCount.value === 1 ? 120 : 96,
            )}
            gridRow={computed(() =>
              Math.floor(index / columnCount.value),
            )}
            gridColumn={computed(() =>
              index % columnCount.value,
            )}
          />
        ))}
      </LayoutGrid>
    </Page>
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
