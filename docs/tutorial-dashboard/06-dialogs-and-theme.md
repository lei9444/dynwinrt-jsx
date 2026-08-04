# 6. Add dialogs and theme

## Controlled task input

Bind a TextBox to a Signal:

```tsx
import {
  onCleanup,
  signal,
} from 'dynwinrt-jsx/core'

const draft = signal('')

<UI.TextBox
  text={draft}
  onTextChanged={(sender) => {
    draft.value = sender.text
  }}
/>
<UI.Button
  content="Add task"
  onClick={() => {
    model.addTask(draft.value)
    draft.value = ''
  }}
/>
```

For repeated two-way patterns, use `bind.twoWay()` from
`dynwinrt-jsx/core`.

## ContentDialog

```tsx
import {
  showContentDialog,
} from 'dynwinrt-jsx/controls'

const dialog = new ContentDialog()
await showContentDialog({
  renderer,
  dialog,
  xamlRoot,
  content: (
    <UI.TextBlock text="Delete this task?" />
  ),
})
```

The helper owns the dialog content scope and restores focus after the native
Closed event.

## Theme

```tsx
import {
  createWinUIThemeController,
  styles,
  tokens,
} from 'dynwinrt-jsx/winui'

const themeController = createWinUIThemeController({
  isDark: model.darkTheme,
  setDark: model.setDarkTheme,
  application: Application.current,
  bindings: WinUIBindings,
})
onCleanup(themeController.dispose)
```

Use `tokens` and `styles` for repeated spacing and typography. Use
`resource()` or `theme.*` for native WinUI resources; do not introduce CSS
selectors or class names.

Next: [Persist validated Worker state](07-state-and-persistence.md).
