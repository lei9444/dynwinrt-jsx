import {
  createScope,
  effect,
  runInScope,
  setReactiveScopeInspection,
  signal,
  type ReactiveScope,
  type Signal,
} from '../core/reactive'
import {
  ChildSyncRestoredError,
  resolveChildAdapter,
  type ChildAdapter,
  type ChildAdapterOptions,
} from './renderer-children'
import {
  RecordState,
  runWithChildSynchronizationErrors,
  type MountedRecord,
} from './renderer-lifecycle'
import type { RendererErrorContext } from './renderer'
import type {
  Child,
  Key,
  ListNode,
  PortalNode,
} from '../core/vnode'

interface ListEntry<Item> {
  readonly key: Key
  readonly item: Item
  readonly index: Signal<number>
  active: boolean
  nodes: readonly unknown[]
  record: MountedRecord
}

export interface RendererChildController {
  dispose(): void
}

export interface RendererControlFlowHost {
  mount(
    child: Child,
    onNodesChanged: (nodes: readonly unknown[]) => void,
    parentScope: ReactiveScope,
  ): MountedRecord
  mountOwned(
    read: () => Child,
    onNodesChanged: (nodes: readonly unknown[]) => void,
    parentScope: ReactiveScope,
  ): MountedRecord
  createChildrenController(
    adapter: ChildAdapter,
    scope: ReactiveScope,
    children: Child,
  ): RendererChildController
  handleError(
    error: unknown,
    context: RendererErrorContext,
    scope: ReactiveScope,
  ): void
  markListEntryCreated(scope: ReactiveScope): void
  markListEntryReused(scope: ReactiveScope): void
}

export class RendererControlFlowService {
  constructor(
    private readonly options: ChildAdapterOptions,
    private readonly host: RendererControlFlowHost,
  ) {}

  mountDynamic(
    read: () => Child,
    onNodesChanged: (nodes: readonly unknown[]) => void,
    parentScope: ReactiveScope,
    beforeDispose?: () => void,
  ): MountedRecord {
    const scope = createScope(parentScope)
    setReactiveScopeInspection(scope, {
      kind: 'dynamic',
    })
    let current: MountedRecord | undefined

    const record = new RecordState(
      onNodesChanged,
      () => {
        let firstError: unknown
        try {
          beforeDispose?.()
        }
        catch (error) {
          firstError = error
        }
        try {
          current?.dispose()
        }
        catch (error) {
          firstError ??= error
        }
        current = undefined
        try {
          scope.dispose()
        }
        catch (error) {
          firstError ??= error
        }
        if (firstError !== undefined) {
          throw firstError
        }
      },
    )

    runInScope(scope, () => {
      effect(() => {
        current?.dispose()
        current = this.host.mountOwned(
          read,
          (nodes) => record.setNodes(nodes),
          scope,
        )
      })
    })

    return record
  }

