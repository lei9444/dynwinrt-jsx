# 3. Create the native layout

## Generate the controls used by the series

The minimal starter intentionally generates only Button, StackPanel, and
TextBlock. Expand the `Microsoft.UI.Xaml.Controls` entry in `package.json`
before adding the remaining screens:

```json
{
  "namespace": "Microsoft.UI.Xaml.Controls",
  "classes": [
    "Button",
    "CheckBox",
    "ContentDialog",
    "NavigationView",
    "NavigationViewItem",
    "NavigationViewItemHeader",
    "NavigationViewItemSeparator",
    "StackPanel",
    "SymbolIcon",
    "TextBlock",
    "TextBox"
  ]
}
```

Regenerate the bindings:

```powershell
npm run generate
```

When a later feature introduces another native class, add it to the matching
WinMD namespace and regenerate before importing it.

Import native classes from generated bindings and turn them into typed TSX
components:

```tsx
import {
  computed,
} from 'dynwinrt-jsx/core'
import {
  createWinUIControls,
} from 'dynwinrt-jsx/controls'
import {
  styles,
  thickness,
} from 'dynwinrt-jsx/winui'
import * as WinUIBindings from '#winapp/bindings'

const UI = createWinUIControls(WinUIBindings)
```

Build the first screen:

```tsx
function DashboardPage(props: {
  readonly model: DashboardModel
}) {
  return (
    <UI.StackPanel
      padding={thickness(24)}
      spacing={16}
    >
      <UI.TextBlock
        {...styles.heading({ level: 'title' })}
        text="Task Dashboard"
      />
      <UI.TextBlock
        text={computed(() =>
          `${props.model.completedCount.value} completed`
        )}
      />
    </UI.StackPanel>
  )
}
```

`padding`, `spacing`, `text`, and typography values are native WinUI
properties. `styles.heading()` returns typed JSX properties; it is not CSS.

`createWinUIControls()` is lazy: importing the namespace does not construct
every generated control wrapper. `UI.Button` resolves and caches only the
requested binding. Use `createControls()` when supplying a deliberate custom
constructor map.

## Layout rules

- Use `StackPanel` for simple vertical or horizontal groups.
- Use `createGridControl()` when rows, columns, and attached Grid properties
  should be typed.
- Use `thickness()` and `gridLength()` instead of repeating raw structs.
- Create brushes, images, icons, and fonts only after the WinUI Worker has
  initialized.

## Checkpoint

Return `<DashboardPage model={model} />` from `renderApp()`. Change a Signal
from an event and confirm only the bound native property updates.

Next: [Add routing and navigation](04-routing-and-navigation.md).
