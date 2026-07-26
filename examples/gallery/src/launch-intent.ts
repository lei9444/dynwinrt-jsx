import {
  findGalleryPage,
  type GalleryRoute,
} from './gallery-data'

export interface GalleryLaunchIntent {
  readonly route: GalleryRoute
  readonly searchQuery: string
}

const categoryRoutes = new Set<GalleryRoute>([
  'home',
  'search',
  'category-basic-input',
  'category-collections',
  'category-date-time',
  'category-dialogs-flyouts',
  'category-status-info',
  'category-layout',
  'category-media',
  'category-motion',
  'category-windowing',
  'category-system',
  'category-shell',
  'category-menus-toolbars',
  'category-navigation',
  'category-scrolling',
  'category-text',
  'category-fundamentals',
  'category-design',
  'category-accessibility',
  'category-styles',
  'diagnostics',
  'settings',
])

export function isGalleryRoute(value: string): value is GalleryRoute {
  return categoryRoutes.has(value as GalleryRoute) ||
    findGalleryPage(value) !== undefined
}

export function parseGalleryLaunchIntent(
  arguments_: readonly string[],
): GalleryLaunchIntent | undefined {
  for (const argument of arguments_) {
    if (argument.startsWith('--gallery-route=')) {
      const route = argument.slice('--gallery-route='.length)
      if (isGalleryRoute(route)) {
        return { route, searchQuery: '' }
      }
    }
    if (argument.startsWith('--gallery-search=')) {
      let searchQuery: string
      try {
        searchQuery = decodeURIComponent(
          argument.slice('--gallery-search='.length),
        ).trim()
      }
      catch {
        continue
      }
      if (searchQuery) {
        return { route: 'search', searchQuery }
      }
    }
  }
  return undefined
}
