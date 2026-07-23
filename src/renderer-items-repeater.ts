import type {
  NativeItemsRepeaterAdapter,
  NativeItemsRepeaterData,
} from './adapters'
import {
  effect,
  runInScope,
  signal,
  type ReactiveScope,
  type Signal,
} from './reactive'
import type { NativeCollection } from './renderer-children'
import type { RendererErrorContext } from './renderer'
import type { Child, Key } from './vnode'

interface ItemsRepeaterChildController {
  replace(child: Child): void
  dispose(): void
}

interface ItemsRepeaterEntry {
  readonly host: object
  readonly controller: ItemsRepeaterChildController
  readonly index: Signal<number>
  readonly inspectionNodeId: number
  keyToken: string
  item: unknown
  pooled: boolean
  reserved: boolean
}

interface ItemDescriptor {
  readonly key: Key
  readonly token: string
  readonly item: unknown
  readonly index: number
  readonly sourceValue: unknown
}

export interface RendererItemsRepeaterHost {
  createItemController(
    host: object,
    scope: ReactiveScope,
    child: Child,
  ): ItemsRepeaterChildController
  handleError(
    error: unknown,
    context: RendererErrorContext,
    scope: ReactiveScope,
  ): void
  registerNative(
    host: object,
    scope: ReactiveScope,
  ): number
  releaseNative(id: number): void
}

export interface RendererItemsRepeaterController {
  dispose(): void
}

export class RendererItemsRepeaterService {
  constructor(
    private readonly host: RendererItemsRepeaterHost,
  ) {}

