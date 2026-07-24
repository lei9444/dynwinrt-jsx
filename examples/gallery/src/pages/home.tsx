import {
  For,
  Show,
  color,
  computed,
  createScrollViewerController,
  createSolidColorBrush,
  gridLength,
  signal,
  styles,
  theme,
  thickness,
  tokens,
  type Child,
  type MaybeSignal,
  type ReadonlySignal,
  type ScrollViewerController,
} from 'dynwinrt-jsx'
import {
  HorizontalAlignment,
  Orientation,
  ScrollBarVisibility,
  ScrollMode,
  SolidColorBrush,
  Stretch,
  Symbol,
  TextWrapping,
  VerticalAlignment,
  Visibility,
} from '#winapp/bindings'
import {
  type AppContext,
  LayoutGrid,
  type ScrollViewerInstance,
  UI,
} from '../gallery-ui'
import { loadGalleryBitmap, type BitmapImageInstance } from '../gallery-assets'
import {
  findGalleryPage,
  galleryPages,
  type GalleryPageInfo,
  type GalleryRoute,
} from '../gallery-data'
import {
  Card,
  HomeFeatureTile,
  PageLink,
  type StatusTone,
} from '../components/gallery-components'

function HomeHorizontalScroller(props: {
  readonly controller: ScrollViewerController<ScrollViewerInstance>
  readonly automationId: string
  readonly previousAutomationId: string
  readonly nextAutomationId: string
  readonly children: Child
}) {
  const buttonResources = {
    ButtonBackgroundPointerOver: theme.ref(
      'FlipViewNextPreviousButtonBackgroundPointerOver',
    ),
    ButtonBackgroundPressed: theme.ref(
      'FlipViewNextPreviousButtonBackgroundPressed',
    ),
    ButtonBorderBrushPointerOver: theme.ref(
      'FlipViewNextPreviousButtonBorderBrushPointerOver',
    ),
    ButtonBorderBrushPressed: theme.ref(
      'FlipViewNextPreviousButtonBorderBrushPressed',
    ),
    ButtonForegroundPointerOver: theme.ref(
      'FlipViewNextPreviousArrowForegroundPointerOver',
    ),
    ButtonForegroundPressed: theme.ref(
      'FlipViewNextPreviousArrowForegroundPressed',
    ),
  }
  return (
    <LayoutGrid>
      <UI.ScrollViewer
        ref={props.controller}
        automationId={props.automationId}
        horizontalScrollMode={ScrollMode.Enabled}
        horizontalScrollBarVisibility={ScrollBarVisibility.Hidden}
        verticalScrollBarVisibility={ScrollBarVisibility.Hidden}
        verticalScrollMode={ScrollMode.Disabled}
      >
        {props.children}
      </UI.ScrollViewer>
      <UI.Button
        automationId={props.previousAutomationId}
        automationName="Scroll left"
        visibility={computed(() =>
          props.controller.canScrollBackward.value
            ? Visibility.Visible
            : Visibility.Collapsed,
        )}
        width={16}
        height={38}
        margin={thickness(8, -16, 0, 0)}
        padding={thickness(0)}
        background={theme.ref(
          'FlipViewNextPreviousButtonBackground',
        )}
        borderBrush={theme.ref(
          'FlipViewNextPreviousButtonBorderBrush',
        )}
        borderThickness={thickness(1)}
        cornerRadius={tokens.radius.control}
        foreground={theme.ref('ButtonForeground')}
        resourceOverrides={buttonResources}
        horizontalAlignment={HorizontalAlignment.Left}
        verticalAlignment={VerticalAlignment.Center}
        onClick={() =>
          props.controller.scrollHorizontalByViewport(-1, true)}
      >
        <UI.FontIcon glyph={'\uEDD9'} fontSize={8} />
      </UI.Button>
      <UI.Button
        automationId={props.nextAutomationId}
        automationName="Scroll right"
        visibility={computed(() =>
          props.controller.canScrollForward.value
            ? Visibility.Visible
            : Visibility.Collapsed,
        )}
        width={16}
        height={38}
        margin={thickness(0, -16, 8, 0)}
        padding={thickness(0)}
        background={theme.ref(
          'FlipViewNextPreviousButtonBackground',
        )}
        borderBrush={theme.ref(
          'FlipViewNextPreviousButtonBorderBrush',
        )}
        borderThickness={thickness(1)}
        cornerRadius={tokens.radius.control}
        foreground={theme.ref('ButtonForeground')}
        resourceOverrides={buttonResources}
        horizontalAlignment={HorizontalAlignment.Right}
        verticalAlignment={VerticalAlignment.Center}
        onClick={() =>
          props.controller.scrollHorizontalByViewport(1, true)}
      >
        <UI.FontIcon glyph={'\uEDDA'} fontSize={8} />
      </UI.Button>
    </LayoutGrid>
  )
}

