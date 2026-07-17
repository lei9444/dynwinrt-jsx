'use strict'

class FakeVector {
  constructor(items = []) {
    this.items = [...items]
  }

  get length() {
    return this.items.length
  }

  get size() {
    return this.items.length
  }

  getAt(index) {
    return this.items[index]
  }

  toArray() {
    return [...this.items]
  }

  insertAt(index, value) {
    this.items.splice(index, 0, value)
  }

  removeAt(index) {
    this.items.splice(index, 1)
  }

  append(value) {
    this.items.push(value)
  }

  clear() {
    this.items.length = 0
  }
}

class FakeWindow {
  constructor() {
    this.content = null
  }
}

class FakePanel {
  constructor() {
    this.children = new FakeVector()
    this.spacing = 0
  }
}

class FakeBorder {
  constructor() {
    this.child = null
    this.height = 0
  }
}

class FakeTextBlock {
  constructor() {
    this.text = ''
    this.fontSize = 14
  }
}

class FakeButton {
  constructor() {
    this.content = null
    this.isEnabled = true
    this.listeners = new Set()
  }

  onClick(callback) {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  click() {
    for (const listener of [...this.listeners]) {
      listener(this, { handled: false })
    }
  }
}

module.exports = {
  FakeBorder,
  FakeButton,
  FakePanel,
  FakeTextBlock,
  FakeVector,
  FakeWindow,
}
