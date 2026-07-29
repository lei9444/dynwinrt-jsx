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
  if (/defineWinUIApp/.test(workerSource)) {
    assert.match(workerSource, /bindings: WinUIBindings/)
    assert.match(workerSource, /beforeClose\(\)/)
    assert.match(workerSource, /disposeAfterRender\(\)/)
    assert.match(
      workerSource,
      /disposeBeforeRender\(\) \{[\s\S]*hotReloadController\?\.dispose\(\)/s,
    )
    assert.match(
      workerSource,
      /onDiagnostics\(diagnostics\) \{[\s\S]*type: 'diagnostics'/s,
    )
    return
  }
  assert.match(workerSource, /createProjectedLifetimeScope/)
  if (/runWinUIWorkerApp/.test(workerSource)) {
    assert.match(workerSource, /createProjectionScope\(\)/)
    assert.match(workerSource, /beforeClose\(\)/)
    assert.match(workerSource, /disposeAfterRender\(\)/)
    assert.match(
      workerSource,
      /disposeBeforeRender\(\) \{[\s\S]*hotReloadController\?\.dispose\(\)/s,
    )
    assert.match(
      workerSource,
      /onDiagnostics\(diagnostics\) \{[\s\S]*type: 'diagnostics'/s,
    )
    return
  }
  assert.match(workerSource, /installWinUIWindowLifecycle/)
  assert.match(
    workerSource,
    /disposeBeforeRender\(\) \{[\s\S]*hotReloadController\?\.dispose\(\)[\s\S]*hotReloadController = undefined/s,
  )
  assert.match(
    workerSource,
    /disposeRender\(\) \{[\s\S]*renderHandle\?\.dispose\(\)[\s\S]*renderHandle = undefined/s,
  )
  assert.match(
    workerSource,
    /disposeAfterRender\(\) \{[\s\S]*model\?\.dispose\(\)[\s\S]*model = undefined/s,
  )
  assert.match(
    workerSource,
    /disposeProjection\(\) \{[\s\S]*projectionLifetime\?\.dispose\(\)[\s\S]*projectionLifetime = undefined/s,
  )
  assert.match(
    workerSource,
    /onDiagnostics\(diagnostics\) \{[\s\S]*type: 'diagnostics'/s,
  )
  assert.match(
    workerSource,
    /setExitCode\(value\) \{\s*exitCode = value\s*\}/s,
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
  assert.match(workerSource, /import \* as WinUIBindings/)
  assert.match(workerSource, /defineWinUIApp/)
  assert.match(workerSource, /bindings: WinUIBindings/)
  assert.match(workerSource, /createDiagnosticChannel/)
  assert.match(workerSource, /diagnostics,/)
  assert.doesNotMatch(
    workerSource,
    /releaseNative: releaseProjected/,
  )
  const appSource = fs.readFileSync(
    path.join(target, 'src', 'app.tsx'),
    'utf8',
  )
  assert.match(appSource, /styles\.heading/)
  assert.match(appSource, /createRouter/)
  assert.match(appSource, /createRouterNavigationViewShell/)
  assert.match(appSource, /handle:\s*\{\s*navigation:/s)
  assert.match(appSource, /routes,/)
  assert.match(appSource, /<RouterProvider router=\{router\}>/)
  assert.match(appSource, /styles\.button/)
  assert.match(appSource, /tokens\.spacing/)
  assert.match(appSource, /createWinUIThemeController/)
  const mainSource = fs.readFileSync(
    path.join(target, 'main.js'),
    'utf8',
  )
  assert.match(mainSource, /defineWinUIHost/)
  assert.doesNotMatch(mainSource, /new MessageChannel/)
  assert.doesNotMatch(mainSource, /initWinappsdk/)
  const controls = manifest.winapp.jsBindings.additionalWinmds
    .find((entry) =>
      entry.namespace === 'Microsoft.UI.Xaml.Controls'
    )
    .classes
  for (const control of [
    'BitmapIcon',
    'ComboBox',
    'ContentControl',
    'ContentDialog',
    'Flyout',
    'Image',
    'ItemsRepeater',
    'ListView',
    'ListViewItem',
    'MenuFlyout',
    'MenuFlyoutItem',
    'MenuFlyoutSeparator',
    'NavigationView',
    'NavigationViewItem',
    'SymbolIcon',
    'StackLayout',
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
    ['Windows.UI.ViewManagement', 'AccessibilitySettings'],
    ['Microsoft.UI.Xaml', 'ResourceDictionary'],
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
      'worker',
      'application.tsx',
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

test('dashboard and template include Phase 2 and theme WinMD roots', () => {
  const template = readManifest(
    path.join(__dirname, '..', 'templates', 'winui'),
  )
  const dashboard = readManifest(
    path.join(__dirname, '..', 'examples', 'dashboard'),
  )
  const expected = new Map([
    ['Windows.Foundation', ['Uri']],
    ['Windows.UI.ViewManagement', ['AccessibilitySettings']],
    ['Microsoft.UI.Xaml', ['ResourceDictionary']],
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

test('repository keeps the real WinUI native selftest wired', () => {
  const mainSource = fs.readFileSync(
    path.join(__dirname, '..', 'examples', 'dashboard', 'main.js'),
    'utf8',
  )
  const workerSource = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'examples',
      'dashboard',
      'src',
      'winui-worker.tsx',
    ),
    'utf8',
  )
  const workerApplicationSource = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'examples',
      'dashboard',
      'src',
      'worker',
      'application.tsx',
    ),
    'utf8',
  )
  const workerSelfTestSource = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'examples',
      'dashboard',
      'src',
      'worker',
      'selftest.ts',
    ),
    'utf8',
  )
  const manifest = readManifest(
    path.join(__dirname, '..', 'examples', 'dashboard'),
  )

  assert.match(mainSource, /DYNWINRT_JSX_SELFTEST/)
  assert.match(mainSource, /DYNWINRT_JSX_NATIVE_SELFTEST/)
  assert.match(workerApplicationSource, /createNativeSelfTest/)
  assert.match(workerSelfTestSource, /nativeSelfTest\.run/)
  assert.match(workerSource, /Intentional native selftest Worker failure/)
  assert.ok(
    generatedClasses(
      manifest,
      'Windows.UI.ViewManagement',
    ).includes('UISettings'),
  )
  assert.ok(
    fs.existsSync(
      path.join(
        __dirname,
        '..',
        'scripts',
        'run-native-selftest.ps1',
      ),
    ),
  )
  assert.ok(
    fs.existsSync(
      path.join(
        __dirname,
        '..',
        'scripts',
        'run-accessibility-matrix.ps1',
      ),
    ),
  )
})

test('repository keeps structured debug automation wired', () => {
  const capturePath = path.join(
    __dirname,
    '..',
    'scripts',
    'capture-process-hang.ps1',
  )
  const repeatSource = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'scripts',
      'repeat-dashboard-smoke.ps1',
    ),
    'utf8',
  )
  const smokeSource = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'scripts',
      'smoke-dashboard-ui.ps1',
    ),
    'utf8',
  )

  assert.ok(fs.existsSync(capturePath))
  assert.match(repeatSource, /capture-process-hang\.ps1/)
  assert.match(smokeSource, /dynwinrt-jsx\.route-smoke/)
  assert.match(smokeSource, /DiagnosticsEvidencePath/)
  assert.match(smokeSource, /Assert-SingleDashboardWindow/)
})

test('Gallery uses the signal-native router', () => {
  const galleryShell = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'examples',
      'gallery',
      'src',
      'gallery-shell.tsx',
    ),
    'utf8',
  )

  assert.match(galleryShell, /createRouter(?:<|\()/)
  assert.match(galleryShell, /createRouterNavigationViewShell/)
  assert.match(galleryShell, /<RouterProvider router=\{router\}>/)
  assert.match(galleryShell, /<Outlet \/>/)
  assert.match(galleryShell, /createGalleryRoutes/)
  assert.doesNotMatch(galleryShell, /createNavigationHost/)
  assert.doesNotMatch(galleryShell, /new Map<GalleryRoute/)
  assert.doesNotMatch(galleryShell, /renderSamplePage/)
  assert.doesNotMatch(
    galleryShell,
    /\.\/pages\/basic-input\/button/,
  )
  assert.doesNotMatch(
    galleryShell,
    /currentPage\?\.category ===/,
  )
  const galleryMain = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'examples',
      'gallery',
      'main.js',
    ),
    'utf8',
  )
  assert.match(galleryMain, /defineWinUIHost/)
  assert.match(galleryMain, /evidence:\s*\{/)
  assert.doesNotMatch(galleryMain, /new MessageChannel/)
  assert.doesNotMatch(galleryMain, /initWinappsdk/)
  const galleryUi = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'examples',
      'gallery',
      'src',
      'gallery-ui.ts',
    ),
    'utf8',
  )
  assert.match(galleryUi, /\.asVector\(\)/)
  assert.equal(
    fs.existsSync(path.join(
      __dirname,
      '..',
      'examples',
      'gallery',
      'src',
      'command-bar-collection.ts',
    )),
    false,
  )
  for (const directory of [
    'basic-input',
    'collections',
    'fundamentals',
    'styles',
  ]) {
    assert.ok(fs.existsSync(path.join(
      __dirname,
      '..',
      'examples',
      'gallery',
      'src',
      'pages',
      directory,
      'routes.tsx',
    )))
  }
})

test('Gallery keeps local dynwinrt runtime and codegen aligned', () => {
  const manifest = readManifest(path.join(
    __dirname,
    '..',
    'examples',
    'gallery',
  ))
  const buildScript = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'examples',
      'gallery',
      'scripts',
      'build-local-dynwinrt.js',
    ),
    'utf8',
  )
  const codegenWrapper = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'examples',
      'gallery',
      'tools',
      'local-codegen',
      'cli.js',
    ),
    'utf8',
  )

  assert.match(
    manifest.scripts.generate,
    /build:dynwinrt/,
  )
  assert.match(
    manifest.scripts.dev,
    /build:dynwinrt/,
  )
  assert.match(
    manifest.scripts.start,
    /build:dynwinrt/,
  )
  assert.match(buildScript, /-p',\s*'jswinrt_rs'/)
  assert.match(buildScript, /-p',\s*'dynwinrt-codegen'/)
  assert.match(
    buildScript,
    /dynwinrt\.win32-x64-msvc\.node/,
  )
  assert.match(
    codegenWrapper,
    /\.winapp[\s\S]*tools[\s\S]*dynwinrt-codegen\.exe/,
  )
})

test('CI covers pinned Windows and ARM64 source matrices', () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, '..', '.github', 'workflows', 'ci.yml'),
    'utf8',
  )
  for (const expected of [
    'windows-2022',
    'windows-2025',
    'windows-11-arm',
    '22.23.1',
    '24.18.0',
    'architecture: arm64',
  ]) {
    assert.match(workflow, new RegExp(expected.replaceAll('.', '\\.')))
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
