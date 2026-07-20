'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createControls,
  createWinUIRenderer,
  resource,
  signal,
  theme,
  themeResource,
} = require('../dist/index.js')

class TestMap {
  constructor(entries = []) {
    this.values = new Map(entries)
    this.failKey = null
  }

  lookup(key) {
    if (!this.values.has(key)) {
      throw new Error(`Missing key: ${key}`)
    }
    return this.values.get(key)
  }

  hasKey(key) {
    return this.values.has(key)
  }

  insert(key, value) {
    if (key === this.failKey) {
      throw new Error(`Cannot insert ${key}`)
    }
    const replaced = this.values.has(key)
    this.values.set(key, value)
    return replaced
  }

  remove(key) {
    this.values.delete(key)
  }
}

class TestVector {
  constructor(values = []) {
    this.values = values
  }

  get size() {
    return this.values.length
  }

  getAt(index) {
    return this.values[index]
  }

  append(value) {
    this.values.push(value)
  }

  removeAt(index) {
    this.values.splice(index, 1)
  }
}

class TestResourceDictionary extends TestMap {
  constructor(entries = []) {
    super(entries)
    this.mergedDictionaries = new TestVector()
    this.themeDictionaries = new TestMap()
  }
}

class TestAccessibilitySettings {
  static current

  constructor() {
    TestAccessibilitySettings.current = this
    this.highContrast = false
  }
}

class TestTimer {
  static current

  constructor() {
    TestTimer.current = this
    this.interval = { duration: 0n }
    this.isRepeating = false
    this.listeners = new Set()
    this.running = false
  }

  onTick(callback) {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  start() {
    this.running = true
  }

  stop() {
    this.running = false
  }

  tick() {
    for (const listener of [...this.listeners]) {
      listener(this, {})
    }
  }
}

class TestWindow {
  constructor() {
    this.content = null
  }
}

class TestElement {
  static parent = null
  static initialResources = []
  static throwOnLoadedUnsubscribe = false
  static current

  constructor() {
    TestElement.current = this
    this.parent = TestElement.parent
    this.resources = new TestResourceDictionary(
      TestElement.initialResources,
    )
    this.originalResources = this.resources
    this.requestedTheme = 'Default'
    this.actualTheme = 'Dark'
    this.foreground = null
    this.listeners = new Set()
    this.loadedListeners = new Set()
    this.dispatcherQueue = {
      createTimer() {
        return new TestTimer()
      },
    }
  }

