import {
  batch,
  computed,
  createRoot,
  effect,
  signal,
  type Cleanup,
  type RendererInspectionSnapshot,
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
import { isGalleryRoute } from './launch-intent'

export type { AppState } from './app-state'
export type { GalleryRoute } from './gallery-data'

export interface GalleryInspectorSummary {
  readonly nodes: number
  readonly scopes: number
  readonly observers: number
  readonly dependencies: number
  readonly subscriptions: number
  readonly cleanupFailures: number
  readonly operations: readonly string[]
}

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
  readonly heartbeatStatus: Signal<
    'starting' | 'connected' | 'timedOut' | 'disabled'
  >
  readonly heartbeatSequence: Signal<number>
  readonly heartbeatSentAt: Signal<string | null>
  readonly heartbeatAcknowledgedAt: Signal<string | null>
  readonly heartbeatTimeoutAt: Signal<string | null>
  readonly inspectorSummary: Signal<GalleryInspectorSummary>
  readonly inspectorExportStatus: Signal<string>
  readonly searchResults: ReturnType<
    typeof computed<ReturnType<typeof searchGalleryPages>>
  >
  readonly interactionText: ReturnType<typeof computed<string>>
  navigate(route: GalleryRoute): void
  toggleFavorite(pageId: GalleryPageId): void
  setSearchQuery(value: string): void
  recordInteraction(): void
  setDarkTheme(value: boolean): void
  updateInspection(snapshot: RendererInspectionSnapshot): void
  heartbeatSent(
    sequence: number,
    sentAt: number,
    snapshot: RendererInspectionSnapshot,
  ): void
  heartbeatAcknowledged(
    sequence: number,
    receivedAt: number,
    recovered: boolean,
  ): void
  heartbeatTimedOut(detectedAt: number): void
  heartbeatDisabled(): void
  inspectorExported(path: string): void
  inspectorExportFailed(message: string): void
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
    const initialRoute = initialState.route &&
      isGalleryRoute(initialState.route)
      ? initialState.route
      : 'home'
    const initialSearchQuery = initialState.searchQuery ?? ''
    const route = signal<GalleryRoute>(initialRoute)
    const searchQuery = signal(initialSearchQuery)
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
    const heartbeatStatus =
      signal<AppModel['heartbeatStatus']['value']>('starting')
    const heartbeatSequence = signal(0)
    const heartbeatSentAt = signal<string | null>(null)
    const heartbeatAcknowledgedAt =
      signal<string | null>(null)
    let lastAcknowledgedSequence = 0
    const heartbeatTimeoutAt = signal<string | null>(null)
    const inspectorSummary = signal<GalleryInspectorSummary>({
      nodes: 0,
      scopes: 0,
      observers: 0,
      dependencies: 0,
      subscriptions: 0,
      cleanupFailures: 0,
      operations: [],
    })
    const inspectorExportStatus = signal('Not exported.')
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
      route: route.value,
      searchQuery: searchQuery.value,
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
      heartbeatStatus,
      heartbeatSequence,
      heartbeatSentAt,
      heartbeatAcknowledgedAt,
      heartbeatTimeoutAt,
      inspectorSummary,
      inspectorExportStatus,
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
      updateInspection(inspection) {
        diagnostics.value = inspection.diagnostics
        inspectorSummary.value = {
          nodes: inspection.nodes.length,
          scopes: inspection.reactive.scopes.length,
          observers: inspection.reactive.observers.length,
          dependencies:
            inspection.reactive.dependencies.length,
          subscriptions: inspection.subscriptions.length,
          cleanupFailures: inspection.subscriptions.filter(
            (subscription) =>
              subscription.status === 'cleanupFailed',
          ).length,
          operations: inspection.operations
            .slice(-12)
            .map((operation) => {
              const detail = [
                operation.target,
                operation.property ?? operation.name,
              ].filter(Boolean).join('.')
              return `${operation.sequence}. ${operation.kind}${
                detail ? ` · ${detail}` : ''
              }`
            }),
        }
      },
      heartbeatSent(sequence, sentAt, inspection) {
        heartbeatSequence.value = sequence
        heartbeatSentAt.value =
          new Date(sentAt).toISOString()
        this.updateInspection(inspection)
      },
      heartbeatAcknowledged(
        sequence,
        receivedAt,
        _recovered,
      ) {
        if (sequence <= lastAcknowledgedSequence) {
          return
        }
        lastAcknowledgedSequence = sequence
        heartbeatStatus.value = 'connected'
        heartbeatAcknowledgedAt.value =
          new Date(receivedAt).toISOString()
      },
      heartbeatTimedOut(detectedAt) {
        heartbeatStatus.value = 'timedOut'
        heartbeatTimeoutAt.value =
          new Date(detectedAt).toISOString()
      },
      heartbeatDisabled() {
        heartbeatStatus.value = 'disabled'
      },
      inspectorExported(path) {
        inspectorExportStatus.value =
          `Exported to ${path}`
      },
      inspectorExportFailed(message) {
        inspectorExportStatus.value =
          `Export failed: ${message}`
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
    const normalizedValue =
      value === 'buttons'
        ? 'button'
        : value === 'collections'
          ? 'items-repeater'
          : value === 'overlays'
            ? 'content-dialog'
            : value === 'range-progress'
              ? 'progress-bar'
              : value === 'choices-status'
                ? 'info-bar'
                : value === 'layout'
                  ? 'grid'
                  : value === 'text-input'
                    ? 'text-box'
                    : value === 'icons'
                      ? 'iconography'
                    : value
    const page = findGalleryPage(
      normalizedValue,
    )
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
