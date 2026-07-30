'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
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
    3,
  )
})
