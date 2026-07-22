'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  adapter,
  createRenderer,
  native,
  signal,
} = require('../dist')
const { jsx } = require('../dist/jsx-runtime')
const { FakeWindow } = require('./fakes')

class SynchronousControl {
  constructor() {
    this._value = 0
    this.listeners = new Set()
  }

  get value() {
    return this._value
  }

  set value(value) {
    this._value = value
    for (const listener of [...this.listeners]) {
      listener()
    }
  }

  onValueChanged(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  change(value) {
    this._value = value
    for (const listener of [...this.listeners]) {
      listener()
    }
  }
}

class DeferredControl extends SynchronousControl {
  constructor() {
    super()
    this.pending = []
  }

  get value() {
    return this._value
  }

  set value(value) {
    this._value = value
    this.pending.push(() => {
      for (const listener of [...this.listeners]) {
        listener()
      }
    })
  }

  flush() {
    while (this.pending.length > 0) {
      this.pending.shift()()
    }
  }
}

class CoercingControl extends SynchronousControl {
  set value(value) {
    this._value = Math.max(0, Math.min(100, value))
    for (const listener of [...this.listeners]) {
      listener()
      listener()
    }

  }

  get value() {
    return this._value
  }
}

class NoOpDeferredControl extends DeferredControl {
  set value(value) {
    if (Object.is(this._value, value)) {
      return
    }

    super.value = value
  }

  get value() {
    return this._value
  }
}

class FailingControl extends SynchronousControl {
  set value(value) {
    this._value = value
    if (value === 2) {
      throw new Error('write failed')
    }
    for (const listener of [...this.listeners]) {
      listener()
    }
  }

  get value() {
    return this._value
  }

  restore(value) {
    this._value = value
    for (const listener of [...this.listeners]) {
      listener()
    }
  }
}

class ReassertFailingControl extends SynchronousControl {
  failValue = undefined

  set value(value) {
    if (Object.is(value, this.failValue)) {
      throw new Error('reassert failed')
    }
    super.value = value
  }

  get value() {
    return super.value
  }
}

class NestedChangeControl extends SynchronousControl {
  _trigger = 0
  changingTrigger = false

  get value() {
    return super.value
  }

  set value(value) {
    if (this.changingTrigger) {
      throw new Error('value reasserted during trigger update')
    }
    super.value = value
  }

  get trigger() {
    return this._trigger
  }

