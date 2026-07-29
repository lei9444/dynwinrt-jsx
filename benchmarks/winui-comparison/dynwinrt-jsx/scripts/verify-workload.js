'use strict'

const assert = require('node:assert/strict')
const {
  DotNetRandom,
  StockDataSource,
} = require('../dist/workload.js')

const random = new DotNetRandom(42)
assert.equal(random.next(4900), 3273)
assert.equal(
  random.nextDouble(),
  0.14090729837348093,
)
assert.equal(random.next(4900), 615)
assert.equal(
  random.nextDouble(),
  0.5227642760252413,
)

const source = new StockDataSource()
assert.equal(
  source.items.length,
  StockDataSource.totalItems,
)
assert.equal(StockDataSource.totalItems, 4900)
console.log('StockGrid workload matches System.Random(42).')
