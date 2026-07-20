'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createUri,
  createRelativeUri,
  createBitmapImage,
  createBitmapIcon,
  createFontFamily,
  createSolidColorBrush,
  createReferenceBoxing,
  boxNullable,
  unboxReference,
} = require('../dist/index.js')

class TestUri {
  constructor(a, b) {
    this.uri = a
    this.relativeUri = b
  }
}

class TestBitmapImage {
  uriSource = null
  decodePixelWidth = 0
  decodePixelHeight = 0
}

class TestBitmapIcon {
  uriSource = null
  showAsMonochrome = false
}

class TestFontFamily {
  constructor(familyName) {
    this.source = familyName
  }
}

class TestSolidColorBrush {
  constructor(color) {
    this.color = color
  }
}

class TestReference {
  constructor(boxed) {
    this.boxed = boxed
  }

  get value() {
    return this.boxed
  }

  static from(boxed) {
    return new TestReference(boxed)
  }
}

test('createUri validates and constructs from a single URI string', () => {
  const uri = createUri(TestUri, 'ms-appx:///Assets/logo.png')
  assert.equal(uri.uri, 'ms-appx:///Assets/logo.png')
  assert.throws(() => createUri(TestUri, ''), /cannot be empty/)
  assert.throws(() => createUri(TestUri, undefined), /cannot be empty/)
})

test('createRelativeUri validates both segments and constructs', () => {
  const uri = createRelativeUri(TestUri, 'ms-appx:///Assets/', 'logo.png')
  assert.equal(uri.uri, 'ms-appx:///Assets/')
  assert.equal(uri.relativeUri, 'logo.png')
  assert.throws(
    () => createRelativeUri(TestUri, '', 'logo.png'),
    /Base URI cannot be empty/,
  )
  assert.throws(
    () => createRelativeUri(TestUri, 'ms-appx:///Assets/', ''),
    /Relative URI cannot be empty/,
  )
})

test('createBitmapImage sets uriSource and validated decode pixel options', () => {
  const uriSource = { uri: 'ms-appx:///Assets/logo.png' }
  const image = createBitmapImage(TestBitmapImage, uriSource, {
    decodePixelWidth: 48,
    decodePixelHeight: 48,
  })
  assert.equal(image.uriSource, uriSource)
  assert.equal(image.decodePixelWidth, 48)
  assert.equal(image.decodePixelHeight, 48)

  assert.throws(
    () => createBitmapImage(TestBitmapImage, null),
    /cannot be null or undefined/,
  )
  assert.throws(
    () => createBitmapImage(TestBitmapImage, uriSource, { decodePixelWidth: -1 }),
    /must be a finite, non-negative number/,
  )
})

test('createBitmapIcon sets uriSource and optional showAsMonochrome', () => {
  const uriSource = { uri: 'ms-appx:///Assets/icon.png' }
  const icon = createBitmapIcon(TestBitmapIcon, uriSource, {
    showAsMonochrome: true,
  })
  assert.equal(icon.uriSource, uriSource)
  assert.equal(icon.showAsMonochrome, true)

  const iconDefault = createBitmapIcon(TestBitmapIcon, uriSource)
  assert.equal(iconDefault.showAsMonochrome, false)

  assert.throws(
    () => createBitmapIcon(TestBitmapIcon, undefined),
    /cannot be null or undefined/,
  )
})

test('createFontFamily validates the family name', () => {
  const family = createFontFamily(TestFontFamily, 'Segoe UI')
  assert.equal(family.source, 'Segoe UI')
  assert.throws(() => createFontFamily(TestFontFamily, ''), /cannot be empty/)
})

test('createSolidColorBrush validates color channels before constructing', () => {
  const brush = createSolidColorBrush(TestSolidColorBrush, {
    a: 255,
    r: 10,
    g: 20,
    b: 30,
  })
  assert.deepEqual(brush.color, { a: 255, r: 10, g: 20, b: 30 })

  assert.throws(
    () =>
      createSolidColorBrush(TestSolidColorBrush, {
        a: 256,
        r: 0,
        g: 0,
        b: 0,
      }),
    /must be an integer between 0 and 255/,
  )
  assert.throws(
    () =>
      createSolidColorBrush(TestSolidColorBrush, {
        a: 255,
        r: -1,
        g: 0,
        b: 0,
      }),
    /must be an integer between 0 and 255/,
  )
  assert.throws(
    () =>
      createSolidColorBrush(TestSolidColorBrush, {
        a: 255,
        r: 1.5,
        g: 0,
        b: 0,
      }),
    /must be an integer between 0 and 255/,
  )
})

test('boxNullable boxes present values and passes through null/undefined', () => {
  const boxing = createReferenceBoxing((value) => ({ raw: value }), TestReference)

  const boxed = boxNullable(boxing, 42)
  assert.ok(boxed instanceof TestReference)
  assert.deepEqual(boxed.value, { raw: 42 })

  assert.equal(boxNullable(boxing, null), null)
  assert.equal(boxNullable(boxing, undefined), null)
})

test('unboxReference reads the value accessor or returns null', () => {
  const reference = TestReference.from(7)
  assert.equal(unboxReference(reference), 7)
  assert.equal(unboxReference(null), null)
  assert.equal(unboxReference(undefined), null)
})
