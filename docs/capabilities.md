# Capability matrix

## Core model

| Capability | Status | Preferred API |
|---|---|---|
| Fine-grained state | Supported | `signal`, `computed`, `effect`, `batch` |
| Conditional content | Supported | `Show` |
| Stable keyed collections | Supported | `For` |
| Fixed-height windowing | Supported | `VirtualFor` |
| Native dynamic virtualization | Supported | `createItemsRepeaterControl`, `createVirtualizedItemsControl` |
| Error isolation | Supported | `ErrorBoundary` |
| Portals | Supported | `Portal` |
| Context | Supported | `createContext`, `useContext` |
| Synchronous lazy modules | Supported | `createLazyComponent` |
| User-triggered async work | Supported | `createAsyncAction`, `AsyncView` |
| Source-driven async resources | Deferred | Add after two independent applications share the same semantics |

Function components mount once. They do not rerender as a unit.

## Native rendering and lifetime

| Capability | Status | Notes |
|---|---|---|
| Writable generated properties | Supported | Static values or Signals |
| Generated events | Supported | `onX` methods become JSX event props |
| `children`, `child`, `content`, `items` | Supported | Other slots require explicit adapters |
| Property phases | Supported | before children, after children, after mount |
| Controlled native values | Supported | Shared echo suppression and rollback foundation |
| Projected ownership | Supported | App-bound and standalone owners |
| Generic native resource ownership | Supported | `createNativeResourceOwner` |
| Composition animation ownership | Supported | `createCompositionOwner` |
| Native release retry | Supported | Failed resource cleanup remains retryable |

## WinUI layer

| Area | Status |
|---|---|
| Grid definitions and attached properties | Supported |
| NavigationView route shell | Supported |
| ListView, ComboBox, SelectorBar | Supported |
| ScrollViewer reactive state | Supported |
| ScrollViewer immediate/frame/native sampling | Supported |
| Dialog, flyout, popup, TeachingTip | Supported |
| Resources, themes, tokens, styles | Supported |
| Automation metadata and focus targets | Supported |
| Secondary Window/AppWindow lifecycle | Supported |
| Native ItemsRepeater/ItemsView virtualization | Supported |
| CSS, selectors, cascading, `className` | Not planned |

## Runtime and diagnostics

| Capability | Status | Entry point |
|---|---|---|
| Main-process host | Supported | `dynwinrt-jsx/host` |
| Worker-owned WinUI app | Supported | `dynwinrt-jsx/worker` |
| State bridge and persistence | Supported | root/host/worker APIs |
| Hot reload | Supported | Worker runtime and render handles |
| Inspector and bounded operations | Supported | `Renderer.inspector` |
| Heartbeat and timeout evidence | Supported | Host evidence presets |
| Structured evidence bundle | Supported | diagnostics APIs |
| Unified validation suite | Supported | `scripts/run-validation-suite.ps1` |

## Performance guidance

- Group properties that always change together with `adapter.oneWay(setter)`.
- Use `createLazyComponent()` for non-first-screen modules.
- Use `createCompositionFrameScheduler()` and last-value coalescers for
  high-frequency native events.
- Use `sampling: 'frame'` or `'native'` for ScrollViewer state when immediate
  reactive delivery is unnecessary.
- Use native virtualization rather than mounting thousands of controls.
- Use the minimal Inspector profile in production when detailed evidence is
  not required.

See [`api-index.md`](api-index.md) for signatures and
[`validation.md`](validation.md) for release checks.
