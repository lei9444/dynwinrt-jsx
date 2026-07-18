'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createGridControl,
  createRenderer,
  gridLength,
  signal,
} = require('../dist/index.js')

class TestVector {
  values = []
  failAppendAt = null
  appendIndex = 0

  get size() {
    return this.values.length
  }

  getAt(index) {
    return this.values[index]
  }

  insertAt(index, value) {
    this.values.splice(index, 0, value)
  }

  removeAt(index) {
    this.values.splice(index, 1)
  }

  append(value) {
    if (this.failAppendAt === this.appendIndex) {
      this.failAppendAt = null
      throw new Error('append failed')
    }
    this.appendIndex += 1
    this.values.push(value)
  }

  clear() {
    this.values.length = 0
    this.appendIndex = 0
  }
}

class TestPanel {
  children = new TestVector()
}

class TestGrid extends TestPanel {
  rowVector = new TestVector()
  columnVector = new TestVector()
  rowDefinitions = this.rowVector
  columnDefinitions = this.columnVector
}

class TestRowDefinition {
  height = gridLength.star()
  minHeight = 0
  maxHeight = Number.POSITIVE_INFINITY
}

class TestColumnDefinition {
  width = gridLength.star()
  minWidth = 0
  maxWidth = Number.POSITIVE_INFINITY
}

function createTestRenderer() {
  return createRenderer({
    asCollection(value) {
      return value instanceof TestVector ? value : null
    },
  })
}

function createTestGrid() {
  return createGridControl({
    Grid: TestGrid,
    RowDefinition: TestRowDefinition,
    ColumnDefinition: TestColumnDefinition,
  })
}

test('grid length helpers create validated native values', () => {
  assert.deepEqual(gridLength.auto(), {
    value: 1,
    gridUnitType: 0,
  })
  assert.deepEqual(gridLength.pixel(48), {
    value: 48,
    gridUnitType: 1,
  })
  assert.deepEqual(gridLength.star(2), {
    value: 2,
    gridUnitType: 2,
  })
  assert.deepEqual(gridLength.star(0), {
    value: 0,
    gridUnitType: 2,
  })
  assert.throws(() => gridLength.pixel(-1), /non-negative/)
  assert.throws(() => gridLength.star(-1), /non-negative/)
})

test('Grid definitions mount and update from signals', () => {
  const Grid = createTestGrid()
  const rows = signal([
    gridLength.auto(),
    {
      size: gridLength.star(2),
      min: 10,
      max: 100,
    },
  ])
  const nativeColumn = new TestColumnDefinition()
  nativeColumn.width = gridLength.pixel(240)
  const columns = signal([nativeColumn])
  const root = new TestPanel()
  let grid

  const handle = createTestRenderer().render(
    Grid({
      ref(value) {
        grid = value
      },
      rowDefinitions: rows,
      columnDefinitions: columns,
    }),
    root,
  )

  assert.equal(grid.rowVector.size, 2)
  assert.deepEqual(grid.rowVector.getAt(0).height, gridLength.auto())
  assert.deepEqual(grid.rowVector.getAt(1).height, gridLength.star(2))
  assert.equal(grid.rowVector.getAt(1).minHeight, 10)
  assert.equal(grid.rowVector.getAt(1).maxHeight, 100)
  assert.equal(grid.columnVector.getAt(0), nativeColumn)

  rows.value = [gridLength.pixel(64)]
  columns.value = [gridLength.star(), gridLength.pixel(32)]

  assert.equal(grid.rowVector.size, 1)
  assert.deepEqual(grid.rowVector.getAt(0).height, gridLength.pixel(64))
  assert.equal(grid.columnVector.size, 2)
  assert.deepEqual(grid.columnVector.getAt(0).width, gridLength.star())
  assert.deepEqual(
    grid.columnVector.getAt(1).width,
    gridLength.pixel(32),
  )

  handle.dispose()
  assert.equal(root.children.size, 0)
})

test('Grid definition replacement rolls back on collection failure', () => {
  const Grid = createTestGrid()
  const rows = signal([gridLength.pixel(24)])
  const root = new TestPanel()
  let grid

  const handle = createTestRenderer().render(
    Grid({
      ref: (value) => {
        grid = value
      },
      rowDefinitions: rows,
    }),
    root,
  )

  const previous = grid.rowVector.getAt(0)
  grid.rowVector.failAppendAt = 1
  assert.throws(
    () => {
      rows.value = [gridLength.pixel(30), gridLength.star()]
    },
    /append failed/,
  )
  assert.equal(grid.rowVector.size, 1)
  assert.equal(grid.rowVector.getAt(0), previous)

  handle.dispose()
})

test('Grid validates definitions before mutating native collections', () => {
  const Grid = createTestGrid()
  const rows = signal([gridLength.pixel(24)])
  const root = new TestPanel()
  let grid

  const handle = createTestRenderer().render(
    Grid({
      ref: (value) => {
        grid = value
      },
      rowDefinitions: rows,
    }),
    root,
  )

  const previous = grid.rowVector.getAt(0)
  assert.throws(
    () => {
      rows.value = [{ size: gridLength.pixel(10), min: 20, max: 10 }]
    },
    /minimum cannot exceed/,
  )
  assert.equal(grid.rowVector.size, 1)
  assert.equal(grid.rowVector.getAt(0), previous)

  handle.dispose()
})
