import {
  ErrorBoundary,
  computed,
  createNavigationItem,
  createSymbolIcon,
  createWinUIThemeController,
  gridLength,
  onCleanup,
  styles,
  theme,
  thickness,
  type Child,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  Application,
  ApplicationTheme,
  AutomationProperties,
  ElementTheme,
  HorizontalAlignment,
  ImageIconSource,
  NavigationViewBackButtonVisible,
  NavigationViewItem,
  NavigationViewPaneDisplayMode,
  PropertyValue,
  Symbol,
  SymbolIcon,
  TextBlock,
  TextWrapping,
  TitleBarTheme,
  VerticalAlignment,
} from '#winapp/bindings'
import {
  type AppContext,
  LayoutGrid,
  Navigation,
  type NavigationInstance,
  ThemeControllerContext,
  type TitleBarInstance,
  UI,
} from './gallery-ui'
import { loadGalleryBitmap } from './gallery-assets'
import {
  findGalleryPage,
  galleryPages,
  type GalleryPageId,
  type GalleryRoute,
} from './gallery-data'
import { HomePage } from './pages/home'
import { SearchPage } from './pages/search'
import { SignalsPage } from './pages/signals'
import { ButtonsPage } from './pages/buttons'
import { SelectionPage } from './pages/selection'
import { TextInputPage } from './pages/text-input'
import { RangeProgressPage } from './pages/range-progress'
import { ChoicesStatusPage } from './pages/choices-status'
import { CollectionsPage } from './pages/collections'
import { LayoutPage } from './pages/layout'
import { OverlaysPage } from './pages/overlays'
import { ResourcesPage } from './pages/resources'
import { IconsPage } from './pages/icons'
import { DiagnosticsPage } from './pages/diagnostics'
import { SettingsPage } from './pages/settings'

function renderSamplePage(
  context: AppContext,
  route: GalleryPageId,
): Child {
  switch (route) {
    case 'signals':
      return <SignalsPage {...context} />
    case 'buttons':
      return <ButtonsPage {...context} />
    case 'selection':
      return <SelectionPage {...context} />
    case 'text-input':
      return <TextInputPage {...context} />
    case 'range-progress':
      return <RangeProgressPage {...context} />
    case 'choices-status':
      return <ChoicesStatusPage {...context} />
    case 'collections':
      return <CollectionsPage {...context} />
    case 'layout':
      return <LayoutPage {...context} />
    case 'overlays':
      return <OverlaysPage {...context} />
    case 'resources':
      return <ResourcesPage {...context} />
    case 'icons':
      return <IconsPage {...context} />
  }
}

function renderRoute(
  context: AppContext,
  route: GalleryRoute,
): Child {
  switch (route) {
    case 'home':
      return <HomePage {...context} />
    case 'search':
      return <SearchPage {...context} />
    case 'diagnostics':
      return <DiagnosticsPage {...context} />
    case 'settings':
      return <SettingsPage {...context} />
    default:
      return renderSamplePage(context, route)
  }
}

