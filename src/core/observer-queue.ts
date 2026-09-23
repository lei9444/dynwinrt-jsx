interface QueueEntry<Value> {
  readonly value: Value
  readonly order: number
  index: number
}

export class ComputedQueue<Value extends { readonly depth: number }> {
  private readonly heap: QueueEntry<Value>[] = []
  private readonly entries = new Map<Value, QueueEntry<Value>>()
  private nextOrder = 0

  get size(): number {
    return this.heap.length
  }

  has(value: Value): boolean {
    return this.entries.has(value)
  }

  add(value: Value): void {
    if (this.entries.has(value)) {
      return
    }
    const entry = {
      value,
      order: this.nextOrder++,
      index: this.heap.length,
    }
    this.entries.set(value, entry)
    this.heap.push(entry)
    this.moveUp(entry)
  }

  delete(value: Value): boolean {
    const entry = this.entries.get(value)
    if (!entry) {
      return false
    }
    this.entries.delete(value)
    const last = this.heap.pop()!
    if (entry !== last) {
      this.place(last, entry.index)
      const parent = this.heap[Math.floor((last.index - 1) / 2)]
      if (parent && this.precedes(last, parent)) {
        this.moveUp(last)
      }
      else {
        this.moveDown(last)
      }
    }
    if (this.heap.length === 0) {
      this.nextOrder = 0
    }
    return true
  }

  take(): Value | undefined {
    const entry = this.heap[0]
    if (!entry) {
      return undefined
    }
    this.delete(entry.value)
    return entry.value
  }

  private precedes(
    left: QueueEntry<Value>,
    right: QueueEntry<Value>,
  ): boolean {
    return left.value.depth < right.value.depth ||
      (
        left.value.depth === right.value.depth &&
        left.order < right.order
      )
  }

  private place(entry: QueueEntry<Value>, index: number): void {
    this.heap[index] = entry
    entry.index = index
  }

  private moveUp(entry: QueueEntry<Value>): void {
    let index = entry.index
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2)
      const parent = this.heap[parentIndex]!
      if (!this.precedes(entry, parent)) {
        break
      }
      this.place(parent, index)
      index = parentIndex
    }
    this.place(entry, index)
  }

  private moveDown(entry: QueueEntry<Value>): void {
    let index = entry.index
    while (index * 2 + 1 < this.heap.length) {
      let childIndex = index * 2 + 1
      const right = this.heap[childIndex + 1]
      if (right && this.precedes(right, this.heap[childIndex]!)) {
        childIndex += 1
      }
      const child = this.heap[childIndex]!
      if (!this.precedes(child, entry)) {
        break
      }
      this.place(child, index)
      index = childIndex
    }
    this.place(entry, index)
  }
}
