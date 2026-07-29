export interface StockItem {
  readonly symbol: string
  readonly previousPrice: number
  readonly currentPrice: number
  readonly isUp: boolean
}

export interface StockChange {
  readonly index: number
  readonly item: StockItem
}

const maxInt = 2_147_483_647
const seedBase = 161_803_398

export class DotNetRandom {
  readonly #seedArray = new Int32Array(56)
  #inext = 0
  #inextp = 21

  constructor(seed: number) {
    const subtraction =
      seed === -2_147_483_648
        ? maxInt
        : Math.abs(seed)
    let mj = seedBase - subtraction
    if (mj < 0) {
      mj += maxInt
    }
    this.#seedArray[55] = mj
    let mk = 1
    for (let index = 1; index < 55; index += 1) {
      const destination = (21 * index) % 55
      this.#seedArray[destination] = mk
      mk = mj - mk
      if (mk < 0) {
        mk += maxInt
      }
      mj = this.#seedArray[destination]!
    }
    for (let pass = 1; pass < 5; pass += 1) {
      for (let index = 1; index < 56; index += 1) {
        let value =
          this.#seedArray[index]! -
          this.#seedArray[1 + (index + 30) % 55]!
        if (value < 0) {
          value += maxInt
        }
        this.#seedArray[index] = value
      }
    }
  }

  next(maximum: number): number {
    return Math.floor(this.nextDouble() * maximum)
  }

  nextDouble(): number {
    return this.#internalSample() * (1 / maxInt)
  }

  #internalSample(): number {
    let next = this.#inext + 1
    if (next >= 56) {
      next = 1
    }
    let nextp = this.#inextp + 1
    if (nextp >= 56) {
      nextp = 1
    }
    let result =
      this.#seedArray[next]! -
      this.#seedArray[nextp]!
    if (result === maxInt) {
      result -= 1
    }
    if (result < 0) {
      result += maxInt
    }
    this.#seedArray[next] = result
    this.#inext = next
    this.#inextp = nextp
    return result
  }
}

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100
}

export class StockDataSource {
  static readonly columns = 70
  static readonly rows = 70
  static readonly totalItems =
    StockDataSource.columns *
    StockDataSource.rows

  readonly items: StockItem[]
  readonly #random = new DotNetRandom(42)

  constructor() {
    this.items = Array.from(
      { length: StockDataSource.totalItems },
      (_, index) => {
        const row =
          Math.floor(index / StockDataSource.columns)
        const column =
          index % StockDataSource.columns
        const symbol = String.fromCharCode(
          65 + row % 26,
          65 + Math.floor(column / 3) % 26,
          65 + column % 26,
        )
        const price = roundPrice(
          10 + this.#random.nextDouble() * 990,
        )
        return {
          symbol,
          previousPrice: price,
          currentPrice: price,
          isUp: true,
        }
      },
    )
  }

  update(percent: number): readonly StockChange[] {
    const count = Math.max(
      1,
      Math.floor(
        StockDataSource.totalItems *
        percent /
        100,
      ),
    )
    const changes: StockChange[] = []
    for (let index = 0; index < count; index += 1) {
      const itemIndex =
        this.#random.next(StockDataSource.totalItems)
      const previous = this.items[itemIndex]!
      const delta =
        (
          (this.#random.nextDouble() - 0.48) *
          2
        ) *
        previous.currentPrice *
        0.02
      const currentPrice = Math.max(
        0.01,
        roundPrice(
          previous.currentPrice + delta,
        ),
      )
      const item = {
        symbol: previous.symbol,
        previousPrice: previous.currentPrice,
        currentPrice,
        isUp:
          currentPrice >= previous.currentPrice,
      }
      this.items[itemIndex] = item
      changes.push({
        index: itemIndex,
        item,
      })
    }
    return changes
  }

  checksum(): number {
    let checksum = 0
    for (const item of this.items) {
      checksum =
        (
          checksum +
          Math.round(item.currentPrice * 100) *
          (item.isUp ? 3 : 7)
        ) >>> 0
    }
    return checksum
  }
}

export function formatCell(item: StockItem): string {
  return `${item.symbol} ${item.currentPrice.toFixed(2)}`
}
