'use strict'

const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const [
  sourceRootValue,
  outputRootValue,
  applicationSourceValue,
  reportPathValue,
] = process.argv.slice(2)

if (
  !sourceRootValue ||
  !outputRootValue ||
  !applicationSourceValue ||
  !reportPathValue
) {
  throw new Error(
    'Usage: node prune-winrt-bindings.js <bindings> <output> <application-source> <report>',
  )
}

const sourceRoot = path.resolve(sourceRootValue)
const outputRoot = path.resolve(outputRootValue)
const applicationSource = path.resolve(applicationSourceValue)
const reportPath = path.resolve(reportPathValue)
const indexPath = path.join(sourceRoot, 'index.js')

const frameworkRequired = new Set([
  'Application',
  'Window',
  'createProjectedLifetimeScope',
  'releaseProjected',
])
const frameworkOptional = new Set([
  'AccessibilitySettings',
  'ApplicationTheme',
  'AutomationProperties',
  'Canvas',
  'ElementTheme',
  'Grid',
  'IMap_Object_Object',
  'IReference_Boolean',
  'IReference_DateTime',
  'IReference_TimeSpan',
  'IVector_UIElement',
  'PropertyValue',
  'RelativePanel',
  'ResourceDictionary',
  'TextBlock',
  'ToolTipService',
  'VariableSizedWrapGrid',
])

function walkFiles(root, predicate) {
  const files = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath, predicate))
    } else if (predicate(entryPath)) {
      files.push(entryPath)
    }
  }
  return files
}

function collectApplicationExports() {
  const exports = new Set()
  const sourceFiles = walkFiles(
    applicationSource,
    (filePath) => /\.[cm]?[jt]sx?$/.test(filePath),
  )
  for (const filePath of sourceFiles) {
    const sourceText = fs.readFileSync(filePath, 'utf8')
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('x')
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.TS,
    )
    const namespaceImports = new Set()
    for (const statement of sourceFile.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        statement.moduleSpecifier.text !== '#winapp/bindings' ||
        statement.importClause?.isTypeOnly
      ) {
        continue
      }
      const bindings = statement.importClause?.namedBindings
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if (!element.isTypeOnly) {
            exports.add(
              (element.propertyName ?? element.name).text,
            )
          }
        }
      } else if (bindings && ts.isNamespaceImport(bindings)) {
        namespaceImports.add(bindings.name.text)
      }
    }
    const visit = (node) => {
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        namespaceImports.has(node.expression.text)
      ) {
        exports.add(node.name.text)
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }
  return exports
}

function readExportMap() {
  const indexSource = fs.readFileSync(indexPath, 'utf8')
  const exportMap = new Map()
  const pattern =
    /__exportLazy\('([^']+)',\s*'(\.\/[^']+\.js)'\);/g
  for (const match of indexSource.matchAll(pattern)) {
    exportMap.set(match[1], match[2])
  }
  return exportMap
}

function resolveRelativeModule(fromFile, specifier) {
  const candidate = path.resolve(path.dirname(fromFile), specifier)
  const candidates = path.extname(candidate)
    ? [candidate]
    : [`${candidate}.js`, `${candidate}.json`]
  const resolved = candidates.find((value) => fs.existsSync(value))
  if (!resolved) {
    throw new Error(
      `Generated binding ${fromFile} requires missing module ${specifier}.`,
    )
  }
  if (
    resolved !== sourceRoot &&
    !resolved.startsWith(`${sourceRoot}${path.sep}`)
  ) {
    throw new Error(
      `Generated binding dependency escapes the binding root: ${resolved}`,
    )
  }
  return resolved
}

function collectRuntimeFiles(seedFiles) {
  const reached = new Set()
  const pending = [...seedFiles]
  const requirePattern =
    /require\(\s*['"](\.[^'"]+)['"]\s*\)/g
  while (pending.length > 0) {
    const filePath = pending.pop()
    if (reached.has(filePath)) {
      continue
    }
    reached.add(filePath)
    if (path.extname(filePath) !== '.js') {
      continue
    }
    const source = fs.readFileSync(filePath, 'utf8')
    for (const match of source.matchAll(requirePattern)) {
      const dependency = resolveRelativeModule(
        filePath,
        match[1],
      )
      if (!reached.has(dependency)) {
        pending.push(dependency)
      }
    }
  }
  return reached
}

function recreateDirectory(directory) {
  fs.rmSync(directory, { recursive: true, force: true })
  fs.mkdirSync(directory, { recursive: true })
}

function copyRuntimeFiles(files) {
  for (const sourcePath of files) {
    const relativePath = path.relative(sourceRoot, sourcePath)
    const destination = path.join(outputRoot, relativePath)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(sourcePath, destination)
  }
}

function sumBytes(files) {
  return [...files].reduce(
    (total, filePath) => total + fs.statSync(filePath).size,
    0,
  )
}

const exportMap = readExportMap()
const applicationExports = collectApplicationExports()
const selectedExports = new Set([
  ...applicationExports,
  ...frameworkRequired,
])
for (const name of frameworkOptional) {
  if (exportMap.has(name)) {
    selectedExports.add(name)
  }
}
const missing = [...selectedExports]
  .filter((name) => !exportMap.has(name))
  .sort()
if (missing.length > 0) {
  throw new Error(
    `Generated binding exports are missing: ${missing.join(', ')}`,
  )
}

const seedFiles = new Set(
  [...selectedExports].map((name) =>
    resolveRelativeModule(indexPath, exportMap.get(name))),
)
const runtimeFiles = collectRuntimeFiles(seedFiles)
recreateDirectory(outputRoot)
copyRuntimeFiles(runtimeFiles)

const indexLines = [
  '// Generated runtime binding index - declarations and unreachable modules pruned',
  'const __exportLazy = (name, path) => {',
  '    let mod;',
  '    Object.defineProperty(exports, name, {',
  '        enumerable: true,',
  '        configurable: true,',
  '        get() { return (mod ??= require(path))[name]; },',
  '    });',
  '};',
]
for (const name of [...selectedExports].sort()) {
  indexLines.push(
    `__exportLazy(${JSON.stringify(name)}, ${JSON.stringify(exportMap.get(name))});`,
  )
}
indexLines.push('')
fs.writeFileSync(
  path.join(outputRoot, 'index.js'),
  indexLines.join('\n'),
  'utf8',
)

const allGeneratedFiles = walkFiles(
  sourceRoot,
  (filePath) => fs.statSync(filePath).isFile(),
)
const outputFiles = walkFiles(
  outputRoot,
  (filePath) => fs.statSync(filePath).isFile(),
)
const report = {
  schemaVersion: 1,
  sourceRoot,
  applicationSource,
  selectedExports: [...selectedExports].sort(),
  source: {
    files: allGeneratedFiles.length,
    bytes: sumBytes(allGeneratedFiles),
  },
  runtime: {
    files: outputFiles.length,
    bytes: sumBytes(outputFiles),
  },
}
const savedBytes = report.source.bytes - report.runtime.bytes
report.saved = {
  files: report.source.files - report.runtime.files,
  bytes: savedBytes,
  percent: Math.round(
    savedBytes / report.source.bytes * 1000,
  ) / 10,
}
fs.mkdirSync(path.dirname(reportPath), { recursive: true })
fs.writeFileSync(
  reportPath,
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
)
console.log(JSON.stringify(report))
