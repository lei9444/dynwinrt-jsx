# 4. Add routing and navigation

Define the application routes:

```tsx
import {
  Outlet,
  RouterProvider,
  createRouter,
  type RouteDefinition,
} from 'dynwinrt-jsx/core'

type DashboardRoute = 'dashboard' | 'tasks' | 'settings'

const routes: readonly RouteDefinition[] = [
  {
    id: 'dashboard',
    path: '/',
    render: () => <DashboardPage model={model} />,
  },
  {
    id: 'tasks',
    path: '/tasks',
    render: () => <TasksPage model={model} />,
  },
  {
    id: 'settings',
    path: '/settings',
    render: () => <SettingsPage model={model} />,
  },
]

const router = createRouter({
  routes,
  initialEntries: ['/'],
})
```

Render the current route:

```tsx
<RouterProvider router={router}>
  <Outlet />
</RouterProvider>
```

## Connect NavigationView

Use the control-specific shell rather than manually synchronizing selected
items:

```tsx
import {
  createNavigationViewControl,
  createRouterNavigationViewShell,
} from 'dynwinrt-jsx/controls'
```

`createRouterNavigationViewShell()` maps route handles to
`NavigationViewItem`s and preserves the framework's separate native selection,
disposal, and route mount turns.

## Keep shell-native types separate

When the shell needs `Renderer`, `Window`, diagnostics, or projected ownership,
place that context in `src/dashboard-shell.ts`:

```ts
import type {
  ProjectedOwnership,
  Renderer,
} from 'dynwinrt-jsx/native'
import type { Window } from '#winapp/bindings'

export interface DashboardAppContext
extends ProjectedOwnership {
  readonly model: DashboardModel
  readonly renderer: Renderer
  readonly window: Window
}
```

Screen modules import only `DashboardAppContext`; they do not import the native
escape-hatch layer directly.

The complete implementation is in
[`dashboard-app.tsx`](../../examples/dashboard/src/dashboard-app.tsx).

## Cleanup

The router owns reactive scopes and history. Dispose it with the model or the
application scope; do not leave route subscriptions in module globals.

Next: [Render and edit the task collection](05-task-collection.md).
