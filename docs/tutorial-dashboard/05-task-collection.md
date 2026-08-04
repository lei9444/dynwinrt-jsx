# 5. Render and edit the task collection

Use `For` for a normal keyed native collection:

```tsx
import {
  For,
  computed,
} from 'dynwinrt-jsx/core'
import {
  Orientation,
} from '#winapp/bindings'

<For
  each={model.tasks}
  key={(task) => task.id}
>
  {(task, index) => (
    <UI.StackPanel orientation={Orientation.Horizontal}>
      <UI.CheckBox
        isChecked={task.completed}
        onClick={() =>
          model.updateTask(task.id, !task.completed)
        }
      />
      <UI.TextBlock
        text={computed(() =>
          `${index.value + 1}. ${task.title}`
        )}
      />
    </UI.StackPanel>
  )}
</For>
```

## Stable identity

The key identifies the native subtree. Keep the same item object when only its
position changes if native identity should be preserved.

Update arrays by assigning a new value:

```ts
tasks.value = tasks.value.map((task) =>
  task.id === id
    ? { ...task, completed }
    : task,
)
```

Duplicate keys fail before the native collection is mutated.

## When to use native virtualization

Use `createItemsRepeaterControl()` when the collection is large or has dynamic
row heights:

```ts
import {
  createItemsRepeaterControl,
} from 'dynwinrt-jsx/controls'
```

ItemsRepeater requires its generated control, host, layout, observable-vector,
element-factory, and PropertyValue bindings. Follow the
[control-generation workflow](03-controls-and-layout.md#generate-the-controls-used-by-the-series)
before enabling that optional path.

Do not use `VirtualFor` for dynamic-height native lists. `VirtualFor` is the
fixed-height application-managed option.

Next: [Add dialogs and theme](06-dialogs-and-theme.md).
