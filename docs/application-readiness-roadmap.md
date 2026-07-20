# Application readiness roadmap

`dynwinrt-jsx` has enough renderer and runtime capability to build a real
native WinUI application today. The remaining work is primarily product
hardening, common WinUI authoring ergonomics, distribution, and evidence from
an application that is used continuously.

This roadmap separates three targets:

- **Pilot-ready**: suitable for an internal application with a controlled
  environment.
- **Product-ready**: suitable for packaging and distributing a supported
  application.
- **Framework-ready**: suitable for independent consumers with a stable public
  API.

The estimates assume one engineer working with AI assistance and one
representative application. They are planning ranges, not release commitments.

## Current position

The 1.0 implementation already provides:

- Typed native controls and writable WinUI properties in TSX.
- Fine-grained signals, computed values, effects, batching, and owned cleanup.
- Components, Context, lifecycle callbacks, keyed lists, boundaries, portals,
  fixed-height windowing, and root replacement.
- Native WinUI resources, theme refresh, common value helpers, selected
  attached properties, and property conversion hooks.
- A Worker state bridge and a complete unpackaged WinUI startup lifecycle.
- A dependency-free project creator, a generated application template, and a
  native dashboard example.

The implementation is currently best described as:

| Area | Readiness |
|---|---|
| Renderer feature set | Ready for a pilot |
| Simple dashboard/settings UI | Ready for a pilot |
| Complex WinUI authoring | Pilot control set is covered; broader recipes remain |
| Styling developer experience | Native capability exists; framework layer is limited |
| Accessibility | Needs end-to-end application coverage |
| Native reliability | Needs a broader machine and lifecycle matrix |
| Packaging and servicing | Not included in the generated app |
| Independent package consumption | Needs a reliable artifact source and clean-machine coverage |
| Public API stability | Needs a focused compatibility review |

## Implementation principles

1. **Dogfood before expanding the abstraction.** Build one representative
   application and fix the friction it demonstrates.
2. **Keep dependencies reproducible.** Use exact tarballs, local `file:`
   dependencies, or an internal feed until registry access is reliable. Do not
   resolve `latest`.
3. **Preserve WinUI semantics.** Add ergonomic wrappers around native
   properties, resources, and visual states instead of creating a CSS engine.
4. **Keep the raw projection available.** Unsupported scenarios must remain
   possible through refs, native objects, and renderer extension hooks.
5. **Require an exit criterion for every phase.** A feature is not complete
   only because its API exists.

## Reference implementation: Microsoft.UI.Reactor

