import { DotNetRandom } from './workload'

export interface KeyedRow {
  readonly id: number
  readonly key: string
  readonly label: string
}

function makeRow(id: number): KeyedRow {
  return {
    id,
    key: String(id),
    label:
      `Row ${id} · item-${String(id % 97).padStart(3, '0')}`,
  }
}

function roundAwayFromZero(value: number): number {
  return value < 0
    ? -Math.round(-value)
    : Math.round(value)
}

export class KeyedListSource {
  static readonly defaultCount = 500

  readonly #items: KeyedRow[]
  readonly #random = new DotNetRandom(42)
  #nextId: number

  constructor(count = KeyedListSource.defaultCount) {
    const normalized = Math.max(1, count)
    this.#items = Array.from(
      { length: normalized },
      (_, index) => makeRow(index),
    )
    this.#nextId = normalized
  }

  get count(): number {
    return this.#items.length
  }

  update(percent: number): number {
    const count = this.#items.length
    const budget = Math.max(
      0,
      Math.min(
        count,
        roundAwayFromZero(
          count * percent / 100,
        ),
      ),
    )
    if (budget === 0) {
      return 0
    }
    const churn = Math.floor(budget / 4)
    for (let index = 0; index < churn; index += 1) {
      this.#items.splice(
        this.#random.next(this.#items.length),
        1,
      )
      this.#items.splice(
        this.#random.next(this.#items.length + 1),
        0,
        makeRow(this.#nextId++),
      )
    }
    const moves = budget - churn
    for (let index = 0; index < moves; index += 1) {
      const from =
        this.#random.next(this.#items.length)
      const [row] = this.#items.splice(from, 1)
      this.#items.splice(
        this.#random.next(this.#items.length + 1),
        0,
        row!,
      )
    }
    return budget
  }

  snapshot(): readonly KeyedRow[] {
    return [...this.#items]
  }

  checksum(): number {
    let checksum = 0
    for (
      let index = 0;
      index < this.#items.length;
      index += 1
    ) {
      checksum = (
        checksum +
        this.#items[index]!.id *
        (index + 1)
      ) >>> 0
    }
    return checksum
  }
}
