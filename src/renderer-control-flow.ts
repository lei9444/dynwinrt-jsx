import {
  createScope,
  effect,
  runInScope,
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
  markListEntryCreated(): void
  markListEntryReused(): void
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
    let current: MountedRecord | undefined

    const record = new RecordState(
      onNodesChanged,
      () => {
        current?.dispose()
        current = undefined
        scope.dispose()
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
    let entries: ListEntry<Item>[] = []
    let fallback: MountedRecord | undefined

    const record = new RecordState(
      onNodesChanged,
      () => {
        fallback?.dispose()
        fallback = undefined
        for (const entry of entries) {
          entry.record.dispose()
        }
        entries = []
        scope.dispose()
      },
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
          for (const entry of entries) {
            entry.record.dispose()
          }
          entries = []

          if (!fallback && list.fallback != null) {
            fallback = this.host.mount(
              list.fallback,
              () => updateNodes(),
              scope,
            )
          }

          updateNodes()
          return
        }

        fallback?.dispose()
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

        keyedItems.forEach(({ item, index, key }) => {
          const previous = oldEntries.get(key)
          if (
            previous &&
            Object.is(previous.item, item)
          ) {
            oldEntries.delete(key)
            previous.index.value = index
            this.host.markListEntryReused()
            nextEntries.push(previous)
            return
          }

          previous?.record.dispose()
          oldEntries.delete(key)

          const entry: ListEntry<Item> = {
            key,
            item,
            index: signal(index),
            nodes: [],
            record:
              undefined as unknown as MountedRecord,
          }
          this.host.markListEntryCreated()
          entry.record = this.host.mountOwned(
            () => list.renderItem(item, entry.index),
            (nodes) => {
              entry.nodes = nodes
              updateNodes()
            },
            scope,
          )
          nextEntries.push(entry)
        })

        for (const entry of oldEntries.values()) {
          entry.record.dispose()
        }

        entries = nextEntries
        updateNodes()
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
