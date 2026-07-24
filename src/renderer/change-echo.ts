export type ChangeEchoMode =
  | 'synchronous'
  | 'deferred'
  | 'setterScope'

export interface ChangeEchoSuppressorOptions<Value> {
  readonly mode?: ChangeEchoMode
  readonly equals?: (
    expected: Value,
    actual: Value,
  ) => boolean
  readonly maxPending?: number
}

export class ChangeEchoSuppressor<Value> {
  private readonly pending: Value[] = []
  private readonly mode: ChangeEchoMode
  private readonly equals: (
    expected: Value,
    actual: Value,
  ) => boolean
  private readonly maxPending: number
  private setterScopeDepth = 0

  constructor(
    options: ChangeEchoSuppressorOptions<Value> = {},
  ) {
    this.mode = options.mode ?? 'deferred'
    this.equals = options.equals ?? Object.is
    this.maxPending = options.maxPending ?? 8
  }

  record(value: Value): void {
    if (this.mode === 'setterScope') {
      this.setterScopeDepth += 1
      return
    }
    this.pending.push(value)
    if (this.pending.length > this.maxPending) {
      this.pending.shift()
    }
  }

  finishWrite(): void {
    if (this.mode === 'setterScope') {
      this.setterScopeDepth = Math.max(
        0,
        this.setterScopeDepth - 1,
      )
      return
    }
    if (this.mode === 'synchronous') {
      this.pending.length = 0
    }
  }

  consume(value: Value): boolean {
    if (this.setterScopeDepth > 0) {
      return true
    }
    if (this.pending.length === 0) {
      return false
    }

    if (this.mode === 'deferred') {
      this.pending.shift()
      return true
    }

    const match = this.pending.findIndex(
      (pending) => this.equals(pending, value),
    )
    if (match >= 0) {
      this.pending.splice(0, match + 1)
      return true
    }

    this.pending.length = 0
    return false
  }

  clear(): void {
    this.pending.length = 0
    this.setterScopeDepth = 0
  }
}
