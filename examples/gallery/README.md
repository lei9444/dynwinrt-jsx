# dynwinrt-jsx Gallery

The Gallery is an interactive native WinUI 3 reference application for
`dynwinrt-jsx`. It follows the metadata, navigation, search, and live-sample
structure of WinUI Gallery while using TypeScript JSX instead of compiled XAML,
reflection, or source-generated page mappings.

The pages cover:

- signals, computed values, `Show`, and keyed `For`;
- the complete WinUI Gallery Basic input category: Button, DropDownButton,
  HyperlinkButton, RepeatButton, ToggleButton, SplitButton, ToggleSplitButton,
  CheckBox, ColorPicker, ComboBox, RadioButton, RatingControl, Slider, and
  ToggleSwitch;
- a Basic input category landing page with links to all 14 controls;
- the complete WinUI Gallery Collections category: FlipView, GridView,
  ItemsRepeater, ItemsView, ListView, PullToRefresh, and TreeView;
- a responsive Collections category landing page with links to all seven
  controls;
- the complete Date & time, Dialogs & flyouts, Status & info, Layout,
  Menus & toolbars, Navigation, Scrolling, Text, Fundamentals, and Design
  categories, plus Accessibility;
- BreadcrumbBar, NavigationView, Pivot, SelectorBar, and TabView navigation
  samples with native collection ownership and interaction;
- AnnotatedScrollBar, PipsPager, ScrollView, ScrollViewer, and SemanticZoom
  samples with native scrolling and view-change interaction;
- AutoSuggestBox, NumberBox, PasswordBox, RichEditBox, RichTextBlock,
  TextBlock, and TextBox samples;
- WinUI Gallery-faithful Resources, Style, Binding, Templates, Custom & User
  Controls, XAML Conditions, and XamlReader-backed Scratch Pad fundamentals,
  adapted to typed TSX rather than copied XAML authoring;
- WinUI Gallery-faithful Color resource sections, Geometry and Spacing
  guidance, the complete searchable icon catalog, and the Windows Typography
  type ramp;
- WinUI Gallery-faithful Color Contrast checker, keyboard tab/arrow/shortcut
  guidance, and Screen Reader accessible-name, relationship, UIA-tree,
  heading, and live-region examples;
- AcrylicBrush, AnimatedIcon, Compact Sizing, IconElement, Line, Shape,
  RadialGradientBrush, System Backdrops, SystemBackdropElement, and
  ThemeShadow style samples with the original multi-example option sets and
  material guidance;
- the complete Motion category: Animation interop, Connected Animation,
  Easing Functions, Implicit Transitions, Page Transitions, Theme Transitions,
  and ParallaxView, with Windows reduced-motion handling;
- the complete Windowing category: AppWindow, AppWindowTitleBar, Multiple
  windows, and TitleBar, with native presenter APIs, owned same-STA secondary
  windows, capability reporting, custom drag regions, and teardown cleanup;
- the complete System category: real Windows Clipboard text, history, roaming,
  format, clear, and change-notification operations; an owned ContentIsland and
  ChildSiteLink composition host with truthful capability reporting; and
  FileOpenPicker, FileSavePicker, and FolderPicker initialized from the main
  window ID with explicit cancellation and failure states;
- integrated expandable source sections with native clipboard copy actions;
- owned Flyout and MenuFlyout content attached to button controls;
- ListView selection plus native ItemsRepeater and ItemsView virtualization;
- TextBox, PasswordBox, AutoSuggestBox, and NumberBox;
- ProgressBar, ProgressRing, and InfoBar;
- typed Grid layout;
- ContentDialog and Flyout lifetimes;
- theme resources, tokens, style recipes, icons, settings, and diagnostics.
- reusable ScrollViewer boundary controllers.

Each sample includes a live native preview and selectable TypeScript JSX source.
The Home header and Design guidance pages reuse MIT-licensed WinUI Gallery
artwork and icon data; its license is included at
`Assets/WinUI-Gallery-LICENSE.txt`.

```powershell
npm install
npm run setup
npm start
```

Use hot reload after setup:

```powershell
npm run dev
```

Run the real WinUI navigation smoke test:

```powershell
npm run smoke:ui
```

Search matches every whitespace-separated token against page titles,
descriptions, categories, and tags. Theme, interaction, recent-page, and
favorite-page state persist under
`%LOCALAPPDATA%\dynwinrt-jsx\gallery\state.json`.

The Gallery enables the optional UI-thread heartbeat by default. Diagnostics
shows heartbeat acknowledgement, inspector ownership counts, subscriptions,
and recent operations. Timeout evidence is saved beside `state.json` as
`heartbeat-timeout.json`; the Export button writes
`inspector-snapshot.json`. Timeout evidence starts with the suspected page,
last renderer operation, and grouped hot operations before the complete
snapshot.

Set `DYNWINRT_JSX_HEARTBEAT=0` to disable heartbeat monitoring, or override
`DYNWINRT_JSX_HEARTBEAT_TIMEOUT_MS`, `DYNWINRT_JSX_HEARTBEAT_PATH`, and
`DYNWINRT_JSX_INSPECTOR_EXPORT_PATH`.
