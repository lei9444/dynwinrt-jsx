'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const benchmarkRoot = path.resolve(__dirname, '..')
const dynwinrtRoot = path.resolve(
  benchmarkRoot,
  '..',
  '..',
  '..',
  '..',
  'dynwinrt',
)
const target = {
  arm64: 'aarch64-pc-windows-msvc',
  x64: 'x86_64-pc-windows-msvc',
}[process.arch]
const nativeName = {
  arm64: 'dynwinrt.win32-arm64-msvc.node',
  x64: 'dynwinrt.win32-x64-msvc.node',
}[process.arch]

if (!target || !nativeName) {
  throw new Error(
    `Unsupported Node.js architecture: ${process.arch}`,
  )
}
if (!fs.existsSync(path.join(dynwinrtRoot, 'Cargo.toml'))) {
  throw new Error(
    `The sibling dynwinrt repository was not found at ${dynwinrtRoot}.`,
  )
}

const targetRoot = path.join(
  dynwinrtRoot,
  'target',
  'dynwinrt-jsx-benchmark',
)
const result = spawnSync(
  'cargo.exe',
  [
    'build',
    '--release',
    '--target',
    target,
    '--target-dir',
    targetRoot,
    '-p',
    'jswinrt_rs',
    '-p',
    'dynwinrt-codegen',
  ],
  {
    cwd: dynwinrtRoot,
    stdio: 'inherit',
  },
)
if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

const output = path.join(targetRoot, target, 'release')
const nativeSource = path.join(output, 'jswinrt_rs.dll')
const codegenSource = path.join(
  output,
  'dynwinrt-codegen.exe',
)
const runtimeDirectory = path.join(
  dynwinrtRoot,
  'bindings',
  'js',
  'dist',
)
const codegenDirectory = path.join(
  benchmarkRoot,
  '.winapp',
  'tools',
)

for (const filePath of [nativeSource, codegenSource]) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `The dynwinrt build did not produce ${filePath}.`,
    )
  }
}

fs.mkdirSync(runtimeDirectory, { recursive: true })
fs.copyFileSync(
  nativeSource,
  path.join(runtimeDirectory, nativeName),
)
fs.mkdirSync(codegenDirectory, { recursive: true })
fs.copyFileSync(
  codegenSource,
  path.join(codegenDirectory, 'dynwinrt-codegen.exe'),
)

console.log(
  `Prepared dynwinrt runtime and codegen for ${target}.`,
)
