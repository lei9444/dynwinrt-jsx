'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  bind,
  createControls,
  createRenderer,
  signal,
} = require('../dist')
const { jsx } = require('../dist/jsx-runtime')
const { FakeWindow } = require('./fakes')

test('binding helpers produce reactive JSX property and event props', async () => {
  const name = signal('Ada')
  const oneWay = bind.oneWay(name, 'text')
  const twoWay = bind.twoWay(name, 'text', 'onTextChanged')

  assert.equal(oneWay.text, name)
  assert.equal(twoWay.text.value, 'Ada')
  await Promise.resolve()

  twoWay.onTextChanged({ text: 'Grace' })
  assert.equal(name.value, 'Grace')
})

test('two-way bindings can project values from event senders', () => {
  const count = signal(0)
  const binding = bind.twoWay(
    count,
    'value',
    'onChanged',
    (sender) => Number(sender.value),
  )

  binding.onChanged({ value: '42' })
  assert.equal(count.value, 42)
})

test('two-way bindings suppress synchronous boxed-value echoes', () => {
  class EchoControl {
    constructor() {
      this.current = { value: 0 }
      this.listeners = new Set()
      this.writes = 0
    }

    get selected() {
      return this.current
    }

    set selected(value) {
      this.writes += 1
      this.current = { value: value.value }
      for (const listener of this.listeners) {
        listener(this)
      }
    }

    onSelectedChanged(listener) {
      this.listeners.add(listener)
      return () => this.listeners.delete(listener)
    }

    select(value) {
      this.current = value
      for (const listener of this.listeners) {
        listener(this)
      }
    }
  }

  const UI = createControls({ EchoControl })
  const renderer = createRenderer()
  const window = new FakeWindow()
  const selected = signal({ value: 1 })
  renderer.render(
    jsx(UI.EchoControl, {
      ...bind.twoWay(
        selected,
        'selected',
        'onSelectedChanged',
      ),
    }),
    window,
  )
  const control = window.content
  const writesAfterMount = control.writes

  selected.value = { value: 2 }
  assert.equal(control.writes, writesAfterMount + 1)
  assert.equal(selected.value.value, 2)

  control.select({ value: 3 })
  assert.equal(selected.value.value, 3)
  assert.ok(control.writes <= writesAfterMount + 2)
})

test('two-way bindings suppress deferred boxed-value echoes', () => {
  class DeferredEchoControl {
    constructor() {
      this.current = { value: 0 }
      this.listeners = new Set()
      this.pendingEvents = []
      this.writes = 0
    }

    get selected() {
      return this.current
    }

    set selected(value) {
      this.writes += 1
      this.current = { value: value.value }
      this.pendingEvents.push(() => {
        for (const listener of this.listeners) {
          listener(this)
        }
      })
    }

    onSelectedChanged(listener) {
      this.listeners.add(listener)
      return () => this.listeners.delete(listener)
    }

    flushEvents() {
      let delivered = 0
      while (this.pendingEvents.length > 0) {
        delivered += 1
        assert.ok(delivered < 20, 'deferred binding echo did not settle')
        this.pendingEvents.shift()()
      }
    }
  }

  const UI = createControls({ DeferredEchoControl })
  const renderer = createRenderer()
  const window = new FakeWindow()
  const selected = signal({ value: 1 })
  renderer.render(
    jsx(UI.DeferredEchoControl, {
      ...bind.twoWay(
        selected,
        'selected',
        'onSelectedChanged',
      ),
    }),
    window,
  )
  const control = window.content
  control.flushEvents()

  selected.value = { value: 2 }
  control.flushEvents()

  assert.equal(selected.value.value, 2)
  assert.equal(control.selected.value, 2)
  assert.equal(control.writes, 2)
})

test('two-way bindings track bursts of deferred native echoes', () => {
  class BurstEchoControl {
    constructor() {
      this.current = { value: 0 }
      this.listeners = new Set()
      this.pendingEvents = []
      this.writes = 0
    }

    get selected() {
      return this.current
    }

    set selected(value) {
      this.writes += 1
      this.current = { value: value.value }
      this.pendingEvents.push(() => {
        for (const listener of this.listeners) {
          listener(this)
        }
      })
    }

    onSelectedChanged(listener) {
      this.listeners.add(listener)
      return () => this.listeners.delete(listener)
    }

    flushEvents() {
      let delivered = 0
      while (this.pendingEvents.length > 0) {
        delivered += 1
        assert.ok(delivered < 20, 'burst binding echo did not settle')
        this.pendingEvents.shift()()
      }
    }
  }

  const UI = createControls({ BurstEchoControl })
  const renderer = createRenderer()
  const window = new FakeWindow()
  const selected = signal({ value: 1 })
  renderer.render(
    jsx(UI.BurstEchoControl, {
      ...bind.twoWay(
        selected,
        'selected',
        'onSelectedChanged',
      ),
    }),
    window,
  )
  const control = window.content
  control.flushEvents()
  let notifications = 0
  selected.subscribe(() => {
    notifications += 1
  })

  selected.value = { value: 2 }
  selected.value = { value: 3 }
  selected.value = { value: 4 }
  control.flushEvents()

  assert.equal(selected.value.value, 4)
  assert.equal(control.selected.value, 4)
  assert.equal(control.writes, 4)
  assert.equal(notifications, 3)
})
