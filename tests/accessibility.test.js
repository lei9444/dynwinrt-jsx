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
