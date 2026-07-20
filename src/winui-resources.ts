import {
  isResourceReference,
  isThemeResourceReference,
} from './resource'
import {
  onCleanup,
  runInScope,
} from './reactive'
import type {
  NativePropertySetter,
  RendererOptions,
} from './renderer'

interface ResourceMap {
  lookup(key: unknown): unknown
  hasKey(key: unknown): boolean
  insert(key: unknown, value: unknown): boolean
  remove(key: unknown): void
}

interface ResourceDictionaryVector {
  readonly size: number
  getAt(index: number): ResourceDictionary
  append?(value: ResourceDictionary): void
  removeAt?(index: number): void
}

interface ResourceDictionary extends ResourceMap {
  readonly mergedDictionaries?: ResourceDictionaryVector
  readonly themeDictionaries?: ResourceMap
  as?(interfaceType: unknown): ResourceMap
}

interface FrameworkElement {
  resources?: ResourceDictionary | null
  parent?: unknown
  requestedTheme?: unknown
  actualTheme?: unknown
  dispatcherQueue?: {
    createTimer(): {
      interval: { duration: bigint }
      isRepeating: boolean
      onTick(
        callback: (sender: unknown, args: unknown) => void,
      ): (() => void) | void
      start(): void
      stop(): void
    }
  }
  onLoaded?(
    callback: (sender: unknown, args: unknown) => void,
  ): (() => void) | void
  onActualThemeChanged?(
    callback: (sender: unknown, args: unknown) => void,
  ): (() => void) | void
}

interface AccessibilitySettings {
  readonly highContrast: boolean
}

interface AccessibilitySettingsConstructor {
  new (): AccessibilitySettings
}

interface ResourceDictionaryConstructor {
  new (): ResourceDictionary
}

interface PropertyValueType {
  createString(value: string): unknown
}

interface ApplicationType {
  readonly current: {
    readonly resources: ResourceDictionary
    readonly requestedTheme: unknown
  } | null
}

interface EnumType {
  readonly Dark?: unknown
  readonly Light?: unknown
}

export interface WinUIResourceBindings {
  readonly AccessibilitySettings?: AccessibilitySettingsConstructor
  readonly Application?: ApplicationType
  readonly ApplicationTheme?: EnumType
  readonly ElementTheme?: EnumType
  readonly IMap_Object_Object?: unknown
  readonly PropertyValue?: PropertyValueType
  readonly ResourceDictionary?: ResourceDictionaryConstructor
}

export type WinUIResourceOverrides = Readonly<Record<string, unknown>>

interface ResourceSnapshot {
  readonly exists: boolean
  readonly value?: unknown
}

interface OverrideState {
  readonly target: FrameworkElement
  readonly originalDictionary: ResourceDictionary
  readonly dictionary: ResourceDictionary
  currentValues: Map<string, unknown>
  source: WinUIResourceOverrides | undefined
}