function HomeSectionButton(props: {
  readonly selected: ReadonlySignal<boolean>
  readonly automationId: string
  readonly symbol: Symbol
  readonly text: string
  readonly onClick: () => void
}) {
  const pointerOver = signal(false)
  const transparentBrush = createSolidColorBrush(
    SolidColorBrush,
    color(0, 0, 0, 0),
  )
  const background = computed(() => {
    if (props.selected.value) {
      return pointerOver.value
        ? theme.accentSecondary
        : theme.accent
    }
    return pointerOver.value
      ? theme.controlFillSecondary
      : theme.controlFill
  })
  const borderBrush = computed(() =>
    props.selected.value
      ? pointerOver.value
        ? theme.accentSecondary
        : theme.accent
      : theme.controlStroke,
  )
  const foreground = computed(() =>
    props.selected.value
      ? theme.textOnAccent
      : theme.primaryText,
  )
  const buttonResources = computed(() => ({
    ButtonBackgroundPointerOver: transparentBrush,
    ButtonBackgroundPressed: transparentBrush,
    ButtonBorderBrushPointerOver: transparentBrush,
    ButtonBorderBrushPressed: transparentBrush,
    ButtonForegroundPointerOver: props.selected.value
      ? theme.textOnAccent
      : theme.primaryText,
    ButtonForegroundPressed: props.selected.value
      ? theme.textOnAccent
      : theme.secondaryText,
  }))
  return (
    <UI.Border
      background={background}
      borderBrush={borderBrush}
      borderThickness={thickness(1)}
      cornerRadius={tokens.radius.control}
    >
      <UI.Button
        automationId={props.automationId}
        padding={thickness(23, 5, 23, 6)}
        background={transparentBrush}
        borderBrush={transparentBrush}
        borderThickness={thickness(0)}
        cornerRadius={tokens.radius.control}
        foreground={foreground}
        resourceOverrides={buttonResources}
        onPointerEntered={() => {
          pointerOver.value = true
        }}
        onPointerExited={() => {
          pointerOver.value = false
        }}
        onClick={props.onClick}
      >
        <UI.StackPanel
          orientation={Orientation.Horizontal}
          spacing={8}
        >
          <UI.SymbolIcon symbol={props.symbol} />
          <UI.TextBlock text={props.text} />
        </UI.StackPanel>
      </UI.Button>
    </UI.Border>
  )
}

