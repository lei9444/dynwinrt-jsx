import {
  createSymbolIcon,
  type RouteDefinition,
  type RouterNavigationViewGroupMetadata,
  type RouterNavigationViewRouteHandle,
  type RouterNavigationViewRouteMetadata,
} from 'dynwinrt-jsx'
import {
  Symbol,
  SymbolIcon,
} from '#winapp/bindings'
import type { AppContext } from '../gallery-ui'
import {
  findGalleryPage,
  type GalleryRoute,
} from '../gallery-data'
import { HomePage } from './home'
import { SearchPage } from './search'
import { DiagnosticsPage } from './diagnostics'
import { SettingsPage } from './settings'
import { createFrameworkRoutes } from './framework/routes'
import { createBasicInputRoutes } from './basic-input/routes'
import { createCollectionsRoutes } from './collections/routes'
import { createDateTimeRoutes } from './date-time/routes'
import { createDialogsFlyoutsRoutes } from './dialogs-flyouts/routes'
import { createStatusInfoRoutes } from './status-info/routes'
import { createLayoutRoutes } from './layout/routes'
import { createMediaRoutes } from './media/routes'
import { createMotionRoutes } from './motion/routes'
import { createWindowingRoutes } from './windowing/routes'
import { createSystemRoutes } from './system/routes'
import { createShellRoutes } from './shell/routes'
import { createMenusToolbarsRoutes } from './menus-toolbars/routes'
import { createNavigationRoutes } from './navigation/routes'
import { createScrollingRoutes } from './scrolling/routes'
import { createTextRoutes } from './text/routes'
import { createFundamentalsRoutes } from './fundamentals/routes'
import { createDesignRoutes } from './design/routes'
import { createAccessibilityRoutes } from './accessibility/routes'
import { createStylesRoutes } from './styles/routes'

export const galleryCategoryRouteIds =
  new Map<string, GalleryRoute>([
    ['Basic input', 'category-basic-input'],
    ['Collections', 'category-collections'],
    ['Date & time', 'category-date-time'],
    ['Dialogs & flyouts', 'category-dialogs-flyouts'],
    ['Status & info', 'category-status-info'],
    ['Layout', 'category-layout'],
    ['Media', 'category-media'],
    ['Motion', 'category-motion'],
    ['Windowing', 'category-windowing'],
    ['System', 'category-system'],
    ['Shell', 'category-shell'],
    ['Menus & toolbars', 'category-menus-toolbars'],
    ['Navigation', 'category-navigation'],
    ['Scrolling', 'category-scrolling'],
    ['Text', 'category-text'],
    ['Fundamentals', 'category-fundamentals'],
    ['Design', 'category-design'],
    ['Accessibility', 'category-accessibility'],
    ['Styles', 'category-styles'],
  ])

type GalleryNavigationIcon =
  InstanceType<typeof SymbolIcon>

export type GalleryRouteHandle =
  RouterNavigationViewRouteHandle<
    GalleryNavigationIcon
  >

interface GalleryCategoryNavigation {
  readonly label: string
  readonly name: string
  readonly order: number
  readonly symbol: Symbol
}

const galleryCategoryNavigation =
  new Map<GalleryRoute, GalleryCategoryNavigation>([
    ['category-fundamentals', {
      label: 'Fundamentals',
      name: 'Fundamentals',
      order: 20,
      symbol: Symbol.Library,
    }],
    ['category-design', {
      label: 'Design',
      name: 'Design',
      order: 30,
      symbol: Symbol.Highlight,
    }],
    ['category-accessibility', {
      label: 'Accessibility',
      name: 'Accessibility',
      order: 40,
      symbol: Symbol.Permissions,
    }],
    ['category-styles', {
      label: 'Styles',
      name: 'Styles',
      order: 50,
      symbol: Symbol.Highlight,
    }],
    ['category-basic-input', {
      label: 'Basic input',
      name: 'BasicInput',
      order: 70,
      symbol: Symbol.TouchPointer,
    }],
    ['category-collections', {
      label: 'Collections',
      name: 'Collections',
      order: 80,
      symbol: Symbol.Bullets,
    }],
    ['category-date-time', {
      label: 'Date & time',
      name: 'DateTime',
      order: 90,
      symbol: Symbol.Clock,
    }],
    ['category-dialogs-flyouts', {
      label: 'Dialogs & flyouts',
      name: 'DialogsFlyouts',
      order: 100,
      symbol: Symbol.OpenWith,
    }],
    ['category-layout', {
      label: 'Layout',
      name: 'Layout',
      order: 110,
      symbol: Symbol.Page,
    }],
    ['category-media', {
      label: 'Media',
      name: 'Media',
      order: 120,
      symbol: Symbol.Play,
    }],
    ['category-menus-toolbars', {
      label: 'Menus & toolbars',
      name: 'MenusToolbars',
      order: 130,
      symbol: Symbol.Bullets,
    }],
    ['category-motion', {
      label: 'Motion',
      name: 'Motion',
      order: 140,
      symbol: Symbol.Sync,
    }],
    ['category-windowing', {
      label: 'Windowing',
      name: 'Windowing',
      order: 150,
      symbol: Symbol.NewWindow,
    }],
    ['category-system', {
      label: 'System',
      name: 'System',
      order: 160,
      symbol: Symbol.Setting,
    }],
    ['category-navigation', {
      label: 'Navigation',
      name: 'Navigation',
      order: 170,
      symbol: Symbol.GlobalNavigationButton,
    }],
    ['category-scrolling', {
      label: 'Scrolling',
      name: 'Scrolling',
      order: 180,
      symbol: Symbol.Forward,
    }],
    ['category-shell', {
      label: 'Shell',
      name: 'Shell',
      order: 190,
      symbol: Symbol.Repair,
    }],
    ['category-text', {
      label: 'Text',
      name: 'Text',
      order: 200,
      symbol: Symbol.Font,
    }],
    ['category-status-info', {
      label: 'Status & info',
      name: 'StatusInfo',
      order: 210,
      symbol: Symbol.Flag,
    }],
  ])

