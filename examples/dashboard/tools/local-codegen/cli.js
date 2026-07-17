#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const executable = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'dynwinrt',
  'target',
  'release',
  'dynwinrt-codegen.exe',
)

if (!fs.existsSync(executable)) {
  throw new Error(
    `Local dynwinrt codegen was not found at ${executable}. Build dynwinrt-codegen in release mode first.`,
  )
}

const args = process.argv.slice(2)

if (args[0] === 'runtime-dependency') {
  console.log('@microsoft/dynwinrt@0.1.0')
  process.exit(0)
}

if (args[0] === 'capabilities') {
  const result = spawnSync(executable, ['capabilities'], {
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    process.stderr.write(result.stderr)
    process.exit(result.status ?? 1)
  }

  const capabilities = new Set(
    result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  )
  capabilities.add('runtime-dependency')
  console.log([...capabilities].join('\n'))
  process.exit(0)
}

const forwarded = args.filter(
  (arg) =>
    arg !== '--source-map' &&
    arg !== '--declaration' &&
    arg !== '--no-declaration',
)
const result = spawnSync(executable, forwarded, {
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