  mountList<Item>(
    list: ListNode<Item>,
    onNodesChanged: (nodes: readonly unknown[]) => void,
    parentScope: ReactiveScope,
  ): MountedRecord {
    const scope = createScope(parentScope)
    setReactiveScopeInspection(scope, {
      kind: 'list',
    })
    let entries: ListEntry<Item>[] = []
    let fallback: MountedRecord | undefined
    let retiredEntries: ListEntry<Item>[] = []
    let retiredFallbacks: MountedRecord[] = []
    const disposeEntries = (
      values: Iterable<ListEntry<Item>>,
    ): {
      readonly error: unknown
      readonly retained: ListEntry<Item>[]
    } => {
      let firstError: unknown
      const retained: ListEntry<Item>[] = []
      for (const entry of values) {
        entry.active = false
        try {
          entry.record.dispose()
        }
        catch (error) {
          firstError ??= error
        }
        if (!entry.record.disposed) {
          retained.push(entry)
        }
      }
      return {
        error: firstError,
        retained,
      }
    }
    const disposeFallbacks = (
      values: Iterable<MountedRecord>,
    ): {
      readonly error: unknown
      readonly retained: MountedRecord[]
    } => {
      let firstError: unknown
      const retained: MountedRecord[] = []
      for (const value of values) {
        try {
          value.dispose()
        }
        catch (error) {
          firstError ??= error
        }
        if (!value.disposed) {
          retained.push(value)
        }
      }
      return {
        error: firstError,
        retained,
      }
    }

    const record = new RecordState(
      onNodesChanged,
      () => {
        let firstError: unknown
        if (fallback) {
          const result = disposeFallbacks([fallback])
          firstError = result.error
          fallback = result.retained[0]
        }
        const retiredFallbackResult =
          disposeFallbacks(retiredFallbacks)
        firstError ??= retiredFallbackResult.error
        retiredFallbacks = retiredFallbackResult.retained
        const entryResult = disposeEntries(entries)
        firstError ??= entryResult.error
        entries = entryResult.retained
        for (const entry of entries) {
          entry.active = true
        }
        const retiredEntryResult =
          disposeEntries(retiredEntries)
        firstError ??= retiredEntryResult.error
        retiredEntries = retiredEntryResult.retained
        if (
          fallback !== undefined ||
          retiredFallbacks.length > 0 ||
          entries.length > 0 ||
          retiredEntries.length > 0
        ) {
          if (firstError === undefined) {
            firstError = new Error(
              'Keyed list cleanup retained undisposed records.',
            )
          }
          throw firstError
        }
        try {
          scope.dispose()
        }
        catch (error) {
          firstError ??= error
        }
        if (firstError !== undefined) {
          throw firstError
        }
      },
      true,
    )

    const updateNodes = (
      propagateSynchronizationErrors = false,
      allowCachedCollectionFallback = false,
      skipNativeSynchronization = false,
    ) => {
      const apply = () => {
        if (fallback) {
          record.setNodes(fallback.nodes)
        }
        else {
          record.setNodes(
            entries.flatMap((entry) => [...entry.nodes]),
          )
        }
      }
      if (propagateSynchronizationErrors) {
        runWithChildSynchronizationErrors(
          apply,
          allowCachedCollectionFallback,
          skipNativeSynchronization,
        )
      }
      else {
        apply()
      }
    }

    runInScope(scope, () => {
      effect(() => {
        const items = list.readItems()
        const seenKeys = new Set<Key>()
        const keyedItems = items.length === 0
          ? []
          : items.map((item, visibleIndex) => {
              const index = list.getSourceIndex(
                item,
                visibleIndex,
              )
              const key = list.getKey(item, index)
              if (seenKeys.has(key)) {
                throw new Error(
                  `Duplicate For key: ${String(key)}`,
                )
              }
              seenKeys.add(key)
              return { item, index, key }
            })
        const previousEntries = entries
        const previousFallback = fallback
        const oldEntries = new Map<Key, ListEntry<Item>>()
        for (const entry of previousEntries) {
          if (oldEntries.has(entry.key)) {
            throw new Error(
              `Duplicate existing For key: ${String(entry.key)}`,
            )
          }
          oldEntries.set(entry.key, entry)
        }

        let cleanupError: unknown
        const retiredEntryRetry =
          disposeEntries(retiredEntries)
        cleanupError = retiredEntryRetry.error
        retiredEntries = retiredEntryRetry.retained
        const retiredFallbackRetry =
          disposeFallbacks(retiredFallbacks)
        cleanupError ??= retiredFallbackRetry.error
        retiredFallbacks =
          retiredFallbackRetry.retained

        const nextEntries: ListEntry<Item>[] = []
        const createdEntries: ListEntry<Item>[] = []
        const previousIndexes =
          new Map<ListEntry<Item>, number>()
        let nextFallback = previousFallback
        let createdFallback: MountedRecord | undefined
        for (const entry of previousEntries) {
          entry.active = false
        }

        try {
          if (items.length === 0) {
            if (
              !nextFallback &&
              list.fallback != null
            ) {
              let candidate: MountedRecord | undefined
              candidate = this.host.mount(
                list.fallback,
                () => {
                  if (fallback === candidate) {
                    updateNodes()
                  }
                },
                scope,
              )
              createdFallback = candidate
              nextFallback = candidate
            }
          }
          else {
            nextFallback = undefined
          }

          keyedItems.forEach(({ item, index, key }) => {
            const previous = oldEntries.get(key)
            if (
              previous &&
              Object.is(previous.item, item)
            ) {
              oldEntries.delete(key)
              previousIndexes.set(
                previous,
                previous.index.peek(),
              )
              previous.index.value = index
              this.host.markListEntryReused(scope)
              nextEntries.push(previous)
              return
            }

            oldEntries.delete(key)

            const entry: ListEntry<Item> = {
              key,
              item,
              index: signal(index),
              active: false,
              nodes: [],
              record:
                undefined as unknown as MountedRecord,
            }
            this.host.markListEntryCreated(scope)
            entry.record = this.host.mountOwned(
              () => list.renderItem(item, entry.index),
              (nodes) => {
                entry.nodes = nodes
                if (entry.active) {
                  updateNodes()
                }
              },
              scope,
            )
            createdEntries.push(entry)
            nextEntries.push(entry)
          })
        }
        catch (error) {
          const stagedEntryCleanup =
            disposeEntries(createdEntries)
          cleanupError ??= stagedEntryCleanup.error
          retiredEntries.push(
            ...stagedEntryCleanup.retained,
          )
          if (createdFallback) {
            const stagedFallbackCleanup =
              disposeFallbacks([createdFallback])
            cleanupError ??= stagedFallbackCleanup.error
            retiredFallbacks.push(
              ...stagedFallbackCleanup.retained,
            )
          }
          for (const [entry, previousIndex] of
            previousIndexes) {
            try {
              entry.index.value = previousIndex
            }
            catch (failure) {
              cleanupError ??= failure
            }
          }
          for (const entry of previousEntries) {
            entry.active = true
          }
          if (cleanupError !== undefined) {
            throw new AggregateError(
              [error, cleanupError],
              'Keyed reconciliation and staged cleanup failed.',
            )
          }
          throw error
        }

        entries = nextEntries
        fallback = nextFallback
        let synchronizationError: unknown
        try {
          updateNodes(true)
        }
        catch (error) {
          synchronizationError = error
        }
        if (synchronizationError !== undefined) {
          const nativeStateRestored =
            synchronizationError instanceof
              ChildSyncRestoredError
          const reportedSynchronizationError =
            nativeStateRestored
              ? (
                  synchronizationError as
                    ChildSyncRestoredError
                ).originalError
              : synchronizationError
          entries = previousEntries
          fallback = previousFallback
          for (const entry of previousEntries) {
            entry.active = true
          }
          try {
            updateNodes(
              true,
              true,
              nativeStateRestored,
            )
          }
          catch (error) {
            cleanupError ??= error
          }
          const stagedEntryCleanup =
            disposeEntries(createdEntries)
          cleanupError ??= stagedEntryCleanup.error
          retiredEntries.push(
            ...stagedEntryCleanup.retained,
          )
          if (createdFallback) {
            const stagedFallbackCleanup =
              disposeFallbacks([createdFallback])
            cleanupError ??= stagedFallbackCleanup.error
            retiredFallbacks.push(
              ...stagedFallbackCleanup.retained,
            )
          }
          for (const [entry, previousIndex] of
            previousIndexes) {
            try {
              entry.index.value = previousIndex
            }
            catch (error) {
              cleanupError ??= error
            }
          }
          if (cleanupError !== undefined) {
            throw new AggregateError(
              [
                reportedSynchronizationError,
                cleanupError,
              ],
              'Keyed native synchronization and rollback failed.',
            )
          }
          throw reportedSynchronizationError
        }

        for (const entry of entries) {
          entry.active = true
        }
        const nextEntrySet = new Set(entries)
        const removedEntries = previousEntries.filter(
          (entry) => !nextEntrySet.has(entry),
        )
        const removedEntryCleanup =
          disposeEntries(removedEntries)
        cleanupError ??= removedEntryCleanup.error
        retiredEntries.push(
          ...removedEntryCleanup.retained,
        )
        if (
          previousFallback &&
          previousFallback !== fallback
        ) {
          const removedFallbackCleanup =
            disposeFallbacks([previousFallback])
          cleanupError ??=
            removedFallbackCleanup.error
          retiredFallbacks.push(
            ...removedFallbackCleanup.retained,
          )
        }
        if (cleanupError !== undefined) {
          throw cleanupError
        }
      }, {
        onError: (error) => {
          this.host.handleError(
            error,
            { phase: 'children' },
            scope,
          )
        },
      })
    })

    return record
  }

