interface FileSystem {
  existsSync(path: string): boolean
  readFileSync(path: string, encoding: 'utf8'): string
  mkdirSync(path: string, options: { recursive: true }): void
  writeFileSync(path: string, value: string, encoding: 'utf8'): void
  renameSync(source: string, destination: string): void
  rmSync(path: string, options: { force: true }): void
}

interface PathModule {
  dirname(path: string): string
}

declare function require(id: 'node:fs'): FileSystem
declare function require(id: 'node:path'): PathModule

const fs = require('node:fs')
const path = require('node:path')

export interface JsonStateStoreOptions<State> {
  readonly path: string
  readonly defaultState: () => State
  readonly validate: (value: unknown) => value is State
}

export interface JsonStateLoadResult<State> {
  readonly state: State
  readonly recovered: boolean
  readonly error: string | null
  readonly corruptPath: string | null
}

export interface JsonStateStore<State> {
  readonly path: string
  load(): JsonStateLoadResult<State>
  save(state: State): void
}

function corruptStatePath(statePath: string): string {
  const timestamp = new Date().toISOString().replaceAll(':', '-')
  return `${statePath}.corrupt-${timestamp}`
}

export function createJsonStateStore<State>(
  options: JsonStateStoreOptions<State>,
): JsonStateStore<State> {
  return {
    path: options.path,
    load() {
      if (!fs.existsSync(options.path)) {
        return {
          state: options.defaultState(),
          recovered: false,
          error: null,
          corruptPath: null,
        }
      }

      let serialized: string
      try {
        serialized = fs.readFileSync(options.path, 'utf8')
      } catch (error) {
        return {
          state: options.defaultState(),
          recovered: true,
          error: `Failed to read persisted state: ${String(error)}`,
          corruptPath: null,
        }
      }

      try {
        const parsed: unknown = JSON.parse(serialized)
        if (!options.validate(parsed)) {
          throw new TypeError('Persisted state failed schema validation.')
        }
        return {
          state: parsed,
          recovered: false,
          error: null,
          corruptPath: null,
        }
      } catch (error) {
        let movedPath: string | null = null
        try {
          movedPath = corruptStatePath(options.path)
          fs.renameSync(options.path, movedPath)
        } catch (moveError) {
          movedPath = null
          return {
            state: options.defaultState(),
            recovered: true,
            error: `${String(error)}; failed to preserve corrupt state: ${String(moveError)}`,
            corruptPath: null,
          }
        }
        return {
          state: options.defaultState(),
          recovered: true,
          error: String(error),
          corruptPath: movedPath,
        }
      }
    },
    save(state) {
      if (!options.validate(state)) {
        throw new TypeError('Refusing to persist state that fails validation.')
      }
      fs.mkdirSync(path.dirname(options.path), { recursive: true })
      const temporaryPath = `${options.path}.${Date.now()}.tmp`
      try {
        fs.writeFileSync(
          temporaryPath,
          `${JSON.stringify(state, null, 2)}\n`,
          'utf8',
        )
        fs.renameSync(temporaryPath, options.path)
      } catch (error) {
        fs.rmSync(temporaryPath, { force: true })
        throw error
      }
    },
  }
}
