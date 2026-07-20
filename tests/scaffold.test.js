'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const test = require('node:test')

const {
  createProject,
} = require('../bin/create.js')

function createTempDirectory(t) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'dynwinrt-jsx-'),
  )
  t.after(() => {
    fs.rmSync(directory, { recursive: true, force: true })
  })
  return directory
}

function readManifest(directory) {
  return JSON.parse(
    fs.readFileSync(path.join(directory, 'package.json'), 'utf8'),
  )
}

function generatedClasses(manifest, namespace) {
  return manifest.winapp.jsBindings.additionalWinmds
    .find((entry) => entry.namespace === namespace)
    ?.classes ?? []
}

function assertLifetimeTeardownSource(workerSource) {
  assert.match(workerSource, /createProjectedLifetimeScope/)
  assert.match(workerSource, /appWindow\.onClosing/)
  assert.match(
    workerSource,
    /if \(attempt\(\(\) => \{\s*hotSession\?\.dispose\(\)\s*\}\)\) \{\s*hotSession = undefined\s*\}/s,
  )
  assert.match(
    workerSource,
    /if \(attempt\(\(\) => \{\s*renderHandle\?\.dispose\(\)\s*\}\)\) \{\s*renderHandle = undefined\s*\}/s,
  )
  assert.match(
    workerSource,
    /if \(attempt\(\(\) => \{\s*model\?\.dispose\(\)\s*\}\)\) \{\s*model = undefined\s*\}/s,
  )
  assert.match(workerSource, /let projectionError: unknown/)
  assert.match(
    workerSource,
    /if \(projectionError === undefined\) \{[\s\S]*projectionLifetime = undefined[\s\S]*\} else \{\s*args\.cancel = true\s*\}/,
  )
  assert.doesNotMatch(
    workerSource,
    /args\.cancel = true[\s\S]{0,80}throw/,
  )
  assert.match(
    workerSource,
    /if \(firstError === undefined\) \{\s*exitCode = 0\s*\}/s,
  )
  assert.match(
    workerSource,
    /try \{\s*unsubscribe\?\.\(\)\s*\} finally \{\s*Application\.current\.exit\(\)\s*\}/s,
  )
}

test('create scaffolds a WinUI project with pinned dependencies', (t) => {
  const temp = createTempDirectory(t)
  const target = path.join(temp, 'My Native App')
  createProject(target)

  const manifest = readManifest(target)
  assert.equal(manifest.name, 'my-native-app')
  assert.deepEqual(manifest.dependencies, {
    '@microsoft/dynwinrt': '0.1.0',
    'dynwinrt-jsx': '1.0.0',
  })
  assert.deepEqual(manifest.devDependencies, {
    '@microsoft/dynwinrt-codegen': '0.1.0',
    '@microsoft/winappcli': '1.0.0',
    typescript: '5.9.2',
  })
  assert.ok(fs.existsSync(path.join(target, '.gitignore')))
  assert.ok(
    fs.existsSync(path.join(target, 'src', 'winui-worker.tsx')),
  )
  assert.ok(fs.existsSync(path.join(target, 'src', 'app.tsx')))
  assert.ok(fs.existsSync(path.join(target, 'src', 'app-model.ts')))
  assert.ok(fs.existsSync(path.join(target, 'src', 'app-state.ts')))
  assert.ok(fs.existsSync(path.join(target, 'dev.js')))
  assert.equal(manifest.scripts.dev, 'node dev.js')
  assert.deepEqual(manifest.imports['#winapp/bindings'], {
    types: './.winapp/bindings/index.d.ts',
    require: './.winapp/bindings/index.js',
    default: './.winapp/bindings/index.js',
  })
  const workerSource = fs.readFileSync(
    path.join(target, 'src', 'winui-worker.tsx'),
    'utf8',
  )
  assertLifetimeTeardownSource(workerSource)
  const controls = manifest.winapp.jsBindings.additionalWinmds
    .find((entry) =>
      entry.namespace === 'Microsoft.UI.Xaml.Controls'
    )
    .classes
  for (const control of [
    'BitmapIcon',
    'ContentDialog',
    'Flyout',
    'Image',
    'ListView',
    'ListViewItem',
    'MenuFlyout',
    'MenuFlyoutItem',
    'MenuFlyoutSeparator',
    'NavigationView',
    'NavigationViewItem',
    'SymbolIcon',
    'TeachingTip',
  ]) {
    assert.ok(controls.includes(control))
  }
  assert.ok(
    manifest.winapp.jsBindings.additionalWinmds.some(
      (entry) =>
        entry.namespace === 'Microsoft.UI.Xaml.Automation' &&
        entry.classes.includes('AutomationProperties'),
    ),
  )
  for (const [namespace, className] of [
    ['Windows.Foundation', 'Uri'],
    ['Microsoft.UI.Xaml.Media', 'FontFamily'],
    ['Microsoft.UI.Xaml.Media', 'SolidColorBrush'],
    ['Microsoft.UI.Xaml.Media.Imaging', 'BitmapImage'],
  ]) {
    assert.ok(
    manifest.winapp.jsBindings.additionalWinmds.some(
      (entry) =>
        entry.namespace === namespace &&
        entry.classes.includes(className),
    ),
    )
  }
})