export function Shell(context: AppContext) {
  const navigation: RefObject<NavigationInstance> = {
    current: null,
  }
  const titleBar: RefObject<TitleBarInstance> = {
    current: null,
  }
  const appIcon = new ImageIconSource()
  appIcon.imageSource = loadGalleryBitmap('GalleryAppIcon.png', 20)
  const themeController = createWinUIThemeController({
    isDark: context.model.darkTheme,
    setDark: context.model.setDarkTheme,
    application: Application.current,
    applicationTheme: ApplicationTheme,
    elementTheme: ElementTheme,
    titleBar: context.window.appWindow.titleBar,
    titleBarTheme: TitleBarTheme,
  })
  onCleanup(themeController.dispose)

  const itemBindings = {
    NavigationViewItem,
    TextBlock,
    AutomationProperties,
  }
  const homeItem = createNavigationItem(itemBindings, {
    name: 'home',
    label: 'Home',
    icon: createSymbolIcon(SymbolIcon, Symbol.Home),
    automationId: 'GalleryHomeNavItem',
  })
  const pageItems = new Map<GalleryPageId, NavigationViewItem>(
    galleryPages.map((page) => [
      page.id,
      createNavigationItem(itemBindings, {
        name: page.id,
        label: page.title,
        automationId: `Gallery${page.id}NavItem`,
      }),
    ]),
  )
  const createNavigationGroup = (
    name: string,
    label: string,
    symbol: Symbol,
    pageIds: readonly GalleryPageId[],
  ) => {
    const item = createNavigationItem(itemBindings, {
      name: `category-${name}`,
      label,
      icon: createSymbolIcon(SymbolIcon, symbol),
      selectsOnInvoked: false,
      automationId: `Gallery${name}CategoryNavItem`,
    })
    item.isExpanded = false
    if (pageIds.length === 0) {
      item.menuItems.append(createNavigationItem(itemBindings, {
        name: `placeholder-${name}`,
        label: 'Coming soon',
        selectsOnInvoked: false,
      }))
      return item
    }
    for (const pageId of pageIds) {
      item.menuItems.append(pageItems.get(pageId)!)
    }
    return item
  }
  const controlsHeader = createNavigationItem(itemBindings, {
    name: 'controls-header',
    label: 'Controls',
    selectsOnInvoked: false,
    automationId: 'GalleryControlsHeader',
  })
  const allItem = createNavigationItem(itemBindings, {
    name: 'all-controls',
    label: 'All',
    icon: createSymbolIcon(SymbolIcon, Symbol.AllApps),
    selectsOnInvoked: false,
    automationId: 'GalleryAllControlsNavItem',
  })
  const navigationItems = [
    homeItem,
    createNavigationGroup(
      'Fundamentals',
      'Fundamentals',
      Symbol.Library,
      ['signals'],
    ),
    createNavigationGroup(
      'Design',
      'Design',
      Symbol.Highlight,
      ['resources', 'icons'],
    ),
    createNavigationGroup(
      'Accessibility',
      'Accessibility',
      Symbol.Permissions,
      ['choices-status'],
    ),
    controlsHeader,
    allItem,
    createNavigationGroup(
      'BasicInput',
      'Basic input',
      Symbol.TouchPointer,
      ['buttons', 'selection', 'text-input', 'range-progress'],
    ),
    createNavigationGroup(
      'Collections',
      'Collections',
      Symbol.Bullets,
      ['collections'],
    ),
    createNavigationGroup(
      'DateTime',
      'Date & time',
      Symbol.Clock,
      [],
    ),
    createNavigationGroup(
      'DialogsFlyouts',
      'Dialogs & flyouts',
      Symbol.OpenWith,
      ['overlays'],
    ),
    createNavigationGroup(
      'Layout',
      'Layout',
      Symbol.Page,
      ['layout'],
    ),
    createNavigationGroup('Media', 'Media', Symbol.Play, []),
    createNavigationGroup(
      'MenusToolbars',
      'Menus & toolbars',
      Symbol.Bullets,
      [],
    ),
    createNavigationGroup('Motion', 'Motion', Symbol.Sync, []),
    createNavigationGroup(
      'Navigation',
      'Navigation',
      Symbol.GlobalNavigationButton,
      [],
    ),
    createNavigationGroup(
      'Scrolling',
      'Scrolling',
      Symbol.Forward,
      [],
    ),
    createNavigationGroup('Shell', 'Shell', Symbol.Repair, []),
    createNavigationGroup(
      'StatusInfo',
      'Status & info',
      Symbol.Flag,
      [],
    ),
  ]
  const diagnosticsItem = createNavigationItem(
    itemBindings,
    {
      name: 'diagnostics',
      label: 'Diagnostics',
      icon: createSymbolIcon(SymbolIcon, Symbol.Repair),
      automationId: 'GalleryDiagnosticsNavItem',
    },
  )
  const routeItems = new Map<GalleryRoute, NavigationViewItem>(
    [
      ['home', homeItem],
      ...galleryPages.map((page) => [
        page.id,
        pageItems.get(page.id)!,
      ] as const),
    ],
  )
  routeItems.set('diagnostics', diagnosticsItem)
  const selectedItem = computed(() => {
    if (context.model.route.value === 'settings') {
      return navigation.current?.settingsItem ?? null
    }
    return routeItems.get(context.model.route.value) ?? null
  })

  return (
    <ThemeControllerContext.Provider value={themeController}>
      <LayoutGrid
        rowDefinitions={[
          gridLength.auto(),
          gridLength.star(),
        ]}
      >
        <UI.TitleBar
          ref={titleBar}
          title="dynwinrt-jsx Gallery"
          iconSource={appIcon}
          isBackButtonVisible={computed(
            () => context.model.route.value !== 'home',
          )}
          isPaneToggleButtonVisible
          resourceOverrides={{
            TitleBarContentHorizontalAlignment:
              PropertyValue.createInt32(
                HorizontalAlignment.Stretch,
              ),
          }}
          onLoaded={() => {
            const current = titleBar.current
            if (current) {
              context.window.setTitleBar(current)
            }
          }}
          onBackRequested={() => {
            if (context.model.route.value === 'search') {
              context.model.setSearchQuery('')
              return
            }
            context.model.navigate('home')
          }}
          onPaneToggleRequested={() => {
            const current = navigation.current
            if (current) {
              current.isPaneOpen = !current.isPaneOpen
            }
          }}
        >
          <UI.AutoSuggestBox
            automationId="GallerySearchBox"
            placeholderText="Search controls and samples..."
            queryIcon={createSymbolIcon(SymbolIcon, Symbol.Find)}
            text={context.model.searchQuery}
            onTextChanged={(sender) => {
              context.model.setSearchQuery(sender.text)
            }}
            maxWidth={580}
            horizontalAlignment={HorizontalAlignment.Stretch}
            verticalAlignment={VerticalAlignment.Center}
          />
        </UI.TitleBar>
        <Navigation
          ref={navigation}
          gridRow={1}
          automationId="GalleryNavigation"
          requestedTheme={themeController.requestedTheme}
          paneDisplayMode={NavigationViewPaneDisplayMode.Auto}
          isBackButtonVisible={
            NavigationViewBackButtonVisible.Collapsed
          }
          isPaneToggleButtonVisible={false}
          alwaysShowHeader={false}
          menuItems={navigationItems}
          footerMenuItems={[diagnosticsItem]}
          selectedItem={selectedItem}
          isSettingsVisible
          onSelectionChanged={(_sender, args) => {
            if (args.isSettingsSelected) {
              context.model.navigate('settings')
              return
            }
            const selectedContainer =
              args.selectedItemContainer
            if (!selectedContainer) {
              return
            }
            const route =
              selectedContainer.name as GalleryRoute
            if (
              route === 'home' ||
              route === 'diagnostics' ||
              findGalleryPage(route)
            ) {
              context.model.navigate(route)
            }
          }}
        >
          <ErrorBoundary
            reset={computed(
              () =>
                `${context.model.route.value}:${context.model.hotVersion.value}`,
            )}
            fallback={(error, errorContext) => (
              <UI.StackPanel
                padding={thickness(36, 24)}
                spacing={12}
              >
                <UI.TextBlock
                  {...styles.heading({ level: 'subtitle' })}
                  text="Sample render failed"
                />
                <UI.TextBlock
                  text={`${errorContext.phase}: ${String(error)}`}
                  textWrapping={TextWrapping.Wrap}
                />
                <UI.TextBlock
                  foreground={theme.secondaryText}
                  text="Choose another sample from the navigation pane to continue."
                  textWrapping={TextWrapping.Wrap}
                />
              </UI.StackPanel>
            )}
          >
            {computed(() =>
              renderRoute(context, context.model.route.value),
            )}
          </ErrorBoundary>
        </Navigation>
      </LayoutGrid>
    </ThemeControllerContext.Provider>
  )
}
