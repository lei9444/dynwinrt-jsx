'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createStyleRecipe,
  createWinUIThemeController,
  isSignal,
  signal,
  styles,
  theme,
  tokens,
} = require('../dist/index.js')

test('design tokens expose stable WinUI-ready values', () => {
  assert.equal(tokens.spacing.md, 12)
  assert.deepEqual(tokens.radius.card, {
    topLeft: 8,
    topRight: 8,
    bottomRight: 8,
    bottomLeft: 8,
  })
  assert.deepEqual(tokens.typography.title, {
    fontSize: 28,
    fontWeight: { weight: 700 },
  })
  assert.deepEqual(tokens.elevation.medium, {
    x: 0,
    y: 0,
    z: 16,
  })
})

test('style recipes resolve static and signal-backed variants', () => {
  const opacity = signal(0.75)
  const recipe = createStyleRecipe({
    base: {
      opacity: 1,
      label: 'base',
    },
    variants: {
      tone: {
        normal: {
          opacity: 1,
          label: 'normal',
        },
        muted: {
          opacity,
          label: 'muted',
        },
      },
    },
    defaultVariants: {
      tone: 'normal',
    },
  })

  assert.deepEqual(recipe(), {
    opacity: 1,
    label: 'normal',
  })

  const tone = signal('normal')
  const dynamic = recipe({ tone })
  assert.equal(isSignal(dynamic.opacity), true)
  assert.equal(dynamic.opacity.value, 1)
  assert.equal(dynamic.label.value, 'normal')

  tone.value = 'muted'
  assert.equal(dynamic.opacity.value, 0.75)
  assert.equal(dynamic.label.value, 'muted')

  opacity.value = 0.5
  assert.equal(dynamic.opacity.value, 0.5)
})

test('style recipes reject incomplete and unknown variants', () => {
  assert.throws(
    () => createStyleRecipe({
      base: { opacity: 1 },
      variants: {
        tone: {
          invalid: { missing: true },
        },
      },
    }),
    /base does not define/,
  )

  const recipe = createStyleRecipe({
    base: { opacity: 1 },
    variants: {
      tone: {
        normal: { opacity: 1 },
      },
    },
  })
  assert.throws(
    () => recipe({ missing: 'value' }),
    /Unknown style variant/,
  )
  assert.throws(
    () => recipe({ tone: 'missing' }),
    /Unknown style variant tone=missing/,
  )
  assert.throws(
    () => recipe({ tone: 'toString' }),
    /Unknown style variant tone=toString/,
  )
  assert.throws(
    () => createStyleRecipe({
      base: { opacity: 1 },
      variants: {
        tone: {
          normal: { opacity: 1 },
        },
      },
      defaultVariants: {
        missing: 'normal',
      },
    }),
    /Unknown default style variant/,
  )
})

test('built-in recipes preserve native theme resources', () => {
  const card = styles.card({
    density: 'spacious',
    surface: 'layer',
  })
  assert.deepEqual(card.padding, {
    left: 24,
    top: 24,
    right: 24,
    bottom: 24,
  })
  assert.equal(card.background, theme.layerFill)

  const accent = styles.button({ variant: 'accent' })
  assert.equal(
    accent.resourceOverrides.ButtonBackground,
    theme.accent,
  )
})

test('theme controller synchronizes application, element, and title bar themes', () => {
  const isDark = signal(false)
  const application = { requestedTheme: 'unset' }
  const titleBar = { preferredTheme: 'unset' }
  const controller = createWinUIThemeController({
    isDark,
    setDark(value) {
      isDark.value = value
    },
    application,
    applicationTheme: {
      Light: 'app-light',
      Dark: 'app-dark',
    },
    elementTheme: {
      Light: 'element-light',
      Dark: 'element-dark',
    },
    titleBar,
    titleBarTheme: {
      Light: 'title-light',
      Dark: 'title-dark',
    },
  })

  assert.equal(application.requestedTheme, 'app-light')
  assert.equal(titleBar.preferredTheme, 'title-light')
  assert.equal(controller.requestedTheme.value, 'element-light')

  controller.setDark(true)
  assert.equal(application.requestedTheme, 'app-dark')
  assert.equal(titleBar.preferredTheme, 'title-dark')
  assert.equal(controller.requestedTheme.value, 'element-dark')

  controller.toggle()
  assert.equal(isDark.value, false)
  controller.dispose()

  isDark.value = true
  assert.equal(application.requestedTheme, 'app-light')
  assert.equal(titleBar.preferredTheme, 'title-light')
})

test('theme controller requires matching title bar theme values', () => {
  assert.throws(
    () => createWinUIThemeController({
      isDark: signal(false),
      setDark() {},
      application: { requestedTheme: 0 },
      applicationTheme: { Light: 0, Dark: 1 },
      elementTheme: { Light: 0, Dark: 1 },
      titleBar: { preferredTheme: 0 },
    }),
    /must be provided together/,
  )
})
