import {
  createScope,
  effect,
  runInScope,
  setReactiveScopeInspection,
  signal,
  type ReactiveScope,
  type Signal,
} from './reactive'
import {
  resolveChildAdapter,
  type ChildAdapter,
  type ChildAdapterOptions,
} from './renderer-children'
import {
  RecordState,
  type MountedRecord,
} from './renderer-lifecycle'
import type { RendererErrorContext } from './renderer'
import type {
  Child,
  Key,
  ListNode,
  PortalNode,
} from './vnode'

interface ListEntry<Item> {
  readonly key: Key
  readonly item: Item
  readonly index: Signal<number>
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
          current?.dispose()
        }
        catch (error) {
          firstError = error
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
    const disposeEntries = (
      values: Iterable<ListEntry<Item>>,
    ): unknown => {
      let firstError: unknown
      for (const entry of values) {
        try {
          entry.record.dispose()
        }
        catch (error) {
          firstError ??= error
        }
      }
      return firstError
    }

    const record = new RecordState(
      onNodesChanged,
      () => {
        let firstError: unknown
        let retainedFallback: MountedRecord | undefined
        try {
          fallback?.dispose()
        }
        catch (error) {
          firstError = error
          if (fallback && !fallback.disposed) {
            retainedFallback = fallback
          }
        }
        fallback = retainedFallback
        const retainedEntries: ListEntry<Item>[] = []
        for (const entry of entries) {
          try {
            entry.record.dispose()
          }
          catch (error) {
            firstError ??= error
          }
          if (!entry.record.disposed) {
            retainedEntries.push(entry)
          }
        }
        entries = retainedEntries
        if (
          fallback !== undefined ||
          entries.length > 0
        ) {
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

    const updateNodes = () => {
      if (fallback) {
        record.setNodes(fallback.nodes)
      }
      else {
        record.setNodes(
          entries.flatMap((entry) => [...entry.nodes]),
        )
      }
    }

    runInScope(scope, () => {
      effect(() => {
        const items = list.readItems()
        if (items.length === 0) {
          const disposalError = disposeEntries(entries)
          entries = []

          if (!fallback && list.fallback != null) {
            fallback = this.host.mount(
              list.fallback,
              () => updateNodes(),
              scope,
            )
          }

          updateNodes()
          if (disposalError !== undefined) {
            throw disposalError
          }
          return
        }

        let disposalError: unknown
        try {
          fallback?.dispose()
        }
        catch (error) {
          disposalError = error
        }
        fallback = undefined

        const seenKeys = new Set<Key>()
        const keyedItems = items.map(
          (item, visibleIndex) => {
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
          },
        )

        const oldEntries = new Map<Key, ListEntry<Item>>()
        for (const entry of entries) {
          if (oldEntries.has(entry.key)) {
            throw new Error(
              `Duplicate existing For key: ${String(entry.key)}`,
            )
          }
          oldEntries.set(entry.key, entry)
        }

        const nextEntries: ListEntry<Item>[] = []
        const createdEntries: ListEntry<Item>[] = []
        const disposedEntries = new Set<ListEntry<Item>>()
        const previousIndexes =
          new Map<ListEntry<Item>, number>()

        try {
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

            if (previous) {
              disposedEntries.add(previous)
              previous.record.dispose()
            }
            oldEntries.delete(key)

            const entry: ListEntry<Item> = {
              key,
              item,
              index: signal(index),
              nodes: [],
              record:
                undefined as unknown as MountedRecord,
            }
            this.host.markListEntryCreated(scope)
            entry.record = this.host.mountOwned(
              () => list.renderItem(item, entry.index),
              (nodes) => {
                entry.nodes = nodes
                updateNodes()
              },
              scope,
            )
            createdEntries.push(entry)
            nextEntries.push(entry)
          })
        }
        catch (error) {
          let cleanupError =
            disposeEntries(createdEntries)
          for (const [entry, previousIndex] of
            previousIndexes) {
            if (!disposedEntries.has(entry)) {
              try {
                entry.index.value = previousIndex
              }
              catch (failure) {
                cleanupError ??= failure
              }
            }
          }
          entries = entries.filter(
            (entry) => !disposedEntries.has(entry),
          )
          try {
            updateNodes()
          }
          catch (failure) {
            cleanupError ??= failure
          }
          if (cleanupError !== undefined) {
            throw new AggregateError(
              [error, cleanupError],
              'Keyed reconciliation and staged cleanup failed.',
            )
          }
          throw error
        }

        const oldEntriesError =
          disposeEntries(oldEntries.values())
        disposalError ??= oldEntriesError

        entries = nextEntries
        updateNodes()
        if (disposalError !== undefined) {
          throw disposalError
        }
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
