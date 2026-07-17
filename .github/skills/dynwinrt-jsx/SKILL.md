---
name: dynwinrt-jsx
description: Build, extend, debug, and review dynwinrt-jsx and native WinUI 3 applications that use it. Use when working with TSX controls, signals, renderer behavior, lifecycle, Context, control flow, WinUI resources or themes, generated dynwinrt bindings, the project creator, templates, or examples in this repository.
license: MIT
---

# dynwinrt-jsx development

Use this skill for framework changes and for applications built with
`dynwinrt-jsx`.

## Read first

Before changing behavior:

1. Read `README.md` for the public API and supported semantics.
2. Read `docs/application-readiness-roadmap.md` for implementation order and
   release gates.
3. Read `docs/migration-v1.md` when changing an existing public API.
4. Inspect the generated dynwinrt declaration for every native type involved.
   Do not guess WinRT property or event shapes.
5. Use Microsoft.UI.Reactor as a WinUI design and test reference when working
   on adapters, themes, controlled properties, accessibility, diagnostics, or
   agent tooling.

Do not edit `dist` or the package tarball directly. They are generated from
`src` and the package manifest.

## Mental model

`dynwinrt-jsx` is a TypeScript automatic JSX runtime over real
dynwinrt-projected WinUI objects:

```text
Application TSX
    |
    v
VNode descriptors and fine-grained signals
    |
    v
dynwinrt-jsx native renderer
    |
    v
Generated dynwinrt JavaScript classes
    |
    v
Native WinUI 3 controls
```

It is not React and does not use a browser DOM or virtual-DOM reconciliation.
A function component runs once for each mount. Signals update the affected
native property or child range directly.

## External design reference