  set trigger(value) {
    this._trigger = value
    if (value === 0) {
      return
    }
    this.changingTrigger = true
    try {
      this.change(value + 1)
    }
    finally {
      this.changingTrigger = false
    }
  }
}

function controlledComponent(Control, echo) {
  return native(Control, {
    adapters: {
      value: adapter.controlled({
        changeProperty: 'onValueChange',
        read: (instance) => instance.value,
        write: (instance, value) => {
          instance.value = value
        },
        subscribe: (instance, callback) =>
          instance.onValueChanged(callback),
        echo,
      }),
    },
  })
}

test('controlled adapter suppresses synchronous writes and forwards user changes', () => {
  const Control = controlledComponent(
    SynchronousControl,
    'synchronous',
  )
  const value = signal(1)
  const changes = []
  const window = new FakeWindow()
  const handle = createRenderer().render(
    jsx(Control, {
      value,
      onValueChange(next, sender) {
        changes.push([next, sender])
      },
    }),
    window,
  )
  const instance = window.content

  assert.equal(instance.value, 1)
  assert.deepEqual(changes, [])

  value.value = 2
  assert.equal(instance.value, 2)
  assert.deepEqual(changes, [])

  instance.change(3)
  assert.equal(changes.length, 1)
  assert.equal(changes[0][0], 3)
  assert.equal(changes[0][1], instance)
  assert.equal(instance.value, 2)

  handle.dispose()
  assert.equal(instance.listeners.size, 0)
})

test('controlled adapter keeps accepted native changes', () => {
  const Control = controlledComponent(
    SynchronousControl,
    'synchronous',
  )
  const value = signal(1)
  const changes = []
  const window = new FakeWindow()
  createRenderer().render(
    jsx(Control, {
      value,
      onValueChange(next) {
        changes.push(next)
        value.value = next
      },
    }),
    window,
  )
  const instance = window.content

  instance.change(2)

  assert.equal(value.value, 2)
  assert.equal(instance.value, 2)
  assert.deepEqual(changes, [2])
})

test('controlled adapter waits for nested reactive updates before reasserting', () => {
  const Control = controlledComponent(
    NestedChangeControl,
    'synchronous',
  )
  const value = signal(1)
  const trigger = signal(0)
  const errors = []
  const window = new FakeWindow()
  createRenderer({
    onError(error) {
      errors.push(error)
    },
  }).render(
    jsx(Control, {
      value,
      trigger,
      onValueChange(next) {
        value.value = next
      },
    }),
    window,
  )
  const instance = window.content

  trigger.value = 1

  assert.equal(value.value, 2)
  assert.equal(instance.value, 2)
  assert.deepEqual(errors, [])
})

test('controlled adapter counts deferred echo bursts', () => {
  const Control = controlledComponent(
    DeferredControl,
    'deferred',
  )
  const value = signal(1)
  const changes = []
  const window = new FakeWindow()
  createRenderer().render(
    jsx(Control, {
      value,
      onValueChange(next) {
        changes.push(next)
      },
    }),
    window,
  )
  const instance = window.content
  instance.flush()

  value.value = 2
  value.value = 3
  value.value = 4
  instance.flush()
  assert.deepEqual(changes, [])

  instance.change(5)
  assert.deepEqual(changes, [5])
})

test('controlled adapter reasserts rejected deferred changes without leaking echoes', () => {
  const Control = controlledComponent(
    DeferredControl,
    'deferred',
  )
  const value = signal(1)
  const changes = []
  const window = new FakeWindow()
  createRenderer().render(
    jsx(Control, {
      value,
      onValueChange(next) {
        changes.push(next)
      },
    }),
    window,
  )
  const instance = window.content
  instance.flush()

  instance.change(2)

  assert.equal(value.value, 1)
  assert.equal(instance.value, 1)
  assert.deepEqual(changes, [2])

  instance.flush()
  assert.deepEqual(changes, [2])
})

test('controlled adapter reports callback errors after restoring the model', () => {
  const Control = controlledComponent(
    SynchronousControl,
    'synchronous',
  )
  const errors = []
  const window = new FakeWindow()
  createRenderer({
    onError(error, context) {
      errors.push([error, context])
    },
  }).render(
    jsx(Control, {
      value: 1,
      onValueChange() {
        throw new Error('callback failed')
      },
    }),
    window,
  )
  const instance = window.content

  instance.change(2)

  assert.equal(instance.value, 1)
  assert.equal(errors.length, 1)
  assert.match(errors[0][0].message, /callback failed/)
  assert.equal(errors[0][1].phase, 'event')
  assert.equal(errors[0][1].property, 'onValueChange')
})

test('controlled adapter reports rejected-change reassertion failures', () => {
  const Control = controlledComponent(
    ReassertFailingControl,
    'synchronous',
  )
  const errors = []
  const window = new FakeWindow()
  createRenderer({
    onError(error, context) {
      errors.push([error, context])
    },
  }).render(
    jsx(Control, {
      value: 1,
      onValueChange() {},
    }),
    window,
  )
  const instance = window.content
  instance.failValue = 1

  instance.change(2)

  assert.equal(instance.value, 2)
  assert.equal(errors.length, 1)
  assert.match(errors[0][0].message, /reassert failed/)
  assert.equal(errors[0][1].phase, 'property')
  assert.equal(errors[0][1].property, 'value')
})

test('controlled adapter aggregates callback and reassertion failures', () => {
  const Control = controlledComponent(
    ReassertFailingControl,
    'synchronous',
  )
  const errors = []
  const window = new FakeWindow()
  createRenderer({
    onError(error) {
      errors.push(error)
    },
  }).render(
    jsx(Control, {
      value: 1,
      onValueChange() {
        throw new Error('callback failed')
      },
    }),
    window,
  )
  const instance = window.content
  instance.failValue = 1

  instance.change(2)

  assert.equal(errors.length, 1)
  assert.ok(errors[0] instanceof AggregateError)
  assert.equal(errors[0].errors.length, 2)
  assert.match(errors[0].message, /callback and model reassertion failed/)
})

test('controlled adapter does not arm deferred echo for no-op writes', () => {
  const Control = controlledComponent(
    NoOpDeferredControl,
    'deferred',
  )
  const value = signal(0)
  const changes = []
  const window = new FakeWindow()
  createRenderer().render(
    jsx(Control, {
      value,
      onValueChange(next) {
        changes.push(next)
      },
    }),
    window,
  )
  const instance = window.content

  instance.change(5)
  assert.deepEqual(changes, [5])
})

test('controlled adapter reads signal-backed change callbacks', () => {
  const Control = controlledComponent(
    SynchronousControl,
    'synchronous',
  )
  const first = []
  const second = []
  const callback = signal((value) => first.push(value))
  const window = new FakeWindow()
  createRenderer().render(
    jsx(Control, {
      value: 1,
      onValueChange: callback,
    }),
    window,
  )
  const instance = window.content

  instance.change(2)
  callback.value = (value) => second.push(value)
  instance.change(3)

  assert.deepEqual(first, [2])
  assert.deepEqual(second, [3])
})

test('controlled adapter suppresses every setter-scope coercion echo', () => {
  const Control = controlledComponent(
    CoercingControl,
    'setterScope',
  )
  const value = signal(120)
  const changes = []
  const window = new FakeWindow()
  createRenderer().render(
    jsx(Control, {
      value,
      onValueChange(next) {
        changes.push(next)
      },
    }),
    window,
  )
  const instance = window.content

  assert.equal(instance.value, 100)
  assert.deepEqual(changes, [])

  value.value = -10
  assert.equal(instance.value, 0)
  assert.deepEqual(changes, [])

  instance.change(50)
  assert.deepEqual(changes, [50])
})

test('controlled adapter rolls back partial native writes', () => {
  const Control = native(FailingControl, {
    adapters: {
      value: adapter.controlled({
        changeProperty: 'onValueChange',
        read: (instance) => instance.value,
        write: (instance, value) => {
          instance.value = value
        },
        subscribe: (instance, callback) =>
          instance.onValueChanged(callback),
        rollback: (instance, previous) => {
          instance.restore(previous)
        },
        echo: 'synchronous',
      }),
    },
  })
  const errors = []
  const changes = []
  const value = signal(1)
  const window = new FakeWindow()
  createRenderer({
    onError(error) {
      errors.push(error)
    },
  }).render(
    jsx(Control, {
      value,
      onValueChange(next) {
        changes.push(next)
      },
    }),
    window,
  )
  const instance = window.content

  value.value = 2
  assert.equal(instance.value, 1)
  assert.equal(errors.length, 1)
  assert.match(errors[0].message, /write failed/)
  assert.deepEqual(changes, [])
})
