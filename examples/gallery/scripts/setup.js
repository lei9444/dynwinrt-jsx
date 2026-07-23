'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const galleryRoot = path.resolve(__dirname, '..')
const repositoryRoot = path.resolve(galleryRoot, '..', '..')
const cli = path.join(
  galleryRoot,
  'node_modules',
  '@microsoft',
  'winappcli',
  'dist',
  'cli.js',
)

function run(args) {
  const result = spawnSync(
    process.execPath,
    [cli, ...args],
    {
      cwd: galleryRoot,
      stdio: 'inherit',
    },
  )
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run([
  'restore',
  '--config-dir',
  galleryRoot,
])

const sharedWorkspace = path.join(repositoryRoot, '.winapp')
const localWorkspace = path.join(galleryRoot, '.winapp')
const lockfile = path.join(
  sharedWorkspace,
  'winmds.lock.json',
)
if (!fs.existsSync(lockfile)) {
  throw new Error(
    `WinMD inventory was not created at ${lockfile}.`,
  )
}

fs.mkdirSync(localWorkspace, { recursive: true })
for (const name of ['bin', 'include', 'lib', 'share']) {
  const source = path.join(sharedWorkspace, name)
  if (fs.existsSync(source)) {
    fs.cpSync(
      source,
      path.join(localWorkspace, name),
      { recursive: true, force: true },
    )
  }
}
fs.copyFileSync(
  lockfile,
  path.join(localWorkspace, 'winmds.lock.json'),
)

run(['node', 'generate-bindings'])
