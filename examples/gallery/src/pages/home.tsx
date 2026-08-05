import {
  For,
  Show,
  color,
  computed,
  createCompositionFrameScheduler,
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
  CompositionTarget,
  HorizontalAlignment,
  Orientation,
  ScrollBarVisibility,
  ScrollMode,
  SolidColorBrush,
  Stretch,
  Symbol,
  SymbolIcon,
  TextWrapping,
  VerticalAlignment,
  Visibility,
} from '#winapp/bindings'
import {
  type AppContext,
  GallerySelectorBar,
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

export function HomePage(context: AppContext) {
  const scheduleFrame =
    createCompositionFrameScheduler(
      CompositionTarget,
    )
  const featureScroller =
    createScrollViewerController<ScrollViewerInstance>({
      sampling: 'frame',
      scheduleFrame,
    })
  const recentScroller =
    createScrollViewerController<ScrollViewerInstance>({
      sampling: 'frame',
      scheduleFrame,
    })
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
  const ratingImage = loadGalleryBitmap(
    'ControlImages/RatingControl.png',
    72,
  )
  const recentIcon = context.createProjected(
    () => new SymbolIcon(),
  )
  recentIcon.symbol = Symbol.Clock
  const favoritesIcon = context.createProjected(
    () => new SymbolIcon(),
  )
  favoritesIcon.symbol = Symbol.Favorite
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
      route: 'category-design',
      tone: 'critical',
      image: designImage,
    },
    {
      title: 'WinUI on GitHub',
      description: 'Explore the WinUI source code and repository.',
      symbol: Symbol.AllApps,
      route: 'iconography',
      tone: 'success',
      image: githubImage,
    },
    {
      title: 'Community Toolkit',
      description: 'A collection of helper functions, controls, and app services.',
      symbol: Symbol.ViewAll,
      route: 'info-bar',
      tone: 'caution',
      image: toolkitImage,
    },
    {
      title: 'Code samples',
      description: 'Find samples that demonstrate specific tasks, features, and APIs.',
      symbol: Symbol.Permissions,
      route: 'text-box',
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
          horizontalAlignment={HorizontalAlignment.Stretch}
        >
          <GallerySelectorBar
            automationId="GalleryHomeSelector"
            selectedIndex={selectedSection}
            onSelectedIndexChange={(index) => {
              selectedSection.value = index
            }}
            margin={thickness(36, 24, 0, 16)}
            horizontalAlignment={HorizontalAlignment.Center}
          >
            <UI.SelectorBarItem
              automationId="GalleryRecentSelector"
              icon={recentIcon}
              text="Recent"
            />
            <UI.SelectorBarItem
              automationId="GalleryFavoritesSelector"
              icon={favoritesIcon}
              text="Favorites"
            />
          </GallerySelectorBar>
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
                <UI.StackPanel
                  margin={thickness(24, 36)}
                  spacing={8}
                  horizontalAlignment={HorizontalAlignment.Center}
                >
                    <UI.Image
                      height={36}
                      source={ratingImage}
                    />
                    <UI.TextBlock
                      {...styles.heading({
                        level: 'bodyStrong',
                      })}
                      text="No favorites yet"
                    />
                    <UI.TextBlock
                      foreground={theme.secondaryText}
                      text="Favorite samples by clicking the star icon on the sample page."
                      textAlignment={1}
                      textWrapping={TextWrapping.Wrap}
                    />
                </UI.StackPanel>
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
