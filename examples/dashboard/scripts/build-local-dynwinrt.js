'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const dashboardRoot = path.resolve(__dirname, '..')
const dynwinrtRoot = path.resolve(
  dashboardRoot,
  '..',
  '..',
  '..',
  'dynwinrt',
)
const nativeName = {
  arm64: 'dynwinrt.win32-arm64-msvc.node',
  x64: 'dynwinrt.win32-x64-msvc.node',
}[process.arch]

if (!nativeName) {
  throw new Error(
    `Unsupported Node.js architecture: ${process.arch}`,
  )
}
if (!fs.existsSync(path.join(dynwinrtRoot, 'Cargo.toml'))) {
  throw new Error(
    `The sibling dynwinrt repository was not found at ${dynwinrtRoot}.`,
  )
}

const bindingsRoot = path.join(
  dynwinrtRoot,
  'bindings',
  'js',
)
const npmCli = [
  process.env.npm_execpath,
  path.join(
    path.dirname(process.execPath),
    'node_modules',
    'npm',
    'bin',
    'npm-cli.js',
  ),
].find((candidate) =>
  candidate && fs.existsSync(candidate))
if (!npmCli) {
  throw new Error(
    'npm-cli.js was not found beside the current Node.js executable.',
  )
}
const runtimeResult = spawnSync(
  process.execPath,
  [npmCli, 'run', 'build', '--silent'],
  {
    cwd: bindingsRoot,
    stdio: 'inherit',
  },
)
if (runtimeResult.status !== 0) {
  process.exit(runtimeResult.status ?? 1)
}

const codegenResult = spawnSync(
  'cargo.exe',
  [
    'build',
    '--release',
    '-p',
    'dynwinrt-codegen',
  ],
  {
    cwd: dynwinrtRoot,
    stdio: 'inherit',
  },
)
if (codegenResult.status !== 0) {
  process.exit(codegenResult.status ?? 1)
}

const runtimeDirectory = path.join(bindingsRoot, 'dist')
for (const filePath of [
  path.join(runtimeDirectory, nativeName),
  path.join(runtimeDirectory, 'index.js'),
  path.join(runtimeDirectory, 'index.d.ts'),
  path.join(runtimeDirectory, 'winrt.js'),
  path.join(runtimeDirectory, 'winrt.d.ts'),
  path.join(runtimeDirectory, 'com.js'),
  path.join(runtimeDirectory, 'com.d.ts'),
  path.join(
    dynwinrtRoot,
    'target',
    'release',
    'dynwinrt-codegen.exe',
  ),
]) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `The dynwinrt build did not produce ${filePath}.`,
    )
  }
}

console.log(
  `Prepared dynwinrt runtime and codegen for ${process.arch}.`,
)