  bind(
    instance: object,
    data: NativeItemsRepeaterData,
    adapter: NativeItemsRepeaterAdapter<object>,
    scope: ReactiveScope,
  ): RendererItemsRepeaterController {
    const entries = new Set<ItemsRepeaterEntry>()
    const entryByHost = new Map<object, ItemsRepeaterEntry>()
    const activeByKey = new Map<string, ItemsRepeaterEntry>()
    const pooledByKey = new Map<string, ItemsRepeaterEntry>()
    const pool: ItemsRepeaterEntry[] = []
    const preservedKeys = new Set<string>()
    const tokenByKey = new Map<Key, string>()
    const sourceValueByToken = new Map<string, unknown>()
    let descriptors = new Map<string, ItemDescriptor>()
    let source: NativeCollection | undefined
    let sourceValues: unknown[] = []
    let factory: unknown
    let nextToken = 1
    let disposed = false
    let updatingSource = false

    const renderEntry = (
      descriptor: ItemDescriptor,
      index: Signal<number>,
    ) => data.renderItem(descriptor.item, index)

    const updateEntry = (
      entry: ItemsRepeaterEntry,
      descriptor: ItemDescriptor,
    ) => {
      const changedItem =
        !Object.is(entry.item, descriptor.item)
      const changedKey =
        entry.keyToken !== descriptor.token
      entry.keyToken = descriptor.token
      entry.item = descriptor.item
      entry.index.value = descriptor.index
      if (changedItem || changedKey) {
        entry.controller.replace(
          renderEntry(descriptor, entry.index),
        )
      }
    }

    const removeFromPool = (entry: ItemsRepeaterEntry) => {
      const index = pool.indexOf(entry)
      if (index >= 0) {
        pool.splice(index, 1)
      }
      if (pooledByKey.get(entry.keyToken) === entry) {
        pooledByKey.delete(entry.keyToken)
      }
      entry.pooled = false
      entry.reserved =
        preservedKeys.has(entry.keyToken)
    }

    const createEntry = (
      descriptor: ItemDescriptor,
    ): ItemsRepeaterEntry => {
      const host = adapter.createElementHost()
      const inspectionNodeId =
        this.host.registerNative(host, scope)
      const index = signal(descriptor.index)
      let controller: ItemsRepeaterChildController
      try {
        controller = this.host.createItemController(
          host,
          scope,
          renderEntry(descriptor, index),
        )
      }
      catch (error) {
        this.host.releaseNative(inspectionNodeId)
        throw error
      }
      const entry: ItemsRepeaterEntry = {
        host,
        controller,
        index,
        inspectionNodeId,
        keyToken: descriptor.token,
        item: descriptor.item,
        pooled: false,
        reserved: false,
      }
      entries.add(entry)
      entryByHost.set(host, entry)
      return entry
    }

    const getElement = (
      args: { readonly data: unknown },
    ): object => {
      if (disposed) {
        throw new Error(
          'ItemsRepeater requested an element after disposal.',
        )
      }

      const token = adapter.readItemsSourceKey(args.data)
      const descriptor = descriptors.get(token)
      if (!descriptor) {
        throw new Error(
          `ItemsRepeater requested unknown item key "${token}".`,
        )
      }

      const active = activeByKey.get(token)
      if (active) {
        return active.host
      }

      let entry = pooledByKey.get(token)
      if (entry) {
        removeFromPool(entry)
      }
      else {
        let reusableIndex = -1
        for (
          let index = pool.length - 1;
          index >= 0;
          index -= 1
        ) {
          if (!pool[index]?.reserved) {
            reusableIndex = index
            break
          }
        }
        entry = reusableIndex >= 0
          ? pool.splice(reusableIndex, 1)[0]
          : undefined
        if (entry) {
          if (
            pooledByKey.get(entry.keyToken) === entry
          ) {
            pooledByKey.delete(entry.keyToken)
          }
          entry.pooled = false
          entry.reserved = false
        }
      }

      if (entry) {
        updateEntry(entry, descriptor)
      }
      else {
        entry = createEntry(descriptor)
      }

      activeByKey.set(token, entry)
      return entry.host
    }

    const recycleElement = (
      args: {
        readonly element: object | null | undefined
      },
    ) => {
      if (disposed || !args.element) {
        return
      }
      const entry = entryByHost.get(args.element)
      if (!entry) {
        throw new Error(
          'ItemsRepeater recycled an unknown element.',
        )
      }
      if (entry.pooled) {
        return
      }

      if (
        activeByKey.get(entry.keyToken) === entry
      ) {
        activeByKey.delete(entry.keyToken)
      }
      entry.pooled = true
      entry.reserved =
        preservedKeys.has(entry.keyToken) ||
        (
          updatingSource &&
          descriptors.has(entry.keyToken)
        )
      pool.push(entry)
      pooledByKey.set(entry.keyToken, entry)
    }

    const buildDescriptors = (): {
      readonly descriptors: Map<string, ItemDescriptor>
      readonly keys: Set<Key>
      readonly sourceValues: readonly unknown[]
    } => {
      const items = data.readItems()
      const seen = new Set<Key>()
      const nextDescriptors =
        new Map<string, ItemDescriptor>()
      const keys = new Set<Key>()
      const sourceValues: unknown[] = []

      items.forEach((item, index) => {
        const key = data.getKey(item, index)
        if (seen.has(key)) {
          throw new Error(
            `Duplicate ItemsRepeater key: ${String(key)}`,
          )
        }
        seen.add(key)
        keys.add(key)

        let token = tokenByKey.get(key)
        if (!token) {
          token = String(nextToken)
          nextToken += 1
          tokenByKey.set(key, token)
        }
        let sourceValue = sourceValueByToken.get(token)
        if (!sourceValue) {
          sourceValue =
            adapter.createItemsSourceValue(token)
          sourceValueByToken.set(token, sourceValue)
        }

        nextDescriptors.set(token, {
          key,
          token,
          item,
          index,
          sourceValue,
        })
        sourceValues.push(sourceValue)
      })

      return {
        descriptors: nextDescriptors,
        keys,
        sourceValues,
      }
    }

    const synchronizeSource = (
      collection: NativeCollection,
      current: unknown[],
      desired: readonly unknown[],
    ) => {
      for (
        let index = 0;
        index < desired.length;
        index += 1
      ) {
        const desiredValue = desired[index]
        if (current[index] === desiredValue) {
          continue
        }

        const existingIndex = current.indexOf(
          desiredValue,
          index + 1,
        )
        if (existingIndex >= 0) {
          collection.removeAt(existingIndex)
          current.splice(existingIndex, 1)
        }

        if (index === current.length) {
          collection.append(desiredValue)
        }
        else {
          collection.insertAt(index, desiredValue)
        }
        current.splice(index, 0, desiredValue)
      }

      while (current.length > desired.length) {
        const index = current.length - 1
        collection.removeAt(index)
        current.pop()
      }
    }

    const applyItems = () => {
      const previousTokens = new Map(tokenByKey)
      const previousSourceValueCache =
        new Map(sourceValueByToken)
      let next: ReturnType<typeof buildDescriptors>
      try {
        next = buildDescriptors()
      }
      catch (error) {
        tokenByKey.clear()
        sourceValueByToken.clear()
        for (const [key, token] of previousTokens) {
          tokenByKey.set(key, token)
        }
        for (
          const [token, value] of previousSourceValueCache
        ) {
          sourceValueByToken.set(token, value)
        }
        throw error
      }
      const initialSource = source
        ? undefined
        : adapter.createItemsSource(next.sourceValues)
      const previousDescriptors = descriptors
      const previousSourceValues = [...sourceValues]
      const previousPreservedKeys =
        new Set(preservedKeys)
      const snapshots = [...entries].map((entry) => ({
        entry,
        keyToken: entry.keyToken,
        item: entry.item,
        index: entry.index.peek(),
        reserved: entry.reserved,
      }))
      let assignedInitialSource = false

      descriptors = next.descriptors
      try {
        const activeKeys = [...activeByKey.keys()]
        preservedKeys.clear()
        for (const token of activeKeys) {
          if (descriptors.has(token)) {
            preservedKeys.add(token)
          }
        }
        for (const entry of pool) {
          entry.reserved =
            preservedKeys.has(entry.keyToken)
        }
        for (const entry of activeByKey.values()) {
          entry.reserved =
            preservedKeys.has(entry.keyToken)
        }
        for (const entry of entries) {
          const descriptor =
            descriptors.get(entry.keyToken)
          if (descriptor) {
            updateEntry(entry, descriptor)
          }
        }

        if (source) {
          const current = [...sourceValues]
          updatingSource = true
          try {
            synchronizeSource(
              source,
              current,
              next.sourceValues,
            )
          }
          catch (error) {
            let rollbackError: unknown
            try {
              synchronizeSource(
                source,
                current,
                sourceValues,
              )
            }
            catch (rollbackFailure) {
              rollbackError = rollbackFailure
            }
            if (rollbackError !== undefined) {
              throw new AggregateError(
                [error, rollbackError],
                'ItemsRepeater source update and rollback failed.',
              )
            }
            throw error
          }
          finally {
            updatingSource = false
          }
        }
        else {
          source = initialSource!
          assignedInitialSource = true
          updatingSource = true
          try {
            adapter.setItemsSource(instance, source)
          }
          finally {
            updatingSource = false
          }
        }
        sourceValues = [...next.sourceValues]

        for (const [key, token] of tokenByKey) {
          if (!next.keys.has(key)) {
            tokenByKey.delete(key)
            sourceValueByToken.delete(token)
          }
        }
      }
      catch (error) {
        descriptors = previousDescriptors
        preservedKeys.clear()
        for (const token of previousPreservedKeys) {
          preservedKeys.add(token)
        }
        let rollbackError: unknown
        try {
          for (const snapshot of snapshots) {
            const descriptor =
              previousDescriptors.get(snapshot.keyToken)
            if (descriptor) {
              updateEntry(snapshot.entry, descriptor)
            }
            else {
              snapshot.entry.keyToken =
                snapshot.keyToken
              snapshot.entry.item = snapshot.item
              snapshot.entry.index.value =
                snapshot.index
            }
            snapshot.entry.reserved =
              snapshot.reserved
          }
          if (assignedInitialSource) {
            adapter.clearItemsSource(instance)
            source = undefined
          }
          sourceValues = previousSourceValues
        }
        catch (rollbackFailure) {
          rollbackError = rollbackFailure
        }

        if (rollbackError !== undefined) {
          throw new AggregateError(
            [error, rollbackError],
            'ItemsRepeater source update and rollback failed.',
          )
        }
        throw error
      }
    }

    try {
      factory = adapter.createElementFactory({
        getElement: (args) => {
          try {
            return getElement(args)
          }
          catch (error) {
            this.host.handleError(
              error,
              { phase: 'items-repeater', target: instance },
              scope,
            )
            throw error
          }
        },
        recycleElement: (args) => {
          try {
            recycleElement(args)
          }
          catch (error) {
            this.host.handleError(
              error,
              { phase: 'items-repeater', target: instance },
              scope,
            )
            throw error
          }
        },
      })
      adapter.setItemTemplate(instance, factory)
      runInScope(scope, () => {
        effect(applyItems)
      })
    }
    catch (error) {
      disposed = true
      let cleanupError: unknown
      try {
        adapter.clearItemsSource(instance)
      }
      catch (failure) {
        cleanupError = failure
      }
      if (factory !== undefined) {
        try {
          adapter.releaseElementFactory(factory)
        }
        catch (failure) {
          cleanupError ??= failure
        }
      }
      for (const entry of entries) {
        try {
          entry.controller.dispose()
        }
        catch (failure) {
          cleanupError ??= failure
        }
        finally {
          this.host.releaseNative(
            entry.inspectionNodeId,
          )
        }
      }
      entries.clear()
      entryByHost.clear()
      activeByKey.clear()
      pooledByKey.clear()
      pool.length = 0
      preservedKeys.clear()
      descriptors.clear()
      tokenByKey.clear()
      sourceValueByToken.clear()
      source = undefined
      sourceValues = []
      factory = undefined
      if (cleanupError !== undefined) {
        throw new AggregateError(
          [error, cleanupError],
          'ItemsRepeater setup and cleanup failed.',
        )
      }
      throw error
    }

    return {
      dispose: () => {
        if (disposed) {
          return
        }
        disposed = true
        let firstError: unknown
        try {
          adapter.clearItemsSource(instance)
        }
        catch (error) {
          firstError ??= error
        }
        // WinUI rejects clearing ItemTemplate after realization. Releasing the
        // callback refs detaches JavaScript state while the native shell remains
        // attached until the repeater itself is released.
        try {
          adapter.releaseElementFactory(factory)
        }
        catch (error) {
          firstError ??= error
        }

        for (const entry of entries) {
          try {
            entry.controller.dispose()
          }
          catch (error) {
            firstError ??= error
          }
          finally {
            this.host.releaseNative(
              entry.inspectionNodeId,
            )
          }
        }
        entries.clear()
        entryByHost.clear()
        activeByKey.clear()
        pooledByKey.clear()
        pool.length = 0
        preservedKeys.clear()
        descriptors.clear()
        tokenByKey.clear()
        sourceValueByToken.clear()
        source = undefined
        sourceValues = []
        factory = undefined

        if (firstError !== undefined) {
          throw firstError
        }
      },
    }
  }
}