const frameworkGroup:
RouterNavigationViewGroupMetadata<
  GalleryNavigationIcon
> = {
  id: 'category-Framework',
  label: 'Framework',
  order: 10,
  createIcon: () =>
    createSymbolIcon(SymbolIcon, Symbol.Document),
  automationId: 'GalleryFrameworkCategoryNavItem',
}

function routeNavigation(
  route: RouteDefinition,
): RouterNavigationViewRouteMetadata<
  GalleryNavigationIcon
> | undefined {
  if (route.id === 'home') {
    return {
      label: 'Home',
      order: 0,
      createIcon: () =>
        createSymbolIcon(SymbolIcon, Symbol.Home),
      automationId: 'GalleryHomeNavItem',
    }
  }
  if (route.id === 'diagnostics') {
    return {
      label: 'Diagnostics',
      placement: 'footer',
      createIcon: () =>
        createSymbolIcon(SymbolIcon, Symbol.Repair),
      automationId: 'GalleryDiagnosticsNavItem',
    }
  }
  const category =
    galleryCategoryNavigation.get(
      route.id as GalleryRoute,
    )
  if (category) {
    return {
      label: category.label,
      order: category.order,
      createIcon: () =>
        createSymbolIcon(
          SymbolIcon,
          category.symbol,
        ),
      automationId:
        `Gallery${category.name}CategoryNavItem`,
    }
  }
  const page = findGalleryPage(route.id)
  if (!page) {
    return undefined
  }
  return {
    label: page.title,
    automationId: `Gallery${page.id}NavItem`,
    ...(page.category === 'Framework'
      ? { group: frameworkGroup }
      : {}),
  }
}

function withNavigation(
  route: RouteDefinition,
): RouteDefinition<unknown, GalleryRouteHandle> {
  const navigation = routeNavigation(route)
  const {
    handle: _handle,
    children,
    ...definition
  } = route
  void _handle
  return {
    ...definition,
    ...(navigation
      ? { handle: { navigation } }
      : {}),
    ...(children
      ? {
          children:
            children.map(withNavigation),
        }
      : {}),
  }
}

export function createGalleryRoutes(
  context: AppContext,
): readonly RouteDefinition<
  unknown,
  GalleryRouteHandle
>[] {
  return [
    {
      id: 'home',
      path: '/',
      render: () => <HomePage {...context} />,
    },
    {
      id: 'search',
      path: '/search',
      parentId: 'home',
      render: () => <SearchPage {...context} />,
    },
    {
      id: 'diagnostics',
      path: '/diagnostics',
      parentId: 'home',
      render: () => <DiagnosticsPage {...context} />,
    },
    {
      id: 'settings',
      path: '/settings',
      parentId: 'home',
      render: () => <SettingsPage {...context} />,
    },
    ...createFrameworkRoutes(context),
    ...createBasicInputRoutes(context),
    ...createCollectionsRoutes(context),
    ...createDateTimeRoutes(context),
    ...createDialogsFlyoutsRoutes(context),
    ...createStatusInfoRoutes(context),
    ...createLayoutRoutes(context),
    ...createMediaRoutes(context),
    ...createMotionRoutes(context),
    ...createWindowingRoutes(context),
    ...createSystemRoutes(context),
    ...createShellRoutes(context),
    ...createMenusToolbarsRoutes(context),
    ...createNavigationRoutes(context),
    ...createScrollingRoutes(context),
    ...createTextRoutes(context),
    ...createFundamentalsRoutes(context),
    ...createDesignRoutes(context),
    ...createAccessibilityRoutes(context),
    ...createStylesRoutes(context),
  ].map(withNavigation)
}
