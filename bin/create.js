#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const packageRoot = path.resolve(__dirname, '..')
const templateRoot = path.join(packageRoot, 'templates', 'winui')

function usage() {
  return [
    'Usage:',
    '  dynwinrt-jsx create <directory> [--local-root <work-directory>]',
    '',
    'Options:',
    '  --local-root  Use local dynwinrt, dynwinrt-jsx, and winappCli repositories.',
    '  -h, --help     Show this help.',
  ].join('\n')
}

function projectName(target) {
  const name = path.basename(target)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
  return name || 'dynwinrt-jsx-app'
}

function asFileDependency(target, dependencyPath) {
  let relative = path.relative(target, dependencyPath).replaceAll('\\', '/')
  if (!relative.startsWith('.')) {
    relative = `./${relative}`
  }
  return `file:${relative}`
}

function requireDirectory(directory, label) {
  if (!fs.statSync(directory, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`${label} was not found at ${directory}.`)
  }
}

function localCodegenCli(target, dynwinrtRoot) {
  const wrapperDirectory = path.join(target, 'tools', 'local-codegen')
  const relativeRoot = path
    .relative(wrapperDirectory, dynwinrtRoot)
    .replaceAll('\\', '/')

  return `#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const executable = path.resolve(
  __dirname,
  ${JSON.stringify(relativeRoot)},
  'target',
  'release',
  'dynwinrt-codegen.exe',
)

if (!fs.existsSync(executable)) {
  throw new Error(
    \`Local dynwinrt codegen was not found at \${executable}. Run npm run setup first.\`,
  )
}

const args = process.argv.slice(2)
if (args[0] === 'runtime-dependency') {
  console.log('@microsoft/dynwinrt@0.1.0')
  process.exit(0)
}

if (args[0] === 'capabilities') {
  const result = spawnSync(executable, ['capabilities'], { encoding: 'utf8' })
  if (result.status !== 0) {
    process.stderr.write(result.stderr)
    process.exit(result.status ?? 1)
  }
  const capabilities = new Set(
    result.stdout
      .split(/\\r?\\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  )
  capabilities.add('runtime-dependency')
  console.log([...capabilities].join('\\n'))
  process.exit(0)
}

const forwarded = args.filter(
  (arg) =>
    arg !== '--source-map' &&
    arg !== '--declaration' &&
    arg !== '--no-declaration',
)
const result = spawnSync(executable, forwarded, { stdio: 'inherit' })
process.exit(result.status ?? 1)
`
}

function configureLocalDependencies(target, manifest, localRoot) {
  const dynwinrtRoot = path.join(localRoot, 'dynwinrt')
  const jsxRoot = path.join(localRoot, 'dynwinrt-jsx')
  const winappCliRoot = path.join(localRoot, 'winappCli')
  requireDirectory(dynwinrtRoot, 'dynwinrt repository')
  requireDirectory(jsxRoot, 'dynwinrt-jsx repository')
  requireDirectory(winappCliRoot, 'winappCli repository')

  manifest.dependencies['@microsoft/dynwinrt'] = asFileDependency(
    target,
    path.join(dynwinrtRoot, 'bindings', 'js'),
  )
  manifest.dependencies['dynwinrt-jsx'] = asFileDependency(
    target,
    jsxRoot,
  )
  manifest.devDependencies['@microsoft/dynwinrt-codegen'] =
    'file:tools/local-codegen'
  manifest.devDependencies['@microsoft/winappcli'] = asFileDependency(
    target,
    path.join(winappCliRoot, 'src', 'winapp-npm'),
  )

  const relativeDynwinrt = path
    .relative(target, dynwinrtRoot)
    .replaceAll('\\', '/')
  manifest.scripts['build:codegen'] =
    `cargo build --release -p dynwinrt-codegen --manifest-path "${relativeDynwinrt}/Cargo.toml"`
  manifest.scripts.setup = 'npm run build:codegen && winapp restore'

  const wrapperDirectory = path.join(target, 'tools', 'local-codegen')
  fs.mkdirSync(wrapperDirectory, { recursive: true })
  fs.writeFileSync(
    path.join(wrapperDirectory, 'package.json'),
    `${JSON.stringify({
      name: '@microsoft/dynwinrt-codegen',
      version: '0.1.0',
      private: true,
      bin: {
        'dynwinrt-codegen': './cli.js',
      },
    }, null, 2)}\n`,
  )
  fs.writeFileSync(
    path.join(wrapperDirectory, 'cli.js'),
    localCodegenCli(target, dynwinrtRoot),
  )
}

function createProject(directory, options = {}) {
  const target = path.resolve(directory)
  const existing = fs.statSync(target, { throwIfNoEntry: false })
  if (existing && !existing.isDirectory()) {
    throw new Error(`Target exists and is not a directory: ${target}`)
  }
  if (existing && fs.readdirSync(target).length > 0) {
    throw new Error(`Target directory is not empty: ${target}`)
  }

  fs.mkdirSync(target, { recursive: true })
  fs.cpSync(templateRoot, target, { recursive: true })
  fs.renameSync(
    path.join(target, 'gitignore'),
    path.join(target, '.gitignore'),
  )

  const manifestPath = path.join(target, 'package.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  manifest.name = projectName(target)

  if (options.localRoot) {
    configureLocalDependencies(
      target,
      manifest,
      path.resolve(options.localRoot),
    )
  }

  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
  return target
}

function parseArguments(args) {
  if (
    args.length === 0 ||
    args.includes('--help') ||
    args.includes('-h')
  ) {
    return { help: true }
  }
  if (args[0] !== 'create' || !args[1]) {
    throw new Error(usage())
  }

  let localRoot
  for (let index = 2; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--local-root') {
      localRoot = args[index + 1]
      if (!localRoot) {
        throw new Error('--local-root requires a directory.')
      }
      index += 1
    } else {
      throw new Error(`Unknown option: ${argument}`)
    }
  }
  return {
    help: false,
    directory: args[1],
    localRoot,
  }
}

function main(args = process.argv.slice(2)) {
  const parsed = parseArguments(args)
  if (parsed.help) {
    console.log(usage())
    return
  }

  const target = createProject(parsed.directory, {
    localRoot: parsed.localRoot,
  })
  console.log(`Created ${target}`)
  console.log('Next: npm install && npm run setup && npm start')
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

module.exports = {
  createProject,
  main,
  parseArguments,
  projectName,
}