test('dashboard and template keep lifetime teardown retry-safe', () => {
  for (const workerPath of [
    path.join(
      __dirname,
      '..',
      'templates',
      'winui',
      'src',
      'winui-worker.tsx',
    ),
    path.join(
      __dirname,
      '..',
      'examples',
      'dashboard',
      'src',
      'winui-worker.tsx',
    ),
  ]) {
    assertLifetimeTeardownSource(fs.readFileSync(workerPath, 'utf8'))
  }
})

test('create configures sibling repositories in local mode', (t) => {
  const temp = createTempDirectory(t)
  const localRoot = path.join(temp, 'work')
  const target = path.join(temp, 'projects', 'local-app')
  for (const directory of [
    path.join(localRoot, 'dynwinrt', 'bindings', 'js'),
    path.join(localRoot, 'dynwinrt-jsx'),
    path.join(localRoot, 'winappCli', 'src', 'winapp-npm'),
  ]) {
    fs.mkdirSync(directory, { recursive: true })
  }

  createProject(target, { localRoot })
  const manifest = readManifest(target)
  for (const dependency of [
    ...Object.values(manifest.dependencies),
    ...Object.values(manifest.devDependencies),
  ]) {
    assert.doesNotMatch(dependency, /latest|\^|~/)
  }
  assert.match(
    manifest.dependencies['@microsoft/dynwinrt'],
    /^file:/,
  )
  assert.equal(
    manifest.devDependencies['@microsoft/dynwinrt-codegen'],
    'file:tools/local-codegen',
  )
  assert.match(manifest.scripts.setup, /build:codegen/)
  assert.ok(
    fs.existsSync(
      path.join(target, 'tools', 'local-codegen', 'cli.js'),
    ),
  )
})

test('dashboard and template include Phase 2 WinMD roots', () => {
  const template = readManifest(
    path.join(__dirname, '..', 'templates', 'winui'),
  )
  const dashboard = readManifest(
    path.join(__dirname, '..', 'examples', 'dashboard'),
  )
  const expected = new Map([
    ['Windows.Foundation', ['Uri']],
    ['Microsoft.UI.Xaml.Controls', [
      'BitmapIcon',
      'Flyout',
      'Image',
      'ListView',
      'ListViewItem',
      'MenuFlyout',
      'MenuFlyoutItem',
      'MenuFlyoutSeparator',
      'TeachingTip',
    ]],
    ['Microsoft.UI.Xaml.Controls.Primitives', ['Selector']],
    ['Microsoft.UI.Xaml.Media', ['FontFamily', 'SolidColorBrush']],
    ['Microsoft.UI.Xaml.Media.Imaging', ['BitmapImage']],
  ])

  for (const [namespace, classNames] of expected) {
    for (const manifest of [template, dashboard]) {
      const classes = generatedClasses(manifest, namespace)
      for (const className of classNames) {
        assert.ok(
          classes.includes(className),
          `${namespace}.${className} is missing`,
        )
      }
    }
  }
})

test('create refuses to overwrite a non-empty directory', (t) => {
  const temp = createTempDirectory(t)
  fs.writeFileSync(path.join(temp, 'keep.txt'), 'keep')
  assert.throws(
    () => createProject(temp),
    /Target directory is not empty/,
  )
})

test('CLI exposes create usage', () => {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, '..', 'bin', 'create.js'), '--help'],
    { encoding: 'utf8' },
  )
  assert.equal(result.status, 0)
  assert.match(result.stdout, /dynwinrt-jsx create <directory>/)
})
