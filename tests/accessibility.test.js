'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createControls,
  createWinUIRenderer,
} = require('../dist/index.js')

class TestWindow {
  content = null
}

class TestControl {
  content = null
}

class TestCollection {
  values = []

  insertAt(index, value) {
    this.values.splice(index, 0, value)
  }
  removeAt(index) {
    this.values.splice(index, 1)
  }
  append(value) {
    this.values.push(value)
  }
  clear() {
    this.values.length = 0
  }
  as() {
    throw new Error('Native collections should not be reprojected.')
  }
}

class TestItemsControl {
  items = new TestCollection()
}

test('WinUI renderer applies automation relationship metadata', () => {
  const calls = []
  const AutomationProperties = {
    setAutomationId(target, value) {
      calls.push(['id', target, value])
    },
    setName(target, value) {
      calls.push(['name', target, value])
    },
    setHelpText(target, value) {
      calls.push(['help', target, value])
    },
    setLabeledBy(target, value) {
      calls.push(['label', target, value])
    },
    setHeadingLevel(target, value) {
      calls.push(['heading', target, value])
    },
    setPositionInSet(target, value) {
      calls.push(['position', target, value])
    },
    setSizeOfSet(target, value) {
      calls.push(['size', target, value])
    },
    setLiveSetting(target, value) {
      calls.push(['live', target, value])
    },
    setIsDialog(target, value) {
      calls.push(['dialog', target, value])
    },
    setAutomationControlType(target, value) {
      calls.push(['control', target, value])
    },
  }
  const UI = createControls({ Control: TestControl })
  const window = new TestWindow()
  const label = new TestControl()
  let control

  const handle = createWinUIRenderer({ AutomationProperties }).render(
    UI.Control({
      ref(value) {
        control = value
      },
      automationId: 'Target',
      automationName: 'Target name',
      automationHelpText: 'Target help',
      automationLabeledBy: label,
      automationHeadingLevel: 2,
      automationPositionInSet: 1,
      automationSizeOfSet: 3,
      automationLiveSetting: 1,
      automationIsDialog: true,
      automationControlType: 5,
    }),
    window,
  )

  assert.deepEqual(
    calls.map(([kind, target, value]) => [
      kind,
      target === control,
      value,
    ]),
    [
      ['id', true, 'Target'],
      ['name', true, 'Target name'],
      ['help', true, 'Target help'],
      ['label', true, label],
      ['heading', true, 2],
      ['position', true, 1],
      ['size', true, 3],
      ['live', true, 1],
      ['dialog', true, true],
      ['control', true, 5],
    ],
  )
  handle.dispose()
})

test('WinUI renderer accepts custom attached-property registrations', () => {
  const calls = []
  const DockPanel = {
    setDock(target, value) {
      calls.push([target, value])
    },
  }
  const UI = createControls({ Control: TestControl })
  let control
  const handle = createWinUIRenderer({}, {
    attachedProperties: {
      dock: { owner: DockPanel, method: 'setDock' },
    },
  }).render(
    UI.Control({
      ref(value) {
        control = value
      },
      dock: 2,
    }),
    new TestWindow(),
  )

  assert.deepEqual(calls, [[control, 2]])
  handle.dispose()
})

test('custom attached-property registrations reject missing setters', () => {
  assert.throws(
    () => createWinUIRenderer({}, {
      attachedProperties: {
        dock: { owner: {}, method: 'setDock' },
      },
    }),
    /dock requires static method setDock/,
  )
})

test('WinUI renderer keeps directly projected native collections', () => {
  const UI = createControls({
    ItemsControl: TestItemsControl,
    TextBlock: TestControl,
  })
  const window = new TestWindow()
  const handle = createWinUIRenderer({
    IVector_UIElement: {},
  }).render(
    UI.ItemsControl({
      children: UI.TextBlock({}),
    }),
    window,
  )

  assert.equal(window.content.items.values.length, 1)
  handle.dispose()
})