export interface WinUIResourceRuntime {
  readonly resolveResource: NonNullable<RendererOptions['resolveResource']>
  readonly observeResourceChanges:
    NonNullable<RendererOptions['observeResourceChanges']>
  readonly getResourceObservationKind:
    NonNullable<RendererOptions['getResourceObservationKind']>
  readonly resourceOverridesSetter: NativePropertySetter
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function enumMatches(
  value: unknown,
  expected: unknown,
  name: string,
): boolean {
  return (
    (expected !== undefined && value === expected) ||
    (
      typeof value === 'string' &&
      value.toLowerCase() === name.toLowerCase()
    )
  )
}

function createResourceKey(
  bindings: WinUIResourceBindings,
  key: string,
): unknown {
  if (!bindings.PropertyValue) {
    throw new Error(
      `PropertyValue.createString is required to resolve resource "${key}".`,
    )
  }
  return bindings.PropertyValue.createString(key)
}

function asResourceMap(
  dictionary: ResourceDictionary,
  bindings: WinUIResourceBindings,
): ResourceMap {
  if (
    typeof dictionary.lookup === 'function' &&
    typeof dictionary.hasKey === 'function' &&
    typeof dictionary.insert === 'function' &&
    typeof dictionary.remove === 'function'
  ) {
    return dictionary
  }
  if (dictionary.as && bindings.IMap_Object_Object) {
    return dictionary.as(bindings.IMap_Object_Object)
  }
  throw new TypeError('The projected ResourceDictionary is not map-compatible.')
}

function readEntry(
  dictionary: ResourceDictionary,
  bindings: WinUIResourceBindings,
  key: string,
): ResourceSnapshot {
  const map = asResourceMap(dictionary, bindings)
  const resourceKey = createResourceKey(bindings, key)
  if (!map.hasKey(resourceKey)) {
    return { exists: false }
  }
  return {
    exists: true,
    value: map.lookup(resourceKey),
  }
}

function writeEntry(
  dictionary: ResourceDictionary,
  bindings: WinUIResourceBindings,
  key: string,
  value: unknown,
): void {
  asResourceMap(dictionary, bindings).insert(
    createResourceKey(bindings, key),
    value,
  )
}

function removeEntry(
  dictionary: ResourceDictionary,
  bindings: WinUIResourceBindings,
  key: string,
): void {
  const map = asResourceMap(dictionary, bindings)
  const resourceKey = createResourceKey(bindings, key)
  if (map.hasKey(resourceKey)) {
    map.remove(resourceKey)
  }
}

function getMergedDictionaries(
  dictionary: ResourceDictionary,
): ResourceDictionary[] {
  const merged = dictionary.mergedDictionaries
  if (!merged) {
    return []
  }
  const values: ResourceDictionary[] = []
  for (let index = merged.size - 1; index >= 0; index -= 1) {
    values.push(merged.getAt(index))
  }
  return values
}

function lookupMapValue(
  map: ResourceMap,
  bindings: WinUIResourceBindings,
  key: string,
): ResourceSnapshot {
  const resourceKey = createResourceKey(bindings, key)
  if (!map.hasKey(resourceKey)) {
    return { exists: false }
  }
  return {
    exists: true,
    value: map.lookup(resourceKey),
  }
}

function resolveStaticResource(
  dictionary: ResourceDictionary,
  bindings: WinUIResourceBindings,
  key: string,
  visited = new Set<ResourceDictionary>(),
): ResourceSnapshot {
  if (visited.has(dictionary)) {
    return { exists: false }
  }
  visited.add(dictionary)

  const direct = readEntry(dictionary, bindings, key)
  if (direct.exists) {
    return direct
  }
  for (const merged of getMergedDictionaries(dictionary)) {
    const resolved = resolveStaticResource(
      merged,
      bindings,
      key,
      visited,
    )
    if (resolved.exists) {
      return resolved
    }
  }
  return { exists: false }
}

function resolveThemeResource(
  dictionary: ResourceDictionary,
  bindings: WinUIResourceBindings,
  key: string,
  themeName: string,
  visited = new Set<ResourceDictionary>(),
): ResourceSnapshot {
  if (visited.has(dictionary)) {
    return { exists: false }
  }
  visited.add(dictionary)

  const themeDictionaries = dictionary.themeDictionaries
  if (themeDictionaries) {
    for (const candidate of [...new Set([themeName, 'Default'])]) {
      const theme = lookupMapValue(
        themeDictionaries,
        bindings,
        candidate,
      )
      if (
        theme.exists &&
        isObject(theme.value) &&
        typeof (theme.value as Partial<ResourceDictionary>).lookup ===
          'function'
      ) {
        const resolved = resolveStaticResource(
          theme.value as unknown as ResourceDictionary,
          bindings,
          key,
        )
        if (resolved.exists) {
          return resolved
        }
      }
    }
  }

  const direct = readEntry(dictionary, bindings, key)
  if (direct.exists) {
    return direct
  }

  for (const merged of getMergedDictionaries(dictionary)) {
    const resolved = resolveThemeResource(
      merged,
      bindings,
      key,
      themeName,
      visited,
    )
    if (resolved.exists) {
      return resolved
    }
  }

  return { exists: false }
}

function getResourceDictionaries(target: object): ResourceDictionary[] {
  const dictionaries: ResourceDictionary[] = []
  const visited = new Set<object>()
  let current: unknown = target
  while (isObject(current) && !visited.has(current)) {
    visited.add(current)
    const resources = (current as FrameworkElement).resources
    if (resources) {
      dictionaries.push(resources)
    }
    current = (current as FrameworkElement).parent
  }
  return dictionaries
}

function normalizeOverrides(value: unknown): WinUIResourceOverrides {
  if (!isObject(value) || Array.isArray(value) || isResourceReference(value)) {
    throw new TypeError('resourceOverrides must be an object keyed by resource name.')
  }
  for (const [key, entry] of Object.entries(value)) {
    if (!key.trim()) {
      throw new TypeError('resourceOverrides keys cannot be empty.')
    }
    if (entry === undefined) {
      throw new TypeError(
        `resourceOverrides.${key} cannot be undefined; omit the key instead.`,
      )
    }
  }
  return value
}

export function createWinUIResourceRuntime(
  bindings: WinUIResourceBindings,
  customResolver?: RendererOptions['resolveResource'],
): WinUIResourceRuntime | undefined {
  if (
    !bindings.Application ||
    !bindings.IMap_Object_Object ||
    !bindings.PropertyValue
  ) {
    return undefined
  }

  let accessibilitySettings: AccessibilitySettings | undefined
  let highContrastTimer:
    | ReturnType<
        NonNullable<FrameworkElement['dispatcherQueue']>['createTimer']
      >
    | undefined
  let highContrastTimerSubscription: (() => void) | undefined
  let lastHighContrast: boolean | undefined
  const allListeners = new Set<() => void>()
  const themeListeners = new Set<() => void>()

  const notifyAll = () => {
    for (const callback of [...allListeners]) {
      callback()
    }
  }

  const notifyThemeListeners = () => {
    for (const callback of [...themeListeners]) {
      callback()
    }
  }

  const getAccessibilitySettings = () => {
    if (!accessibilitySettings && bindings.AccessibilitySettings) {
      accessibilitySettings = new bindings.AccessibilitySettings()
    }
    return accessibilitySettings
  }

  const ensureHighContrastObservation = (target: object) => {
    if (highContrastTimer || themeListeners.size === 0) {
      return
    }
    const settings = getAccessibilitySettings()
    const dispatcherQueue =
      (target as FrameworkElement).dispatcherQueue
    if (!settings || !dispatcherQueue) {
      return
    }
    lastHighContrast = settings.highContrast
    highContrastTimer = dispatcherQueue.createTimer()
    highContrastTimer.interval = { duration: 2_500_000n }
    highContrastTimer.isRepeating = true
    const unsubscribe = highContrastTimer.onTick(() => {
      const current = getAccessibilitySettings()?.highContrast
      if (
        current !== undefined &&
        current !== lastHighContrast
      ) {
        lastHighContrast = current
        notifyThemeListeners()
      }
    })
    if (typeof unsubscribe === 'function') {
      highContrastTimerSubscription = unsubscribe
    }
    highContrastTimer.start()
  }

  const releaseHighContrastObservation = () => {
    if (themeListeners.size !== 0) {
      return
    }
    const timer = highContrastTimer
    const subscription = highContrastTimerSubscription
    highContrastTimer = undefined
    highContrastTimerSubscription = undefined
    lastHighContrast = undefined
    accessibilitySettings = undefined
    let firstError: unknown
    try {
      timer?.stop()
    }
    catch (error) {
      firstError = error
    }
    try {
      subscription?.()
    }
    catch (error) {
      firstError ??= error
    }
    if (firstError !== undefined) {
      throw firstError
    }
  }

  const getThemeName = (target: object): string => {
    if (getAccessibilitySettings()?.highContrast) {
      return 'HighContrast'
    }

    const visited = new Set<object>()
    let current: unknown = target
    while (isObject(current) && !visited.has(current)) {
      visited.add(current)
      const requestedTheme = (current as FrameworkElement).requestedTheme
      if (
        enumMatches(
          requestedTheme,
          bindings.ElementTheme?.Dark,
          'Dark',
        )
      ) {
        return 'Dark'
      }
      if (
        enumMatches(
          requestedTheme,
          bindings.ElementTheme?.Light,
          'Light',
        )
      ) {
        return 'Light'
      }
      current = (current as FrameworkElement).parent
    }

    const actualTheme = (target as FrameworkElement).actualTheme
    if (
      enumMatches(actualTheme, bindings.ElementTheme?.Dark, 'Dark')
    ) {
      return 'Dark'
    }
    if (
      enumMatches(actualTheme, bindings.ElementTheme?.Light, 'Light')
    ) {
      return 'Light'
    }

    const applicationTheme = bindings.Application?.current?.requestedTheme
    return enumMatches(
        applicationTheme,
        bindings.ApplicationTheme?.Dark,
        'Dark',
      )
      ? 'Dark'
      : 'Light'
  }

  const resolveResource: WinUIResourceRuntime['resolveResource'] = (
    key,
    fallback,
    target,
    kind,
  ) => {
    const dictionaries = getResourceDictionaries(target)
    const application = bindings.Application?.current
    if (application && !dictionaries.includes(application.resources)) {
      dictionaries.push(application.resources)
    }

    if (dictionaries.length === 0) {
      if (fallback !== undefined) {
        return fallback
      }
      throw new Error(
        `No resource dictionaries are available while resolving "${key}".`,
      )
    }

    const themeName = kind === 'theme'
      ? getThemeName(target)
      : undefined
    for (const dictionary of dictionaries) {
      const resolved = themeName
        ? resolveThemeResource(
            dictionary,
            bindings,
            key,
            themeName,
          )
        : resolveStaticResource(dictionary, bindings, key)
      if (resolved.exists) {
        return resolved.value
      }
    }

    if (fallback !== undefined) {
      return fallback
    }
    throw new Error(`Resource "${key}" was not found.`)
  }

  const observeResourceChanges:
    WinUIResourceRuntime['observeResourceChanges'] = (
      target,
      callback,
      kind,
    ) => {
      allListeners.add(callback)
      if (kind === 'theme') {
        themeListeners.add(callback)
      }
      const unsubscribes: Array<() => void> = []
      let active = true
      const cleanup = () => {
        if (!active) {
          return
        }
        active = false
        allListeners.delete(callback)
        themeListeners.delete(callback)
        let firstError: unknown
        for (const unsubscribe of unsubscribes.reverse()) {
          try {
            unsubscribe()
          }
          catch (error) {
            firstError ??= error
          }
        }
        try {
          releaseHighContrastObservation()
        }
        catch (error) {
          firstError ??= error
        }
        if (firstError !== undefined) {
          throw firstError
        }
      }
      try {
        const loaded = (target as FrameworkElement).onLoaded?.(
          callback,
        )
        if (typeof loaded === 'function') {
          unsubscribes.push(loaded)
        }
        if (kind === 'theme') {
          const actualThemeChanged =
            (target as FrameworkElement).onActualThemeChanged?.(
              callback,
            )
          if (typeof actualThemeChanged === 'function') {
            unsubscribes.push(actualThemeChanged)
          }
          ensureHighContrastObservation(target)
        }
      }
      catch (error) {
        let cleanupError: unknown
        try {
          cleanup()
        }
        catch (failure) {
          cleanupError = failure
        }
        if (cleanupError !== undefined) {
          throw new AggregateError(
            [error, cleanupError],
            'Resource observer setup and rollback both failed.',
          )
        }
        throw error
      }
      return cleanup
    }

  const overrideStates = new WeakMap<object, OverrideState>()

  const createOverrideState = (
    target: object,
  ): OverrideState => {
    const element = target as FrameworkElement
    if (!bindings.ResourceDictionary) {
      throw new TypeError(
        'ResourceDictionary is required for resourceOverrides.',
      )
    }
    const originalDictionary = element.resources
    if (!originalDictionary) {
      throw new TypeError(
        `${target.constructor.name} does not expose a ResourceDictionary.`,
      )
    }
    const dictionary = new bindings.ResourceDictionary()
    const merged = dictionary.mergedDictionaries
    if (!merged?.append || !merged.removeAt) {
      throw new TypeError(
        'ResourceDictionary.mergedDictionaries must support append() and removeAt().',
      )
    }
    element.resources = dictionary
    try {
      merged.append(originalDictionary)
    }
    catch (error) {
      element.resources = originalDictionary
      throw new Error(
        'Failed to attach the previous element resources to the override dictionary.',
        { cause: error },
      )
    }
    return {
      target: element,
      originalDictionary,
      dictionary,
      currentValues: new Map(),
      source: undefined,
    }
  }

  const resolveOverrideValue = (
    target: object,
    value: unknown,
  ): unknown => {
    if (!isResourceReference(value)) {
      return value
    }
    return (customResolver ?? resolveResource)(
      value.key,
      value.fallback,
      target,
      value.kind,
    )
  }

  const resourceOverridesSetter: NativePropertySetter = (
    target,
    value,
    scope,
  ) => {
    const overrides = normalizeOverrides(value)
    let state = overrideStates.get(target)
    if (!state) {
      state = createOverrideState(target)
      overrideStates.set(target, state)
      runInScope(scope, () => {
        onCleanup(() => {
          let firstError: unknown
          try {
            const merged = state!.dictionary.mergedDictionaries
            if (!merged?.removeAt || merged.size === 0) {
              throw new Error(
                'The override dictionary lost its original resource dictionary.',
              )
            }
            merged.removeAt(merged.size - 1)
          }
          catch (error) {
            firstError = error
          }
          try {
            state!.target.resources = state!.originalDictionary
          }
          catch (error) {
            firstError ??= error
          }
          finally {
            overrideStates.delete(target)
          }
          if (firstError !== undefined) {
            throw firstError
          }
        })
      })
    }

    const inputChanged = state.source !== overrides
    const resolved = new Map<string, unknown>()
    for (const [key, entry] of Object.entries(overrides)) {
      resolved.set(key, resolveOverrideValue(target, entry))
    }

    const nextKeys = new Set(resolved.keys())
    const affectedKeys = new Set([
      ...state.currentValues.keys(),
      ...nextKeys,
    ])

    try {
      for (const key of state.currentValues.keys()) {
        if (!nextKeys.has(key)) {
          removeEntry(state.dictionary, bindings, key)
        }
      }
      for (const [key, entry] of resolved) {
        writeEntry(state.dictionary, bindings, key, entry)
      }
    }
    catch (error) {
      let rollbackError: unknown
      for (const key of affectedKeys) {
        try {
          removeEntry(state.dictionary, bindings, key)
        }
        catch (rollbackFailure) {
          rollbackError ??= rollbackFailure
        }
      }
      for (const [key, entry] of state.currentValues) {
        try {
          writeEntry(state.dictionary, bindings, key, entry)
        }
        catch (rollbackFailure) {
          rollbackError ??= rollbackFailure
        }
      }
      if (rollbackError !== undefined) {
        throw new AggregateError(
          [error, rollbackError],
          'resourceOverrides update and rollback both failed.',
        )
      }
      throw error
    }

    state.currentValues = resolved
    state.source = overrides
    if (inputChanged) {
      notifyAll()
    }
  }

  return {
    resolveResource,
    observeResourceChanges,
    getResourceObservationKind(property, value) {
      if (isResourceReference(value)) {
        return value.kind
      }
      if (property !== 'resourceOverrides' || !isObject(value)) {
        return undefined
      }
      const entries = Object.values(value)
      if (entries.some(isThemeResourceReference)) {
        return 'theme'
      }
      return entries.some(isResourceReference)
        ? 'static'
        : undefined
    },
    resourceOverridesSetter,
  }
}
