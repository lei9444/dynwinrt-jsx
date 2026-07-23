import {
  batch,
  computed,
  createRoot,
  effect,
  signal,
  type Cleanup,
  type RendererDiagnostics,
  type Signal,
} from 'dynwinrt-jsx'
import {
  findGalleryPage,
  searchGalleryPages,
  type GalleryPageId,
  type GalleryRoute,
} from './gallery-data'
import type { AppState } from './app-state'

export type { AppState } from './app-state'
export type { GalleryRoute } from './gallery-data'

export interface AppModel {
  readonly status: Signal<AppState['status']>
  readonly route: Signal<GalleryRoute>
  readonly searchQuery: Signal<string>
  readonly recentPageIds: Signal<readonly GalleryPageId[]>
  readonly favoritePageIds: Signal<readonly GalleryPageId[]>
  readonly interactionCount: Signal<number>
  readonly darkTheme: Signal<boolean>
  readonly updatedAt: Signal<string | null>
  readonly persistenceError: Signal<string | null>
  readonly hotStatus: Signal<string>
  readonly hotVersion: Signal<number>
  readonly lastError: Signal<string | null>
  readonly diagnostics: Signal<RendererDiagnostics>
  readonly searchResults: ReturnType<
    typeof computed<ReturnType<typeof searchGalleryPages>>
  >
  readonly interactionText: ReturnType<typeof computed<string>>
  navigate(route: GalleryRoute): void
  toggleFavorite(pageId: GalleryPageId): void
  setSearchQuery(value: string): void
  recordInteraction(): void
  setDarkTheme(value: boolean): void
  snapshot(status?: AppState['status']): AppState
  dispose(): void
}

interface StateBridge {
  set(value: AppState): void
}

export function createAppModel(
  bridge: StateBridge,
  initialState: AppState,
): AppModel {
  return createRoot((dispose: Cleanup) => {
    const route = signal<GalleryRoute>('home')
    const searchQuery = signal('')
    const recentPageIds = signal<readonly GalleryPageId[]>(
      normalizePageIds(initialState.recentPageIds),
    )
    const favoritePageIds = signal<readonly GalleryPageId[]>(
      normalizePageIds(initialState.favoritePageIds),
    )
    const status = signal<AppState['status']>(
      initialState.status,
    )
    const interactionCount = signal(initialState.count)
    const darkTheme = signal(initialState.darkTheme)
    const updatedAt = signal(initialState.updatedAt)
    const persistenceError = signal(
      initialState.persistenceError,
    )
    const hotStatus = signal('ready')
    const hotVersion = signal(0)
    const lastError = signal<string | null>(null)
    const diagnostics = signal<RendererDiagnostics>({
      nativeCreated: 0,
      nativeDisposed: 0,
      activeNative: 0,
      componentsMounted: 0,
      componentsDisposed: 0,
      activeComponents: 0,
      listEntriesCreated: 0,
      listEntriesReused: 0,
    })
    const searchResults = computed(() =>
      searchGalleryPages(searchQuery.value),
    )
    const interactionText = computed(
      () => `${interactionCount.value} sample interactions`,
    )
    const snapshot = (
      nextStatus = status.value,
    ): AppState => ({
      version: 1,
      status: nextStatus,
      count: interactionCount.value,
      darkTheme: darkTheme.value,
      updatedAt: updatedAt.value,
      recentPageIds: recentPageIds.value,
      favoritePageIds: favoritePageIds.value,
      persistenceError: persistenceError.value,
    })
    effect(() => {
      bridge.set(snapshot())
    })

    const markChanged = () => {
      updatedAt.value = new Date().toISOString()
      persistenceError.value = null
    }

    return {
      status,
      route,
      searchQuery,
      recentPageIds,
      favoritePageIds,
      interactionCount,
      darkTheme,
      updatedAt,
      persistenceError,
      hotStatus,
      hotVersion,
      lastError,
      diagnostics,
      searchResults,
      interactionText,
      navigate(nextRoute) {
        const page = findGalleryPage(nextRoute)
        if (!page) {
          route.value = nextRoute
          return
        }
        const pageId = page.id as GalleryPageId
        batch(() => {
          route.value = nextRoute
          const nextRecent = [
            pageId,
            ...recentPageIds.value.filter(
              (value) => value !== pageId,
            ),
          ].slice(0, 8)
          if (
            nextRecent.length !== recentPageIds.value.length ||
            nextRecent.some(
              (value, index) =>
                value !== recentPageIds.value[index],
            )
          ) {
            recentPageIds.value = nextRecent
            markChanged()
          }
        })
      },
      toggleFavorite(pageId) {
        batch(() => {
          favoritePageIds.value =
            favoritePageIds.value.includes(pageId)
              ? favoritePageIds.value.filter(
                  (value) => value !== pageId,
                )
              : [...favoritePageIds.value, pageId]
          markChanged()
        })
      },
      setSearchQuery(value) {
        searchQuery.value = value
        if (value.trim()) {
          route.value = 'search'
        }
        else if (route.value === 'search') {
          route.value = 'home'
        }
      },
      recordInteraction() {
        batch(() => {
          interactionCount.value += 1
          markChanged()
        })
      },
      setDarkTheme(value) {
        if (darkTheme.value === value) {
          return
        }
        batch(() => {
          darkTheme.value = value
          markChanged()
        })
      },
      snapshot,
      dispose,
    }
  })
}

function normalizePageIds(
  values: readonly string[] | undefined,
): readonly GalleryPageId[] {
  const result: GalleryPageId[] = []
  for (const value of values ?? []) {
    const page = findGalleryPage(value)
    if (!page) {
      continue
    }
    const pageId = page.id as GalleryPageId
    if (!result.includes(pageId)) {
      result.push(pageId)
    }
  }
  return result
}