[Microsoft.UI.Reactor](https://github.com/microsoft/microsoft-ui-reactor) is
an MIT-licensed, experimental C# framework over native WinUI controls. Its
component update model is different from `dynwinrt-jsx`, but its WinUI-specific
control protocol, styling, accessibility, diagnostics, testing, and agent
tooling are valuable design references.

Use Reactor as a reference specification and source of test scenarios, not as a
runtime dependency.

| Reactor concept | `dynwinrt-jsx` adaptation | Phase |
|---|---|---|
| Declarative control descriptors | A signal-oriented adapter vocabulary for one-way, initial-only, controlled, coercing, reference, and child-shape behavior | Phase 2 |
| `ThemeRef` and typed `Theme.*` tokens | Typed WinUI resource references with a string-key escape hatch | Phase 3 |
| Element-aware theme resolution | Resolve against the nearest effective theme and scoped resources, not only application resources | Phase 3 |
| Subtree resource overrides | Preserve native hover, pressed, disabled, and High Contrast visual states | Phase 3 |
| Hybrid echo suppression | Classify synchronous, deferred, coercing, and collection-valued controlled properties | Phases 2 and 4 |
| Accessibility modifiers and scanner | TSX automation relationships, keyboard/focus helpers, and application diagnostics | Phase 4 |
| Unit, native selftest, and UIA E2E tiers | Separate pure renderer tests from real WinUI lifecycle tests and cross-process input checks | Phase 4 |
| Release-visible diagnostics | Structured startup, hosting, theme, and renderer events without sensitive payloads | Phase 4 |
| API index, focused skills, and recipes | Generate a compact public API index and task-oriented examples for AI agents | Phase 6 |

Do not copy these Reactor choices into the framework core:

- Virtual element-tree rerenders and React-style hooks. Components in
  `dynwinrt-jsx` continue to mount once and update through signals.
- C# record reconciliation, Roslyn analyzers, NativeAOT mechanics, or .NET
  hosting code.
- Control pooling until native COM identity, reset behavior, and wrapper
  lifetime have been measured for dynwinrt.
- The complete Reactor feature breadth before a pilot application proves a
  need.

Recommended upstream reading order:

1. [Control reconciler protocol](https://github.com/microsoft/microsoft-ui-reactor/blob/main/docs/guide/control-reconciler-protocol.md)
2. [Extending Reactor controls](https://github.com/microsoft/microsoft-ui-reactor/blob/main/docs/guide/extending-reactor-controls.md)
3. [Styling and theming](https://github.com/microsoft/microsoft-ui-reactor/blob/main/docs/guide/styling.md)
4. [Theme tokens](https://github.com/microsoft/microsoft-ui-reactor/blob/main/src/Reactor/Core/Theme.cs)
5. [Controlled-value echo suppression](https://github.com/microsoft/microsoft-ui-reactor/blob/main/src/Reactor/Core/ChangeEchoSuppressor.cs)
6. [Accessibility](https://github.com/microsoft/microsoft-ui-reactor/blob/main/docs/guide/accessibility.md)
7. [Testing strategy](https://github.com/microsoft/microsoft-ui-reactor/blob/main/TESTING.md)
8. [Agent skills and API index](https://github.com/microsoft/microsoft-ui-reactor/tree/main/plugins/reactor)

If source code is adapted rather than independently reimplemented, retain the
required MIT attribution and record the upstream commit used.

## Phase 0: Establish a reproducible baseline

**Estimate:** 1-2 days

The selected source repository is
[`lei9444/dynwinrt-jsx`](https://github.com/lei9444/dynwinrt-jsx).

1. Put the project under source control in the selected repository.
2. Record the supported matrix:
   - Windows versions
   - x64 and ARM64
   - Node.js versions
   - Windows App SDK version
   - compatible dynwinrt, codegen, and winapp CLI versions
3. Select a temporary artifact strategy:
   - exact `.tgz` files checked into an internal artifact store, or
   - local sibling repositories through `--local-root`, or
   - exact versions from an internal feed
4. Add automated build, type-contract, runtime, and package-content jobs.
5. Create an application from an empty directory using only the selected
   artifacts.

**Exit criterion:** a clean machine can create, restore, build, launch, close,
and rebuild the generated application without relying on an unpublished or
floating dependency.

### Verified local x64 baseline

The current source-workspace path has been exercised with:

| Component | Verified version |
|---|---|
| Architecture | Windows x64 |
| Node.js | 24.12.0 x64 |
| TypeScript | 5.9.2 |
| Rust | 1.95.0, `x86_64-pc-windows-msvc` |
| .NET SDK | 10.0.302 |
| Windows App SDK | 2.2.0 |
| Windows SDK CPP | 10.0.28000.2270 |
| dynwinrt runtime/codegen | local `0.1.0` source |
| winapp CLI | local `1.0.0` source |
| dynwinrt-jsx | local `1.0.0` source |

`scripts\run-dashboard-local.ps1` builds and launches the dashboard from the
sibling repositories without npm installation. `scripts\smoke-dashboard-ui.ps1`
uses the local winapp UI Automation commands to verify interaction,
screenshots, normal close, and renderer disposal.

`scripts\repeat-dashboard-smoke.ps1` repeats the complete application lifecycle
in fresh processes and records per-cycle exit codes, logs, screenshots, and
renderer diagnostics in `summary.json`. This provides the initial local x64
evidence for repeated startup, theme transitions, close, and restart behavior;
CI and broader machine coverage remain open.

`scripts\smoke-generated-app-local.ps1` also creates a fresh template
application outside the repository, connects only sibling source artifacts,
restores and generates bindings, compiles, launches, interacts through UIA, and
closes with zero active renderer records. Its `compatibility.json` captures the
exact source working-tree state, toolchain, SDK pins, UI evidence, and process
result. Clean-machine execution remains a separate release gate.

## Phase 1: Build the pilot application

**Estimate:** 3-5 days

Choose a bounded application such as a settings utility, dashboard, or tray
companion. It should exercise real application behavior without first
requiring every WinUI control.

1. List the screens, controls, overlays, navigation, and state transitions.
2. Generate the application and keep the generated startup architecture:
   - Windows App SDK bootstrap in the main process
   - WinUI STA and `Application.start()` in the Worker
   - explicit render-handle disposal on window close
3. Put process-owned state behind the state bridge.
4. Put every screen under an `ErrorBoundary`.
5. Record renderer diagnostics at startup, after navigation, and after close.
6. Use the raw dynwinrt projection when an ergonomic adapter does not yet
   exist; log every escape hatch as input to Phase 2.

**Exit criterion:** the application can be used daily for its primary workflow
and shuts down without active renderer records, stale event subscriptions, or
an orphaned Worker.

## Phase 2: Close common WinUI authoring gaps

**Estimate:** 1-2 weeks

Implement only the adapters required by the pilot first.

1. Define a small signal-oriented adapter vocabulary for non-trivial controls:
   - one-way properties
   - initial-only properties
   - controlled properties
   - coercing properties
   - native reference properties
   - child and collection strategies
2. Keep direct writable-property assignment as the fast path for ordinary
   generated properties; do not require a descriptor for every control.
3. Classify each controlled property as synchronous, deferred, coercing, or
   collection-valued before selecting its echo-suppression strategy.
4. Add declarative support for common complex layout values:
   - Grid row and column definitions
   - common collection-valued properties
   - named content slots that are not represented by `children`
5. Add converters or helpers for frequently used object-valued properties:
   - brushes and colors
   - icons and images
   - fonts
   - nullable values
   - URI-backed values
6. Add reusable adapters for the first product control set, likely including:
   - `NavigationView`
   - menus and flyouts
   - `ContentDialog`
   - list and selection controls
7. Generalize attached-property registration beyond the current Grid, Canvas,
   and Automation helpers.
8. Add strict TSX contracts for each adapter and keep unsupported properties as
   explicit errors.

**Exit criterion:** normal pilot screens do not require imperative native-tree
mutation. Raw access remains an exception for advanced platform features.

## Phase 3: Add an application-level styling layer

**Estimate:** 1-2 weeks

The framework already accepts native WinUI properties and `Style` resources.
This phase improves reuse rather than replacing WinUI styling.

1. Introduce a typed `ThemeToken`/`ThemeRef` surface for canonical WinUI
   resource keys, with `Theme.ref(key)` as the long-tail escape hatch.
2. Resolve tokens against the element's nearest effective
   `RequestedTheme`/`ActualTheme`, merged dictionaries, and scoped resources.
3. Subscribe once at the rendered root to native theme changes and refresh
   token-backed properties automatically.
4. Add subtree resource overrides for native control-template keys so hover,
   pressed, disabled, and High Contrast states remain intact.
5. Define typed spacing, typography, radius, and elevation tokens.
6. Add a small recipe API such as `styled()` or `createStyleRecipe()` with:
   - base properties
   - variants
   - compound variants
   - signal-backed values
7. Keep native `Style`, `ResourceDictionary`, and Fluent resources as accepted
   values.
8. Centralize Dark, Light, and High Contrast transitions.
9. Add recipes for common application surfaces: cards, primary buttons,
   section titles, form rows, and navigation items.

Do not add a CSS parser, selector engine, cascade, or React-compatible
`className`.

**Exit criterion:** the pilot has no repeated theme literals across screens,
theme transitions remain visually stable, and component variants do not
require imperative property changes.

## Phase 4: Harden reliability and accessibility

**Estimate:** 1-2 weeks

1. Establish three verification tiers:
   - pure/fake-native Node tests for algorithms and scope behavior
   - in-process tests against real WinUI controls
   - cross-process UI Automation tests for real input and accessibility
2. Exercise x64 and ARM64 on every supported Node.js and Windows combination.
3. Cover repeated startup, window close, app restart, theme changes, large
   keyed reorders, dialog and flyout lifetimes, and Worker failures.
4. Track native memory and COM object growth across repeated navigation and
   window cycles, not only JavaScript renderer counters.
5. Verify error propagation from property setters, events, effects, startup,
   and Worker termination.
6. Make Automation IDs, names, roles, and relationships usable from TSX.
7. Add reactive reference relationships such as labeled-by, described-by, and
   focus targets without sampling a stale ref.
8. Verify keyboard-only operation, focus order, text scaling, High Contrast,
   screen-reader output, and reduced-motion behavior.
9. Add release-visible structured diagnostics for startup, hosting, rendering,
   theme application, and swallowed native errors.

**Exit criterion:** supported machines complete the primary workflow without
unhandled errors or sustained native-object growth, and the workflow is usable
with keyboard and accessibility tools.

## Phase 5: Package and service the application

**Estimate:** 3-5 days

1. Add application identity, assets, and the required manifest capabilities.
2. Produce an MSIX package for x64 and ARM64.
3. Add certificate selection and signing to the release pipeline.
4. Define installation, upgrade, rollback, and uninstall behavior.
5. Keep unpackaged startup as the fast development path.
6. Generate release artifacts from pinned framework and tool packages.
7. Verify installation and first launch on a clean machine.

**Exit criterion:** a signed package installs, launches, upgrades, and
uninstalls without requiring a developer environment.

## Phase 6: Prepare the framework for independent consumers

**Estimate:** 2-4 additional weeks

1. Freeze the supported public API and document compatibility guarantees.
2. Split the renderer into smaller responsibilities before further features
   make it harder to review and maintain.
3. Add repository metadata, release automation, changelog policy, and
   provenance for published artifacts.
4. Publish compatible dynwinrt, codegen, winapp CLI, and `dynwinrt-jsx`
   versions through a dependable source.
5. Cover installation from the same artifacts that external users receive.
6. Add API reference, control recipes, troubleshooting, lifecycle, packaging,
   and migration documentation.
7. Generate a compact public API/signature index for agents and documentation.
8. Split the project skill into focused task skills and compilable recipes as
   the public surface grows.
9. Maintain at least one small generated application and one representative
   application as compatibility consumers.

**Exit criterion:** a consumer with no sibling source repositories can follow
the documented path, build an application, package it, and upgrade framework
versions without undocumented fixes.

## Prioritized backlog

| Priority | Work |
|---|---|
| P0 | Reproducible artifacts and clean-machine creation |
| P0 | One continuously used pilot application |
| P0 | Common complex-property and control adapters |
| P0 | Accessibility and native lifecycle hardening |
| P0 | Signed packaging and upgrade path |
| P1 | Theme tokens, style recipes, and scoped resources |
| P1 | Better startup diagnostics and framework error messages |
| P1 | Renderer decomposition and API compatibility review |
| P1 | Product-focused guides and recipes |
| P2 | Integrated hot reload and richer developer diagnostics |
| P2 | Broader control recipes and advanced virtualization |
| P2 | Inspector or DevTools integration |

## Recommended delivery slices

Keep each slice usable and independently reviewable:

1. Reproducible dependency and artifact contract.
2. Pilot application shell and state ownership.
3. Grid, collection, and named-content adapters.
4. Navigation, menu, dialog, icon, and image recipes.
5. Accessibility property and focus support.
6. Theme tokens and component variants.
7. Native lifecycle and architecture matrix.
8. MSIX packaging, signing, and upgrade flow.
9. Public API freeze and release automation.

## Execution checklist

### Existing 1.0 baseline

- [x] Typed native controls, properties, events, refs, and children.
- [x] Signals, deterministic scheduling, lifecycle, Context, and cleanup.
- [x] Keyed lists, boundaries, portals, fixed-height windowing, and hot roots.
- [x] WinUI resources, theme refresh, selected converters, and attached props.
- [x] Worker state bridge and unpackaged WinUI lifecycle.
- [x] Project creator, application template, dashboard, and package tarball.

### Phase 0: Reproducible baseline

- [x] Select `lei9444/dynwinrt-jsx` as the source repository.
- [x] Document the Windows, architecture, Node.js, and Windows App SDK matrix.
- [ ] Pin compatible dynwinrt, codegen, winapp CLI, and JSX artifacts.
- [ ] Select a tarball, local `file:`, or internal-feed distribution path.
- [x] Add automated build, type-contract, runtime, and package-content jobs.
- [ ] Complete creation and launch from an empty directory on a clean machine.

### Phase 1: Pilot application

- [ ] Select the pilot application and define its primary workflow.
- [ ] Inventory required controls, overlays, navigation, and state.
- [ ] Generate the application from the pinned artifacts.
- [x] Keep process-owned state behind the Worker state bridge.
- [ ] Put each screen under an `ErrorBoundary`.
- [ ] Record every raw dynwinrt escape hatch.
- [ ] Capture renderer diagnostics before and after each navigation path.
- [ ] Use the pilot continuously for its primary workflow.

### Phase 2: WinUI authoring gaps

- [x] Define one-way, initial-only, controlled, coercing, reference, and
      child-strategy adapter shapes.
- [x] Preserve direct generated-property assignment for ordinary controls.
- [x] Classify controlled properties by synchronous, deferred, coercing, or
      collection-valued behavior.
- [x] Add declarative Grid row and column definitions.
- [x] Add adapters for common collection-valued properties.
- [x] Add named-content slots beyond `children`, `child`, `content`, and `items`.
- [x] Add common brush, icon, image, font, nullable, and URI helpers.
- [x] Add the pilot's navigation, menu, and dialog adapters.
- [x] Add the pilot's flyout adapters.
- [x] Add the pilot's list and selection-control adapters.
- [x] Add integrated TSX hot reload with state preservation and error recovery.
- [x] Generalize attached-property registration.
- [x] Add strict TSX contracts for every new adapter.
- [x] Remove routine imperative native-tree mutations from pilot screens.

The Flyout shutdown access violation was fixed with an explicit package-local
projection lifetime scope: raw and cast runtime-class values created while the
scope is active are released from `AppWindow.Closing` before XAML core teardown.

### Phase 3: Styling and themes

- [ ] Add typed WinUI theme tokens with a string-key escape hatch.
- [ ] Resolve tokens against effective element themes and scoped resources.
- [ ] Refresh token-backed properties automatically on native theme changes.
- [ ] Add subtree resource overrides that preserve control visual states.
- [ ] Define typed spacing, typography, radius, and elevation tokens.
- [ ] Implement a small style-recipe API with variants.
- [ ] Support signal-backed recipe values.
- [ ] Preserve native `Style`, `ResourceDictionary`, and Fluent resources.
- [ ] Centralize Dark, Light, and High Contrast transitions.
- [ ] Replace repeated pilot styling literals with tokens or recipes.

### Phase 4: Reliability and accessibility

- [ ] Add a real WinUI in-process verification tier.
- [x] Add a cross-process UI Automation E2E tier.
- [ ] Exercise every supported x64 and ARM64 configuration.
- [ ] Exercise every supported Node.js and Windows configuration.
- [x] Cover repeated startup, close, restart, and theme transitions.
- [ ] Cover large keyed reorders, dialogs, flyouts, and Worker failures.
- [x] Measure native memory and COM object growth across repeated cycles.
- [ ] Verify property, event, effect, startup, and Worker error propagation.
- [x] Make Automation IDs, names, roles, and relationships usable from TSX.
- [ ] Add reactive automation and focus reference relationships.
- [ ] Verify keyboard navigation and focus order.
- [ ] Verify text scaling, High Contrast, screen readers, and reduced motion.
- [x] Add actionable application startup and failure logging.

### Phase 5: Packaging and servicing

- [ ] Add package identity, manifest capabilities, and visual assets.
- [ ] Produce x64 and ARM64 MSIX packages.
- [ ] Sign release packages.
- [ ] Define install, upgrade, rollback, and uninstall behavior.
- [ ] Keep unpackaged startup available for development.
- [ ] Build release artifacts only from pinned dependencies.
- [ ] Install, launch, upgrade, and uninstall on a clean machine.

### Phase 6: Independent framework consumption

- [ ] Freeze the supported public API.
- [ ] Document version compatibility guarantees.
- [ ] Split the renderer into smaller maintainable responsibilities.
- [ ] Add package metadata, release automation, and artifact provenance.
- [ ] Publish a compatible framework and tool package set.
- [ ] Add API, control, lifecycle, troubleshooting, and packaging guides.
- [ ] Generate a compact public API/signature index.
- [ ] Add focused agent skills and compilable task recipes.
- [ ] Maintain generated and representative compatibility applications.
- [ ] Complete an upgrade using only consumer-facing documentation.

### Release gates

- [ ] **Pilot-ready:** the primary workflow is used daily and closes cleanly.
- [ ] **Product-ready:** a signed package completes the supported workflow on
      every target configuration.
- [ ] **Framework-ready:** an independent consumer can create, package, and
      upgrade an application without sibling repositories or undocumented
      fixes.

## Expected timeline

| Target | Additional effort |
|---|---:|
| Start a simple internal application | Now |
| Daily-use pilot | 1-2 weeks |
| Supported, distributable product | 4-6 weeks |
| General public framework | 2-3 months |

The quickest path is not to complete every framework feature first. Start the
pilot immediately, treat each raw WinRT workaround as measured framework
backlog, and promote only repeated application patterns into public APIs.