[Microsoft.UI.Reactor](https://github.com/microsoft/microsoft-ui-reactor) is a
useful reference for WinUI-specific framework behavior. Consult these areas:

- `ControlDescriptor` and child strategies for adapter vocabulary.
- `ThemeRef`, typed theme tokens, and subtree resource overrides for styling.
- `ChangeEchoSuppressor` for controlled-value edge-case classification.
- Accessibility modifiers, reactive element references, and runtime scanning.
- Unit, real-WinUI selftest, and UI Automation E2E test tiers.
- Structured diagnostics, focused agent skills, API indexes, and recipes.

Adapt those concepts to the signal-owned `dynwinrt-jsx` lifecycle. Do not add
Reactor's virtual-tree rerenders, hook-order model, C# record reconciliation,
Roslyn/AOT machinery, or control pooling without dynwinrt-specific lifetime
evidence. See `docs/application-readiness-roadmap.md` for links and the phased
adoption map.

## Source map

| Area | Files |
|---|---|
| Signals, scheduling, scopes, lifecycle | `src/reactive.ts` |
| VNode and JSX descriptors | `src/vnode.ts`, `src/jsx-runtime.ts` |
| Native control typing and factories | `src/native.ts` |
| Mounting, updates, child adapters, disposal | `src/renderer.ts` |
| WinUI resources, converters, attached props | `src/winui.ts` |
| `Show`, `For`, boundaries, portals, windowing | `src/control-flow.ts` |
| Context | `src/context.ts` |
| One-way and two-way props | `src/binding.ts` |
| Worker state synchronization | `src/bridge.ts` |
| Root replacement | `src/hot.ts` |
| Public exports | `src/index.ts` |
| Project creation | `bin/create.js`, `templates/winui` |
| Representative native app | `examples/dashboard` |
| Runtime and type contracts | `tests` |

## Required invariants

Preserve these rules in every change:

1. **UI thread ownership**
   - Bootstrap the Windows App SDK in the main process before creating the UI
     Worker.
   - Initialize the Worker as an STA with `roInitialize(0)`.
   - Create all WinUI objects after `Application.start()` enters
     `Application.create()`.
   - Never create brushes, controls, resources, or other WinUI objects on the
     main thread or at module initialization before the application callback.

2. **Explicit lifetime**
   - Every component, dynamic branch, list entry, boundary, and portal owns a
     reactive scope.
   - Removing a subtree must release effects, subscriptions, event handlers,
     refs, children, and native diagnostics exactly once.
   - Dispose the render handle from the window closed callback, then call
     `Application.current.exit()`.

3. **Deterministic reactivity**
   - Computed observers settle before effects.
   - Batches must not expose an intermediate computed graph.
   - A function component does not rerender as a unit; use signals or replace
     an explicit root.

4. **Stable keyed identity**
   - `For` preserves the native subtree when a key and item identity remain the
     same.
   - Its index argument is a `ReadonlySignal<number>`.
   - Duplicate keys fail before mutating the native collection.

5. **Native semantics**
   - JSX writable properties come from generated dynwinrt declarations.
   - Generated `onX(callback)` methods become JSX event properties.
   - Keep raw projected objects and refs available as escape hatches.
   - Reject unknown JSX properties instead of silently ignoring them.

6. **Errors remain visible**
   - Route renderer errors through the nearest `ErrorBoundary` when one owns
     the subtree.
   - Do not add broad catches, silent fallbacks, or success-shaped error
     handling.
   - Cleanup should continue after one cleanup fails, then report the first
     failure.

## Native child shapes

The renderer currently understands:

| Native shape | JSX behavior |
|---|---|
| `children` collection | Ordered insertion, removal, and movement |
| `child` property | One child |
| `content` property | One child |
| `items` collection | Ordered collection synchronization |

For any other collection or named slot, add an explicit adapter. Do not make a
control appear to work by imperatively mutating it only in an example.

## WinUI properties and styling

- All writable generated properties can be static values or signals.
- `style` is a native WinUI `Style`, not a React inline-style object.
- `resource(key, fallback?)` currently resolves through
  `Application.current.resources`.
- To refresh a theme resource, pass the theme signal as the third argument and
  update that signal in the same `batch()` as
  `Application.current.requestedTheme`.
- Prefer `thickness()`, `cornerRadius()`, and `color()` over repeated raw
  struct literals.
- Reuse styling through components, native resources, and typed recipes.
- Do not introduce CSS parsing, selectors, cascading, `className`, or DOM
  concepts.

The built-in WinUI layer currently provides:

- Grid row, column, and span attached setters.
- Canvas left and top attached setters.
- Automation ID and name attached setters when those bindings are supplied.
- Primitive `content` and `header` conversion to native `TextBlock`.
- Boolean `isChecked` conversion to `IReference<Boolean>`.

Add new behavior through `propertySetters`, `propertyConverters`,
`convertProperty`, or a custom `native()` component setter. Keep converters
specific enough that they cannot corrupt unrelated native properties.

## Adding a WinUI control

1. Add the class to `winapp.jsBindings.additionalWinmds` in the consuming
   application's `package.json`.
2. Regenerate the bindings with the application's `npm run generate` workflow.
3. Inspect the generated `.d.ts` file for constructors, writable properties,
   events, child collections, and object-valued properties.
4. Import the generated constructor and add it to `createControls()`.
5. Pass any interfaces or helper classes required by collection adapters,
   resources, attached properties, or converters to `createWinUIRenderer()`.
6. Add a framework adapter only when the control's native shape cannot be
   represented by existing properties and children.
7. Add a strict TSX contract and a representative application use.

## Changing renderer or reactivity behavior

1. Write the observable behavior first:
   - native identity
   - property values
   - child order
   - event subscription count
   - cleanup count
   - error context
2. Keep mutations transactional where a failure could otherwise leave a
   partially updated native collection.
3. Exercise mount, update, replacement, removal, and repeated disposal.
4. Check renderer diagnostics return to the previous active count.
5. Use a real WinUI application when the change affects COM lifetime, thread
   affinity, resources, focus, or control behavior. Fake controls cannot prove
   those properties.

`src/renderer.ts` is already large. Prefer extracting a focused helper or
service over adding another unrelated responsibility to it.

## Changing the public API

1. Add the implementation under `src`.
2. Export it from `src/index.ts` and, if needed, the JSX runtime entry points.
3. Add declaration-level coverage in `tests/types.tsx`.
4. Add behavior coverage in the nearest runtime test.
5. Update `README.md`.
6. Update `docs/migration-v1.md` for a breaking or behavior-changing API.
7. Update the template and dashboard when they should demonstrate the new
   preferred path.
8. Rebuild the package and regenerate `dynwinrt-jsx-1.0.0.tgz`.

## Changing the project creator or template

Keep normal and local modes aligned:

- Normal mode uses exact package versions.
- `--local-root` uses sibling `file:` dependencies.
- Local codegen is built from the sibling dynwinrt repository.
- Neither mode resolves npm `latest`.

When changing scaffolding, update:

- `bin/create.js`
- `templates/winui`
- `tests/scaffold.test.js`
- the create-app instructions in `README.md`

The generated app must retain:

- main-process Windows App SDK bootstrap
- Worker-owned WinUI STA
- explicit state-port transfer
- error forwarding
- close-time renderer disposal

## Commands

From the repository root:

```powershell
npm run typecheck
npm test
npm run check
npm pack --quiet
```

Use `npm run check` for source or behavior changes. `npm pack --quiet` runs the
prepack checks and refreshes the local tarball.

Create an application from sibling repositories:

```powershell
node bin\create.js create <target-directory> --local-root <work-root>
```

Run the existing dashboard after its local dependencies are prepared:

```powershell
cd examples\dashboard
npm start
```

Do not install a newer dependency merely to make a change pass. Preserve exact
versions unless the task is explicitly a dependency upgrade.

## Current limits

Account for these limits when designing a feature:

- Function components do not rerender like React components.
- `VirtualFor` is fixed-height windowing, not native `ItemsRepeater`
  virtualization.
- State bridges clone complete state and do not validate schemas.
- Object-valued WinRT properties require projected objects unless a converter
  handles them.
- Resource keys are strings and are not statically verified.
- Resource lookup is application-level unless a custom resolver is provided.
- Complex collections and named content slots need explicit adapters.
- There is no CSS-like styling system or integrated DevTools.
- All WinUI reads and writes must remain on the UI STA.

## Definition of done

A framework change is complete only when:

- the implementation preserves the invariants above;
- public typing and runtime behavior agree;
- owned work and native event subscriptions are released;
- the preferred path is reflected in documentation and relevant examples;
- templates remain reproducible with exact or local dependencies; and
- generated package contents are refreshed when public artifacts changed.
