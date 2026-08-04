import {
  type Child,
} from 'dynwinrt-jsx/core'
import {
  createWinUIControls,
} from 'dynwinrt-jsx/controls'
import {
  thickness,
} from 'dynwinrt-jsx/winui'
import * as WinUIBindings from '#winapp/bindings'
import type { AppModel } from './app-model'

const UI = createWinUIControls(WinUIBindings)

export function renderApp(
  model: AppModel,
  close: () => void,
): Child {
  return (
    <UI.StackPanel
      padding={thickness(24)}
      spacing={12}
    >
      <UI.TextBlock
        text={model.countText}
        fontSize={28}
      />
      <UI.Button
        automationId="IncrementButton"
        content="Increment"
        onClick={model.increment}
      />
      <UI.Button
        automationId="Close"
        content="Close"
        onClick={close}
      />
    </UI.StackPanel>
  )
}