  mountPortal(
    portal: PortalNode,
    onNodesChanged: (nodes: readonly unknown[]) => void,
    parentScope: ReactiveScope,
  ): MountedRecord {
    const scope = createScope(parentScope)
    setReactiveScopeInspection(scope, {
      kind: 'portal',
    })
    let controller:
      | RendererChildController
      | undefined
    let target: object | null | undefined

    const record = new RecordState(
      onNodesChanged,
      () => {
        controller?.dispose()
        controller = undefined
        target = undefined
        scope.dispose()
      },
      true,
    )
    record.setNodes([])

    runInScope(scope, () => {
      effect(() => {
        const nextTarget = portal.readTarget()
        if (nextTarget === target) {
          return
        }

        controller?.dispose()
        controller = undefined
        target = nextTarget

        if (!nextTarget) {
          return
        }

        const adapter = resolveChildAdapter(
          this.options,
          nextTarget,
        )
        if (!adapter) {
          throw new Error(
            `${nextTarget.constructor.name} cannot host portal children.`,
          )
        }

        controller =
          this.host.createChildrenController(
            adapter,
            scope,
            portal.children,
          )
      }, {
        onError: (error) => {
          this.host.handleError(
            error,
            { phase: 'portal', target },
            scope,
          )
        },
      })
    })

    return record
  }
}