  onActualThemeChanged(callback) {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  onLoaded(callback) {
    this.loadedListeners.add(callback)
    return () => {
      if (TestElement.throwOnLoadedUnsubscribe) {
        throw new Error('loaded unsubscribe failed')
      }
      this.loadedListeners.delete(callback)
    }
  }

  emitLoaded() {
    for (const listener of [...this.loadedListeners]) {
      listener(this, {})
    }
  }

  emitThemeChanged() {
    for (const listener of [...this.listeners]) {
      listener(this, {})
    }
  }
}

function createThemeDictionary(light, dark, highContrast) {
  const resources = new TestResourceDictionary()
  resources.themeDictionaries.insert(
    'Light',
    new TestResourceDictionary(light),
  )
  resources.themeDictionaries.insert(
    'Default',
    new TestResourceDictionary(dark),
  )
  resources.themeDictionaries.insert(
    'HighContrast',
    new TestResourceDictionary(highContrast),
  )
  return resources
}

function createBindings(applicationResources) {
  return {
    AccessibilitySettings: TestAccessibilitySettings,
    Application: {
      current: {
        resources: applicationResources,
        requestedTheme: 'Light',
      },
    },
    ApplicationTheme: {
      Dark: 'Dark',
      Light: 'Light',
    },
    ElementTheme: {
      Dark: 'Dark',
      Light: 'Light',
    },
    IMap_Object_Object: {},
    PropertyValue: {
      createString(value) {
        return value
      },
    },
    ResourceDictionary: TestResourceDictionary,
  }
}

test('typed theme resources resolve against the nearest effective theme', () => {
  const applicationResources = createThemeDictionary(
    [['AccentFillColorDefaultBrush', 'app-light']],
    [['AccentFillColorDefaultBrush', 'app-dark']],
    [['AccentFillColorDefaultBrush', 'app-high-contrast']],
  )
  const parent = new TestElement()
  parent.requestedTheme = 'Dark'
  parent.resources = createThemeDictionary(
    [['AccentFillColorDefaultBrush', 'parent-light']],
    [['AccentFillColorDefaultBrush', 'parent-dark']],
    [['AccentFillColorDefaultBrush', 'parent-high-contrast']],
  )
  TestElement.parent = parent
  const UI = createControls({ Element: TestElement })
  let element
  const handle = createWinUIRenderer(
    createBindings(applicationResources),
  ).render(
    UI.Element({
      ref(value) {
        element = value
      },
      foreground: theme.accent,
    }),
    new TestWindow(),
  )

  assert.equal(element.foreground, 'parent-dark')

  parent.requestedTheme = 'Light'
  element.emitThemeChanged()
  assert.equal(element.foreground, 'parent-light')

  TestAccessibilitySettings.current.highContrast = true
  TestTimer.current.tick()
  assert.equal(element.foreground, 'parent-high-contrast')

  const mountedElement = element
  handle.dispose()
  assert.equal(mountedElement.listeners.size, 0)
  assert.equal(mountedElement.loadedListeners.size, 0)
  assert.equal(TestTimer.current.listeners.size, 0)
  assert.equal(TestTimer.current.running, false)
  TestElement.parent = null
})

test('resource overrides update transactionally and restore on cleanup', () => {
  TestElement.parent = null
  const applicationResources = createThemeDictionary(
    [
      ['AccentFillColorDefaultBrush', 'light-accent'],
      ['TextFillColorSecondaryBrush', 'light-secondary'],
    ],
    [
      ['AccentFillColorDefaultBrush', 'dark-accent'],
      ['TextFillColorSecondaryBrush', 'dark-secondary'],
    ],
    [
      ['AccentFillColorDefaultBrush', 'hc-accent'],
      ['TextFillColorSecondaryBrush', 'hc-secondary'],
    ],
  )
  const overrides = signal({
    ButtonBackground: theme.accent,
    LocalValue: 1,
  })

  const errors = []
  TestElement.initialResources = [['ButtonBackground', 'original']]
  const UI = createControls({ Element: TestElement })
  let element
  const handle = createWinUIRenderer(
    createBindings(applicationResources),
    {
      onError(error) {
        errors.push(error)
      },
    },
  ).render(
    UI.Element({
      ref(value) {
        element = value
      },
      resourceOverrides: overrides,
    }),
    new TestWindow(),
  )

  assert.equal(element.resources.lookup('ButtonBackground'), 'dark-accent')
  assert.equal(element.resources.lookup('LocalValue'), 1)

  overrides.value = {
    ButtonBackground: theme.secondaryText,
  }
  assert.equal(
    element.resources.lookup('ButtonBackground'),
    'dark-secondary',
  )
  assert.equal(element.resources.hasKey('LocalValue'), false)

  element.resources.failKey = 'Broken'
  overrides.value = {
    ButtonBackground: theme.accent,
    Broken: 2,
  }
  assert.equal(errors.length, 1)
  assert.equal(
    element.resources.lookup('ButtonBackground'),
    'dark-secondary',
  )
  assert.equal(element.resources.hasKey('Broken'), false)

  element.resources.failKey = null
  overrides.value = {
    ButtonBackground: themeResource(
      'AccentFillColorDefaultBrush',
    ),
  }
  element.actualTheme = 'Light'
  element.emitThemeChanged()
  assert.equal(
    element.resources.lookup('ButtonBackground'),
    'light-accent',
  )

  const mountedElement = element
  handle.dispose()
  assert.equal(
    mountedElement.resources.lookup('ButtonBackground'),
    'original',
  )
  assert.equal(mountedElement.resources.hasKey('LocalValue'), false)
  TestElement.initialResources = []
})

test('theme resources resolve again after an element joins its parent', () => {
  const applicationResources = createThemeDictionary(
    [['TextFillColorPrimaryBrush', 'app-light']],
    [['TextFillColorPrimaryBrush', 'app-dark']],
    [['TextFillColorPrimaryBrush', 'app-hc']],
  )
  const parent = new TestElement()
  parent.resources = createThemeDictionary(
    [['TextFillColorPrimaryBrush', 'parent-light']],
    [['TextFillColorPrimaryBrush', 'parent-dark']],
    [['TextFillColorPrimaryBrush', 'parent-hc']],
  )
  TestElement.parent = null
  const UI = createControls({ Element: TestElement })
  let element
  const handle = createWinUIRenderer(
    createBindings(applicationResources),
  ).render(
    UI.Element({
      ref(value) {
        element = value
      },
      foreground: theme.primaryText,
    }),
    new TestWindow(),
  )

  assert.equal(element.foreground, 'app-dark')
  element.parent = parent
  element.emitLoaded()
  assert.equal(element.foreground, 'parent-dark')

  handle.dispose()
})

test('static resources resolve again after an element joins its parent', () => {
  const applicationResources = new TestResourceDictionary([
    ['LocalValue', 'application'],
  ])
  const parent = new TestElement()
  parent.resources = new TestResourceDictionary([
    ['LocalValue', 'parent'],
  ])
  TestElement.parent = null
  const UI = createControls({ Element: TestElement })
  let element
  const handle = createWinUIRenderer(
    createBindings(applicationResources),
  ).render(
    UI.Element({
      ref(value) {
        element = value
      },
      foreground: resource('LocalValue'),
    }),
    new TestWindow(),
  )

  assert.equal(element.foreground, 'application')
  element.parent = parent
  element.emitLoaded()
  assert.equal(element.foreground, 'parent')

  handle.dispose()
})

test('resource lookup prefers primary entries and later merged dictionaries', () => {
  const resources = new TestResourceDictionary([
    ['AccentFillColorDefaultBrush', 'primary'],
  ])
  const first = createThemeDictionary(
    [['AccentFillColorDefaultBrush', 'first-light']],
    [['AccentFillColorDefaultBrush', 'first-dark']],
    [['AccentFillColorDefaultBrush', 'first-hc']],
  )
  const second = createThemeDictionary(
    [['AccentFillColorDefaultBrush', 'second-light']],
    [['AccentFillColorDefaultBrush', 'second-dark']],
    [['AccentFillColorDefaultBrush', 'second-hc']],
  )
  resources.mergedDictionaries.append(first)
  resources.mergedDictionaries.append(second)
  const UI = createControls({ Element: TestElement })
  let element
  const handle = createWinUIRenderer(createBindings(resources)).render(
    UI.Element({
      ref(value) {
        element = value
      },
      foreground: theme.accent,
    }),
    new TestWindow(),
  )

  assert.equal(element.foreground, 'primary')
  resources.remove('AccentFillColorDefaultBrush')
  element.emitThemeChanged()
  assert.equal(element.foreground, 'second-dark')

  handle.dispose()
})

test('resource observers stop when a signal changes to a literal', () => {
  const resources = createThemeDictionary(
    [['TextFillColorPrimaryBrush', 'light']],
    [['TextFillColorPrimaryBrush', 'dark']],
    [['TextFillColorPrimaryBrush', 'hc']],
  )
  const foreground = signal(theme.primaryText)
  const UI = createControls({ Element: TestElement })
  let element
  const handle = createWinUIRenderer(createBindings(resources)).render(
    UI.Element({
      ref(value) {
        element = value
      },
      foreground,
    }),
    new TestWindow(),
  )

  assert.equal(TestTimer.current.running, true)
  assert.equal(element.listeners.size, 1)
  assert.equal(element.loadedListeners.size, 1)

  foreground.value = 'literal'
  assert.equal(element.foreground, 'literal')
  assert.equal(TestTimer.current.running, false)
  assert.equal(element.listeners.size, 0)
  assert.equal(element.loadedListeners.size, 0)

  handle.dispose()
})

test('failed native unsubscribe does not retain polling or block literals', () => {
  const resources = createThemeDictionary(
    [['TextFillColorPrimaryBrush', 'light']],
    [['TextFillColorPrimaryBrush', 'dark']],
    [['TextFillColorPrimaryBrush', 'hc']],
  )
  const foreground = signal(theme.primaryText)
  const errors = []
  const UI = createControls({ Element: TestElement })
  let element
  const handle = createWinUIRenderer(createBindings(resources), {
    onError(error) {
      errors.push(error)
    },
  }).render(
    UI.Element({
      ref(value) {
        element = value
      },
      foreground,
    }),
    new TestWindow(),
  )

  TestElement.throwOnLoadedUnsubscribe = true
  foreground.value = 'literal'
  assert.equal(element.foreground, 'literal')
  assert.equal(TestTimer.current.running, false)
  assert.equal(errors.length, 1)

  TestElement.throwOnLoadedUnsubscribe = false
  handle.dispose()
})

test('observer setup failure rolls back built-in subscriptions', () => {
  const resources = createThemeDictionary(
    [['TextFillColorPrimaryBrush', 'light']],
    [['TextFillColorPrimaryBrush', 'dark']],
    [['TextFillColorPrimaryBrush', 'hc']],
  )
  const errors = []
  const UI = createControls({ Element: TestElement })
  const handle = createWinUIRenderer(createBindings(resources), {
    observeResourceChanges() {
      throw new Error('custom observer failed')
    },
    onError(error) {
      errors.push(error)
    },
  }).render(
    UI.Element({
      foreground: theme.primaryText,
    }),
    new TestWindow(),
  )

  assert.equal(errors.length, 1)
  assert.equal(TestElement.current.listeners.size, 0)
  assert.equal(TestElement.current.loadedListeners.size, 0)
  assert.equal(TestTimer.current.running, false)

  handle.dispose()
})

test('theme resource fallbacks remain explicit', () => {
  const resources = new TestResourceDictionary()
  const UI = createControls({ Element: TestElement })
  let element
  const handle = createWinUIRenderer(createBindings(resources)).render(
    UI.Element({
      ref(value) {
        element = value
      },
      foreground: themeResource('MissingBrush', 'fallback'),
    }),
    new TestWindow(),
  )

  assert.equal(element.foreground, 'fallback')
  handle.dispose()
})

test('resource overrides use the configured custom resolver', () => {
  const UI = createControls({ Element: TestElement })
  let element
  let resolvedTarget
  const handle = createWinUIRenderer(
    createBindings(new TestResourceDictionary()),
    {
      resolveResource(key, _fallback, target, kind) {
        resolvedTarget = target
        return `${kind}:${key}`
      },
    },
  ).render(
    UI.Element({
      ref(value) {
        element = value
      },
      resourceOverrides: {
        CustomBrush: theme.ref('CustomBrushSource'),
      },
    }),
    new TestWindow(),
  )

  assert.equal(
    element.resources.lookup('CustomBrush'),
    'theme:CustomBrushSource',
  )
  assert.equal(resolvedTarget, element)
  handle.dispose()
})

test('empty resource overrides do not wrap the element dictionary', () => {
  const UI = createControls({ Element: TestElement })
  const handle = createWinUIRenderer(
    createBindings(new TestResourceDictionary()),
  ).render(
    UI.Element({
      resourceOverrides: {},
    }),
    new TestWindow(),
  )

  assert.equal(
    TestElement.current.resources,
    TestElement.current.originalResources,
  )
  handle.dispose()
})
