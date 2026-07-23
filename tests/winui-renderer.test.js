'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createControls,
  createWinUIRenderer,
  createWinUIRendererPreset,
} = require('../dist/index.js')

class TestWindow {
  content = null
}

class TestCheckBox {
  isChecked = null
}

class TestContentControl {
  content = null
}

class TestTextBlock {
  text = ''
}

test('WinUI renderer preset detects and applies generated binding capabilities', () => {
  const bindings = {
    TextBlock: TestTextBlock,
    PropertyValue: {
      createBoolean(value) {
        return { value }
      },
      createString(value) {
        return value
      },
    },
    IReference_Boolean: {
      from(value) {
        return { reference: value }
      },
    },
    IVector_UIElement: {},
    Application: {},
    IMap_Object_Object: {},
    ResourceDictionary: class {},
    Grid: {
      setRow() {},
      setColumn() {},
      setRowSpan() {},
      setColumnSpan() {},
    },
    Canvas: {
      setLeft() {},
      setTop() {},
    },
    AutomationProperties: {
      setAutomationId() {},
      setName() {},
      setHelpText() {},
      setLabeledBy() {},
      setHeadingLevel() {},
      setPositionInSet() {},
      setSizeOfSet() {},
      setLiveSetting() {},
      setIsDialog() {},
      setAutomationControlType() {},
    },
  }
  const preset = createWinUIRendererPreset(bindings)

  assert.deepEqual(preset.capabilities, {
    text: true,
    nullableBoolean: true,
    uiElementCollections: true,
    resources: true,
    resourceOverrides: true,
    grid: true,
    canvas: true,
    automation: true,
  })

  const UI = createControls({
    CheckBox: TestCheckBox,
    ContentControl: TestContentControl,
  })
  const checkedWindow = new TestWindow()
  const checkedHandle = preset.createRenderer().render(
    UI.CheckBox({ isChecked: true }),
    checkedWindow,
  )
  assert.deepEqual(checkedWindow.content.isChecked, {
    reference: { value: true },
  })
  checkedHandle.dispose()

  const contentWindow = new TestWindow()
  const contentHandle = preset.createRenderer().render(
    UI.ContentControl({ content: 'Hello' }),
    contentWindow,
  )
  assert.equal(contentWindow.content.content.text, 'Hello')
  contentHandle.dispose()
})

test('WinUI renderer reports missing generated conversion bindings', () => {
  const UI = createControls({
    CheckBox: TestCheckBox,
    ContentControl: TestContentControl,
  })

  assert.throws(
    () => createWinUIRenderer({}).render(
      UI.CheckBox({ isChecked: true }),
      new TestWindow(),
    ),
    /Boolean isChecked conversion requires generated WinUI bindings for PropertyValue and IReference_Boolean/,
  )
  assert.throws(
    () => createWinUIRenderer({}).render(
      UI.ContentControl({ content: 'Hello' }),
      new TestWindow(),
    ),
    /Primitive content conversion requires generated WinUI bindings for TextBlock/,
  )
})
