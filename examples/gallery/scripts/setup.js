'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { parseArgs } = require('node:util')

const galleryRoot = path.resolve(__dirname, '..')
const repositoryRoot = path.resolve(galleryRoot, '..', '..')
const cliRoot = path.join(
  galleryRoot,
  'node_modules',
  '@microsoft',
  'winappcli',
)
const { values } = parseArgs({ options: { winapp: { type: 'string' } } })
const winapp = values.winapp ??
  path.join(cliRoot, 'bin', `win-${process.arch}`, 'winapp.exe')

function run(command, args) {
  const result = spawnSync(
    command,
    args,
    {
      cwd: galleryRoot,
      stdio: 'inherit',
    },
  )
  if (result.error) throw result.error
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

// Restore the inventory first. The npm CLI's combined restore hook could
// otherwise generate from the Gallery's previous copy of the inventory.
run(winapp, [
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
fs.cpSync(
  path.join(sharedWorkspace, 'bin'),
  path.join(localWorkspace, 'bin'),
  { recursive: true },
)
fs.copyFileSync(
  lockfile,
  path.join(localWorkspace, 'winmds.lock.json'),
)

run(process.execPath, [path.join(cliRoot, 'dist', 'cli.js'), 'node', 'generate-bindings'])
