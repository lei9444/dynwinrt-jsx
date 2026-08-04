'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const tutorialRoot = path.join(
  __dirname,
  '..',
  'docs',
  'tutorial-dashboard',
)

test('Dashboard tutorial chapters and relative links stay complete', () => {
  const expected = [
    'README.md',
    '01-create-and-run.md',
    '02-reactive-model.md',
    '03-controls-and-layout.md',
    '04-routing-and-navigation.md',
    '05-task-collection.md',
    '06-dialogs-and-theme.md',
    '07-state-and-persistence.md',
    '08-errors-and-diagnostics.md',
    '09-validation-and-packaging.md',
  ]
  assert.deepEqual(
    fs.readdirSync(tutorialRoot)
      .filter((name) => name.endsWith('.md'))
      .sort(),
    [...expected].sort(),
  )

  for (const name of expected) {
    const filePath = path.join(tutorialRoot, name)
    const source = fs.readFileSync(filePath, 'utf8')
    for (const match of source.matchAll(
      /\[[^\]]+\]\(([^)]+)\)/g,
    )) {
      const target = match[1].split('#')[0]
      if (
        !target ||
        /^(https?:|mailto:)/.test(target)
      ) {
        continue
      }
      assert.equal(
        fs.existsSync(
          path.resolve(path.dirname(filePath), target),
        ),
        true,
        `${name} links to missing ${target}`,
      )
    }
  }
})

test('Dashboard tutorial uses progressive entrypoints and current async API', () => {
  const source = fs.readdirSync(tutorialRoot)
    .filter((name) => name.endsWith('.md'))
    .map((name) =>
      fs.readFileSync(path.join(tutorialRoot, name), 'utf8'))
    .join('\n')

  assert.match(source, /dynwinrt-jsx\/core/)
  assert.match(source, /dynwinrt-jsx\/controls/)
  assert.match(source, /dynwinrt-jsx\/winui/)
  assert.match(source, /dynwinrt-jsx\/diagnostics/)
  assert.match(source, /--template minimal/)
  assert.match(source, /createWinUIControls\(WinUIBindings\)/)
  assert.match(source, /npm run generate/)
  for (const control of [
    'CheckBox',
    'ContentDialog',
    'NavigationView',
    'TextBox',
  ]) {
    assert.match(source, new RegExp(`"${control}"`))
  }
  assert.match(source, /dashboard-shell\.ts/)
  assert.match(source, /context\.throwIfAborted\(\)/)
  assert.match(source, /onCleanup\(themeController\.dispose\)/)
  assert.doesNotMatch(source, /from 'dynwinrt-jsx'/)
})