export function HomePage(context: AppContext) {
  const featureScroller =
    createScrollViewerController<ScrollViewerInstance>()
  const recentScroller =
    createScrollViewerController<ScrollViewerInstance>()
  const selectedSection = signal(0)
  const recentSelected = computed(
    () => selectedSection.value === 0,
  )
  const favoritesSelected = computed(
    () => selectedSection.value === 1,
  )
  const recentPages = computed(() =>
    context.model.recentPageIds.value
      .map((id) => findGalleryPage(id))
      .filter(
        (page): page is GalleryPageInfo =>
          page !== undefined,
      ),
  )
  const favoritePages = computed(() =>
    context.model.favoritePageIds.value
      .map((id) => findGalleryPage(id))
      .filter(
        (page): page is GalleryPageInfo =>
          page !== undefined,
      ),
  )
  const recentlyAdded = [...galleryPages].slice(-6).reverse()
  const recentlyAddedRows = [
    gridLength.auto(),
    gridLength.auto(),
    gridLength.auto(),
  ]
  const winUIImage = loadGalleryBitmap('Header-WinUI.png', 96)
  const designImage = loadGalleryBitmap(
    'Header-WindowsDesign.png',
    96,
  )
  const toolkitImage = loadGalleryBitmap('Header-Toolkit.png', 96)
  const githubLight = loadGalleryBitmap('GitHub.light.png', 48)
  const githubDark = loadGalleryBitmap('GitHub.dark.png', 48)
  const githubImage = computed(() =>
    context.model.darkTheme.value ? githubDark : githubLight,
  )
  const storeLight = loadGalleryBitmap(
    'Header-Store.light.png',
    96,
  )
  const storeDark = loadGalleryBitmap(
    'Header-Store.dark.png',
    96,
  )
  const storeImage = computed(() =>
    context.model.darkTheme.value ? storeDark : storeLight,
  )
  const galleryHeaderImage = loadGalleryBitmap(
    'GalleryHeaderImage.png',
    1600,
  )
  const featureTiles = [
    {
      title: 'Getting started',
      description: 'Get started with WinUI and explore detailed documentation.',
      symbol: Symbol.Play,
      route: 'signals',
      tone: 'attention',
      image: winUIImage,
    },
    {
      title: 'Design',
      description: 'Guidelines and toolkits for creating stunning WinUI experiences.',
      symbol: Symbol.Highlight,
      route: 'resources',
      tone: 'critical',
      image: designImage,
    },
    {
      title: 'WinUI on GitHub',
      description: 'Explore the WinUI source code and repository.',
      symbol: Symbol.AllApps,
      route: 'icons',
      tone: 'success',
      image: githubImage,
    },
    {
      title: 'Community Toolkit',
      description: 'A collection of helper functions, controls, and app services.',
      symbol: Symbol.ViewAll,
      route: 'choices-status',
      tone: 'caution',
      image: toolkitImage,
    },
    {
      title: 'Code samples',
      description: 'Find samples that demonstrate specific tasks, features, and APIs.',
      symbol: Symbol.Permissions,
      route: 'text-input',
      tone: 'success',
      glyph: '\uE943',
    },
    {
      title: 'Partner Center',
      description: 'Upload your app to the Store.',
      symbol: Symbol.Edit,
      route: 'settings',
      tone: 'attention',
      image: storeImage,
    },
  ] as const satisfies readonly {
    readonly title: string
    readonly description: string
    readonly symbol: Symbol
    readonly route: GalleryRoute
    readonly tone: StatusTone
    readonly image?: MaybeSignal<BitmapImageInstance>
    readonly glyph?: string
  }[]
  const lightHeroBackground = createSolidColorBrush(
    SolidColorBrush,
    color(213, 219, 227),
  )
  const darkHeroBackground = createSolidColorBrush(
    SolidColorBrush,
    color(2, 11, 32),
  )
  const heroBackground = computed(() =>
    context.model.darkTheme.value
      ? darkHeroBackground
      : lightHeroBackground,
  )

  return (
    <UI.ScrollViewer
      horizontalScrollBarVisibility={ScrollBarVisibility.Disabled}
      verticalScrollBarVisibility={ScrollBarVisibility.Auto}
    >
      <UI.StackPanel
        padding={thickness(0, 0, 0, 36)}
        spacing={tokens.spacing.xl}
        horizontalAlignment={HorizontalAlignment.Stretch}
      >
        <UI.Border
          minHeight={400}
        >
          <LayoutGrid
            rowDefinitions={[
              gridLength.pixel(337),
              gridLength.pixel(63),
            ]}
          >
            <UI.Border background={heroBackground}>
              <LayoutGrid>
                <UI.Image
                  source={galleryHeaderImage}
                  stretch={Stretch.UniformToFill}
                  opacity={computed(() =>
                    context.model.darkTheme.value ? 0.8 : 0.9,
                  )}
                  height={500}
                  margin={thickness(0, -100, 0, 0)}
                  horizontalAlignment={HorizontalAlignment.Stretch}
                  verticalAlignment={VerticalAlignment.Top}
                />
                <UI.StackPanel
                  padding={thickness(36, 48, 36, 0)}
                  spacing={tokens.spacing.md}
                >
                  <UI.TextBlock
                    foreground={theme.secondaryText}
                    fontSize={18}
                    text="Windows App SDK 2.2 · Native TypeScript JSX"
                  />
                  <UI.TextBlock
                    {...styles.heading({ level: 'title' })}
                    automationId="GalleryHomeHeading"
                    automationName="dynwinrt-jsx Gallery"
                    automationHeadingLevel={1}
                    fontSize={40}
                    onLoaded={() => {
                      context.model.status.value = 'running'
                    }}
                    text="dynwinrt-jsx Gallery"
                  />
                </UI.StackPanel>
              </LayoutGrid>
            </UI.Border>
            <LayoutGrid
              gridRowSpan={2}
              verticalAlignment={VerticalAlignment.Bottom}
              margin={thickness(0, 0, 0, 23)}
            >
              <HomeHorizontalScroller
                controller={featureScroller}
                automationId="GalleryFeatureScroller"
                previousAutomationId="GalleryFeaturePrevious"
                nextAutomationId="GalleryFeatureNext"
              >
                <UI.StackPanel
                  orientation={Orientation.Horizontal}
                  spacing={12}
                  width={featureTiles.length * 244 - 12}
                  margin={thickness(36, 0)}
                >
                  {featureTiles.map((tile) => (
                    <HomeFeatureTile
                      key={tile.title}
                      {...tile}
                      model={context.model}
                    />
                  ))}
                </UI.StackPanel>
              </HomeHorizontalScroller>
            </LayoutGrid>
          </LayoutGrid>
        </UI.Border>
        <UI.StackPanel
          padding={thickness(36, 0, 36, 0)}
          spacing={tokens.spacing.xl}
          maxWidth={1112}
          horizontalAlignment={HorizontalAlignment.Stretch}
        >
          <UI.StackPanel
            orientation={Orientation.Horizontal}
            spacing={8}
            horizontalAlignment={HorizontalAlignment.Center}
          >
            <HomeSectionButton
              selected={recentSelected}
              automationId="GalleryRecentSelector"
              symbol={Symbol.Clock}
              text="Recent"
              onClick={() => {
                selectedSection.value = 0
              }}
            />
            <HomeSectionButton
              selected={favoritesSelected}
              automationId="GalleryFavoritesSelector"
              symbol={Symbol.Favorite}
              text="Favorites"
              onClick={() => {
                selectedSection.value = 1
              }}
            />
          </UI.StackPanel>
          <Show when={computed(
            () => selectedSection.value === 0,
          )}>
            <UI.StackPanel spacing={tokens.spacing.xl}>
              <Show when={computed(
                () => recentPages.value.length > 0,
              )}>
                <UI.StackPanel spacing={tokens.spacing.md}>
                  <UI.TextBlock
                    {...styles.heading({ level: 'subtitle' })}
                    automationHeadingLevel={2}
                    text="Recently visited"
                  />
                  <LayoutGrid
                    margin={thickness(-36, 0, -36, 12)}
                  >
                    <HomeHorizontalScroller
                      controller={recentScroller}
                      automationId="GalleryRecentScroller"
                      previousAutomationId="GalleryRecentPrevious"
                      nextAutomationId="GalleryRecentNext"
                    >
                      <UI.StackPanel
                        orientation={Orientation.Horizontal}
                        spacing={12}
                        margin={thickness(36, 0)}
                      >
                        <For
                          each={recentPages}
                          key={(page) => page.id}
                        >
                          {(page) => (
                            <PageLink
                              page={page}
                              model={context.model}
                              width={300}
                            />
                          )}
                        </For>
                      </UI.StackPanel>
                    </HomeHorizontalScroller>
                  </LayoutGrid>
                </UI.StackPanel>
              </Show>
              <UI.StackPanel spacing={tokens.spacing.md}>
                <UI.TextBlock
                  {...styles.heading({ level: 'subtitle' })}
                  automationHeadingLevel={2}
                  text="Recently added or updated"
                />
                <LayoutGrid
                  rowDefinitions={recentlyAddedRows}
                  columnDefinitions={[
                    gridLength.star(),
                    gridLength.star(),
                  ]}
                  rowSpacing={12}
                  columnSpacing={12}
                >
                  {recentlyAdded.map((page, index) => (
                    <PageLink
                      key={page.id}
                      page={page}
                      model={context.model}
                      gridRow={Math.floor(index / 2)}
                      gridColumn={index % 2}
                    />
                  ))}
                </LayoutGrid>
              </UI.StackPanel>
            </UI.StackPanel>
          </Show>
          <Show when={computed(
            () => selectedSection.value === 1,
          )}>
            <Show
              when={computed(
                () => favoritePages.value.length > 0,
              )}
              fallback={
                <Card>
                  <UI.StackPanel spacing={8}>
                    <UI.SymbolIcon
                      symbol={Symbol.OutlineStar}
                    />
                    <UI.TextBlock
                      {...styles.heading({
                        level: 'bodyStrong',
                      })}
                      text="No favorites yet"
                    />
                    <UI.TextBlock
                      foreground={theme.secondaryText}
                      text="Open a sample and use the star in its page header."
                      textWrapping={TextWrapping.Wrap}
                    />
                  </UI.StackPanel>
                </Card>
              }
            >
              <UI.StackPanel spacing={tokens.spacing.md}>
                <UI.TextBlock
                  {...styles.heading({ level: 'subtitle' })}
                  automationHeadingLevel={2}
                  text="Favorite samples"
                />
                <UI.ScrollViewer
                  horizontalScrollBarVisibility={
                    ScrollBarVisibility.Auto
                  }
                  verticalScrollBarVisibility={
                    ScrollBarVisibility.Disabled
                  }
                >
                  <UI.StackPanel
                    orientation={Orientation.Horizontal}
                    spacing={12}
                  >
                    <For
                      each={favoritePages}
                      key={(page) => page.id}
                    >
                      {(page) => (
                        <PageLink
                          page={page}
                          model={context.model}
                          width={300}
                        />
                      )}
                    </For>
                  </UI.StackPanel>
                </UI.ScrollViewer>
              </UI.StackPanel>
            </Show>
          </Show>
          <UI.TextBlock
            foreground={theme.secondaryText}
            text={context.model.interactionText}
          />
        </UI.StackPanel>
      </UI.StackPanel>
    </UI.ScrollViewer>
  )
}
