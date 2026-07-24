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
  isThreeState = false
}

class TestToggleSplitButton {
  isChecked = false
}

class TestToggleSwitch {
  onContent = null
  offContent = null
}

class TestContentControl {
  content = null
}

class TestTextBlock {
  text = ''
}

class TestCalendarDatePicker {
  isCalendarOpen = false
  placeholderText = ''
  date = null
}

class TestDatePicker {
  dayVisible = true
  yearVisible = true
  selectedDate = null
}

class TestTimePicker {
  clockIdentifier = '12HourClock'
  minuteIncrement = 1
  selectedTime = null
}

test('WinUI renderer preset detects and applies generated binding capabilities', () => {
  const toolTips = new WeakMap()
  const toolTipPlacements = new WeakMap()
  const bindings = {
    TextBlock: TestTextBlock,
    PropertyValue: {
      createBoolean(value) {
        return { value }
      },
      createDateTime(value) {
        return { value }
      },
      createString(value) {
        return value
      },
      createTimeSpan(value) {
        return { value }
      },
    },
    IReference_Boolean: {
      from(value) {
        return { reference: value }
      },
    },
    IReference_DateTime: {
      from(value) {
        return { dateReference: value }
      },
    },
    IReference_TimeSpan: {
      from(value) {
        return { timeReference: value }
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
    ToolTipService: {
      setToolTip(target, value) {
        toolTips.set(target, value)
      },
      setPlacement(target, value) {
        toolTipPlacements.set(target, value)
      },
      setPlacementTarget() {},
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
    nullableDateTime: true,
    nullableTimeSpan: true,
    uiElementCollections: true,
    resources: true,
    resourceOverrides: true,
    grid: true,
    canvas: true,
    toolTip: true,
    automation: true,
  })

  const UI = createControls({
    CheckBox: TestCheckBox,
    CalendarDatePicker: TestCalendarDatePicker,
    ContentControl: TestContentControl,
    DatePicker: TestDatePicker,
    TimePicker: TestTimePicker,
    ToggleSplitButton: TestToggleSplitButton,
    ToggleSwitch: TestToggleSwitch,
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

  const toggleWindow = new TestWindow()
  const toggleHandle = preset.createRenderer().render(
    UI.ToggleSplitButton({ isChecked: true }),
    toggleWindow,
  )
  assert.equal(toggleWindow.content.isChecked, true)
  toggleHandle.dispose()
  assert.throws(
    () => preset.createRenderer().render(
      UI.ToggleSplitButton({ isChecked: null }),
      new TestWindow(),
    ),
    /isChecked does not accept null on this native control/,
  )

  const switchWindow = new TestWindow()
  const switchHandle = preset.createRenderer().render(
    UI.ToggleSwitch({
      onContent: 'Working',
      offContent: 'Paused',
    }),
    switchWindow,
  )
  assert.equal(switchWindow.content.onContent.text, 'Working')
  assert.equal(switchWindow.content.offContent.text, 'Paused')
  switchHandle.dispose()

  const contentWindow = new TestWindow()
  const contentHandle = preset.createRenderer().render(
    UI.ContentControl({
      content: 'Hello',
      toolTip: 'More information',
      toolTipPlacement: 1,
    }),
    contentWindow,
  )
  assert.equal(contentWindow.content.content.text, 'Hello')
  assert.equal(
    toolTips.get(contentWindow.content).text,
    'More information',
  )
  assert.equal(toolTipPlacements.get(contentWindow.content), 1)
  contentHandle.dispose()

  const date = { universalTime: 133_986_528_000_000_000n }
  const calendarWindow = new TestWindow()
  const calendarHandle = preset.createRenderer().render(
    UI.CalendarDatePicker({ date }),
    calendarWindow,
  )
  assert.deepEqual(calendarWindow.content.date, {
    dateReference: { value: date },
  })
  calendarHandle.dispose()

  const datePickerWindow = new TestWindow()
  const datePickerHandle = preset.createRenderer().render(
    UI.DatePicker({ selectedDate: date }),
    datePickerWindow,
  )
  assert.deepEqual(datePickerWindow.content.selectedDate, {
    dateReference: { value: date },
  })
  datePickerHandle.dispose()

  const time = { duration: 342_000_000_000n }
  const timePickerWindow = new TestWindow()
  const timePickerHandle = preset.createRenderer().render(
    UI.TimePicker({ selectedTime: time }),
    timePickerWindow,
  )
  assert.deepEqual(timePickerWindow.content.selectedTime, {
    timeReference: { value: time },
  })
  timePickerHandle.dispose()
})

test('WinUI renderer reports missing generated conversion bindings', () => {
  const UI = createControls({
    CheckBox: TestCheckBox,
    CalendarDatePicker: TestCalendarDatePicker,
    ContentControl: TestContentControl,
    DatePicker: TestDatePicker,
    TimePicker: TestTimePicker,
    ToggleSplitButton: TestToggleSplitButton,
    ToggleSwitch: TestToggleSwitch,
  })

  assert.throws(
    () => createWinUIRenderer({}).render(
      UI.CheckBox({ isChecked: true }),
      new TestWindow(),
    ),
    /Boolean isChecked conversion requires generated WinUI bindings for PropertyValue and IReference_Boolean/,
  )
  const toggleWindow = new TestWindow()
  const toggleHandle = createWinUIRenderer({}).render(
    UI.ToggleSplitButton({ isChecked: true }),
    toggleWindow,
  )
  assert.equal(toggleWindow.content.isChecked, true)
  toggleHandle.dispose()
  assert.throws(
    () => createWinUIRenderer({}).render(
      UI.ToggleSplitButton({ isChecked: null }),
      new TestWindow(),
    ),
    /isChecked does not accept null on this native control/,
  )
  assert.throws(
    () => createWinUIRenderer({}).render(
      UI.ContentControl({ content: 'Hello' }),
      new TestWindow(),
    ),
    /Primitive content conversion requires generated WinUI bindings for TextBlock/,
  )
  assert.throws(
    () => createWinUIRenderer({}).render(
      UI.CalendarDatePicker({
        date: { universalTime: 133_986_528_000_000_000n },
      }),
      new TestWindow(),
    ),
    /CalendarDatePicker date conversion requires generated WinUI bindings for PropertyValue and IReference_DateTime/,
  )
  assert.throws(
    () => createWinUIRenderer({}).render(
      UI.DatePicker({
        selectedDate: {
          universalTime: 133_986_528_000_000_000n,
        },
      }),
      new TestWindow(),
    ),
    /DatePicker selectedDate conversion requires generated WinUI bindings for PropertyValue and IReference_DateTime/,
  )
  assert.throws(
    () => createWinUIRenderer({}).render(
      UI.TimePicker({
        selectedTime: { duration: 342_000_000_000n },
      }),
      new TestWindow(),
    ),
    /TimePicker selectedTime conversion requires generated WinUI bindings for PropertyValue and IReference_TimeSpan/,
  )
})
