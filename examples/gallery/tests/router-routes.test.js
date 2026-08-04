'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  allControlsPages,
  galleryPages,
} = require('../dist/gallery-data.js')

function collectRouteFiles(directory) {
  const files = []
  for (const entry of fs.readdirSync(directory, {
    withFileTypes: true,
  })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectRouteFiles(entryPath))
    }
    else if (entry.name === 'routes.tsx') {
      files.push(entryPath)
    }
  }
  return files
}

test('page route modules cover every Gallery page exactly once', () => {
  const pagesRoot = path.join(
    __dirname,
    '..',
    'src',
    'pages',
  )
  const routeIds = collectRouteFiles(pagesRoot)
    .flatMap((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8')
      return [...source.matchAll(/\bid:\s*'([^']+)'/g)]
        .map((match) => match[1])
    })
  const pageIds = galleryPages.map((page) => page.id)

  for (const pageId of pageIds) {
    assert.equal(
      routeIds.filter((routeId) => routeId === pageId).length,
      1,
      `Expected one route for Gallery page '${pageId}'.`,
    )
  }
})

test('page route modules keep page implementations lazy', () => {
  const pagesRoot = path.join(
    __dirname,
    '..',
    'src',
    'pages',
  )
  const sources = collectRouteFiles(pagesRoot)
    .filter(
      (filePath) =>
        path.dirname(filePath) !== pagesRoot,
    )
    .map(
      (filePath) => fs.readFileSync(filePath, 'utf8'),
    )

  for (const source of sources) {
    assert.doesNotMatch(
      source,
      /^import \{ \w+Page \} from '\.\//m,
    )
  }
  const rootRoutes = fs.readFileSync(
    path.join(pagesRoot, 'routes.tsx'),
    'utf8',
  )
  assert.doesNotMatch(
    rootRoutes,
    /^import \{ (Search|Diagnostics|Settings)Page \} from '\.\//m,
  )
  assert.equal(
    sources.reduce(
      (count, source) =>
        count +
        [...source.matchAll(/\bcreateLazyComponent\(/g)].length,
      0,
    ),
    140,
  )
  assert.equal(
    [...rootRoutes.matchAll(/\bcreateLazyComponent\(/g)].length,
    4,
  )
})

test('All controls matches the original regular catalog', () => {
  assert.equal(allControlsPages.length, 105)
  assert.deepEqual(
    allControlsPages.map((page) => page.title),
    [...allControlsPages]
      .map((page) => page.title)
      .sort((left, right) => left.localeCompare(right)),
  )
  for (const category of [
    'Framework',
    'Fundamentals',
    'Design',
    'Accessibility',
  ]) {
    assert.equal(
      allControlsPages.some(
        (page) => page.category === category,
      ),
      false,
    )
  }
  const webView = allControlsPages.find(
    (page) => page.title === 'WebView2',
  )
  assert.equal(webView.enabled, false)
})

test('All navigation item targets the All route', () => {
  const shellSource = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'src',
      'gallery-shell.tsx',
    ),
    'utf8',
  )
  assert.match(
    shellSource,
    /name:\s*'all-controls',\s*routeId:\s*'all-controls'/s,
  )
})

test('Color sections retain the complete original guidance catalog', () => {
  const colorSections = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        '..',
        'src',
        'pages',
        'design',
        'color-sections-data.json',
      ),
      'utf8',
    ),
  )
  const expected = {
    Text: { groups: 3, tiles: 12 },
    Fill: { groups: 7, tiles: 28 },
    Stroke: { groups: 7, tiles: 21 },
    Background: { groups: 9, tiles: 24 },
    Signal: { groups: 1, tiles: 13 },
  }

  for (const [section, counts] of Object.entries(expected)) {
    const groups = colorSections[section]
    const tiles = groups.flatMap((group) =>
      group.grids.flatMap((grid) => grid.tiles),
    )
    assert.equal(groups.length, counts.groups)
    assert.equal(tiles.length, counts.tiles)
    assert.equal(
      tiles.every(
        (tile) =>
          tile.resource.length > 0 ||
          (
            tile.backdrop &&
            tile.label.length > 0
          ),
      ),
      true,
    )
  }

  assert.deepEqual(
    colorSections.Text.map((group) => group.title),
    ['Text', 'Accent Text', 'Text On Accent'],
  )
  assert.equal(
    colorSections.Signal[0].grids.at(-1).tiles.at(-1).resource,
    'SystemFillColorSolidAttentionBackgroundBrush',
  )
})
