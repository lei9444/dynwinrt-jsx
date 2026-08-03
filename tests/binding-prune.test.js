'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const test = require('node:test')

test('binding pruner keeps application and framework runtime closure', (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'dynwinrt-binding-prune-'),
  )
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })
  const bindings = path.join(root, 'bindings')
  const source = path.join(root, 'src')
  const output = path.join(root, 'runtime')
  const report = path.join(root, 'report.json')
  fs.mkdirSync(bindings)
  fs.mkdirSync(source)
  fs.writeFileSync(
    path.join(bindings, 'index.js'),
    [
      "const __exportLazy = () => {};",
      "__exportLazy('A', './A.js');",
      "__exportLazy('B', './B.js');",
      "__exportLazy('Application', './Application.js');",
      "__exportLazy('Window', './Window.js');",
      "__exportLazy('createProjectedLifetimeScope', './lifetime.js');",
      "__exportLazy('releaseProjected', './lifetime.js');",
      '',
    ].join('\n'),
  )
  fs.writeFileSync(
    path.join(bindings, 'A.js'),
    "exports.A = require('./Shared.js').Shared;\n",
  )
  fs.writeFileSync(
    path.join(bindings, 'Shared.js'),
    'exports.Shared = class Shared {};\n',
  )
  fs.writeFileSync(
    path.join(bindings, 'B.js'),
    `exports.B = ${JSON.stringify('unused'.repeat(1_000))};\n`,
  )
  fs.writeFileSync(
    path.join(bindings, 'Application.js'),
    'exports.Application = class Application {};\n',
  )
  fs.writeFileSync(
    path.join(bindings, 'Window.js'),
    'exports.Window = class Window {};\n',
  )
  fs.writeFileSync(
    path.join(bindings, 'lifetime.js'),
    [
      'exports.createProjectedLifetimeScope = () => ({});',
      'exports.releaseProjected = () => {};',
      '',
    ].join('\n'),
  )
  fs.writeFileSync(
    path.join(bindings, 'B.d.ts'),
    'export declare class B {}\n',
  )
  fs.writeFileSync(
    path.join(source, 'app.ts'),
    [
      "import { A, type B } from '#winapp/bindings'",
      'void A',
      '',
    ].join('\n'),
  )

  const result = spawnSync(
    process.execPath,
    [
      path.join(
        __dirname,
        '..',
        'examples',
        'dashboard',
        'scripts',
        'prune-winrt-bindings.js',
      ),
      bindings,
      output,
      source,
      report,
    ],
    { encoding: 'utf8' },
  )
  assert.equal(result.status, 0, result.stderr)

  assert.deepEqual(
    fs.readdirSync(output).sort(),
    [
      'A.js',
      'Application.js',
      'Shared.js',
      'Window.js',
      'index.js',
      'lifetime.js',
    ],
  )
  const runtimeIndex = fs.readFileSync(
    path.join(output, 'index.js'),
    'utf8',
  )
  assert.match(runtimeIndex, /__exportLazy\("A"/)
  assert.doesNotMatch(runtimeIndex, /__exportLazy\("B"/)
  const summary = JSON.parse(fs.readFileSync(report, 'utf8'))
  assert.equal(summary.runtime.files, 6)
  assert.ok(summary.saved.files > 0)
  assert.ok(summary.saved.bytes > 0)
})
