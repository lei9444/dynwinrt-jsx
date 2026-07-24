# Changelog

## Unreleased

- Grouped implementation modules under core, renderer, winui, and runtime directories while preserving package entry points.
- Added a reactive ScrollViewer controller and an owned, controlled SelectorBar adapter.
- Added optional DispatcherQueue renderer heartbeats, Host timeout/recovery monitoring, shared acknowledgements, and Gallery inspector export.
- Added privacy-safe renderer inspection snapshots and bounded lifecycle, property, event, child, resource, list, and error operation records.
- Added lifecycle-aware native property phases and full-namespace WinUI renderer presets with capability diagnostics.
- Added typed, signal-backed declarative Grid row and column definitions.
- Added transactional native definition collection replacement with rollback.
- Added NavigationView menu/footer collection adapters and navigation item/icon helpers.
- Added scoped ContentDialog rendering, focus targets, and renderer diagnostic helpers.
- Added versioned Worker-side TSX hot reload with state preservation and error recovery.
- Updated the dashboard and generated application template with a pilot-ready app shell.
- Added Automation relationship metadata, deterministic dialog focus restoration, and accessibility UIA assertions.
- Added structured diagnostic records, multi-cycle hot reload/lifecycle soak tests, resource trend reporting, and Windows source/package CI.
- Added validated atomic JSON persistence with corrupt-file recovery for dashboard and generated app state.
- Limited nullable `isChecked` boxing to ToggleButton-family controls so non-nullable controls such as ToggleSplitButton receive native Booleans and reject `null`.
- Added primitive `onContent` and `offContent` conversion for ToggleSwitch.
- Generalized keyed native virtualization for ItemsView-style controls with
  persistent outer item containers and control-specific ItemsSource cleanup.
- Added the complete WinUI Gallery Collections category with FlipView,
  GridView, ItemsRepeater, ItemsView, ListView, PullToRefresh, and TreeView.
- Added compact page and hot-operation summaries to heartbeat timeout evidence.
- Prevented the Gallery GridView tile-width NumberBox from feeding native
  ValueChanged echoes back into its own value property.
- Added nullable DateTime and TimeSpan reference conversion for
  CalendarDatePicker, DatePicker, and TimePicker properties.
- Added the complete WinUI Gallery Date & time category with
  CalendarDatePicker, CalendarView, DatePicker, and TimePicker.
- Added scoped Popup rendering with close-time content disposal.
- Added the complete WinUI Gallery Dialogs & flyouts category with
  ContentDialog, Flyout, Popup, and TeachingTip.
- Added typed ToolTipService attached properties with primitive tooltip content
  conversion.
- Added the complete WinUI Gallery Status & info category with InfoBadge,
  InfoBar, ProgressBar, ProgressRing, and ToolTip.
- Added typed Canvas ZIndex, RelativePanel relationship, and
  VariableSizedWrapGrid span attached properties.
- Added the complete WinUI Gallery Layout category with Border, Canvas,
  Expander, Grid, RelativePanel, SplitView, StackPanel,
  VariableSizedWrapGrid, and Viewbox.
- Added collection-slot getters and self-collection child adapters for
  observable command collections and collection-valued WinRT objects.
- Added the complete WinUI Gallery Menus & toolbars category with app bar,
  command bar, menu, swipe, and reusable command samples.
- Re-resolved collection-slot getters during synchronization so controls can
  replace projected mutable collection views after loading.
- Added the complete WinUI Gallery Navigation category with BreadcrumbBar,
  NavigationView, Pivot, SelectorBar, and TabView.
- Added the complete WinUI Gallery Scrolling category with AnnotatedScrollBar,
  PipsPager, ScrollView, ScrollViewer, and SemanticZoom.
- Added the complete WinUI Gallery Text category with AutoSuggestBox,
  NumberBox, PasswordBox, RichEditBox, RichTextBlock, TextBlock, and TextBox.
- Added the complete WinUI Gallery Fundamentals category with Resources,
  Style, Binding, Templates, Custom & User Controls, XAML Conditions, and
  Scratch Pad.

## 1.0.0

- Added depth-ordered deterministic scheduling, explicit roots, mount lifecycle, and scoped Context.
- Preserved native identity during keyed list moves and added reactive indexes.
- Added ErrorBoundary, Portal, and fixed-height VirtualFor.
- Added native ItemsRepeater virtualization with dynamic row measurement,
  bounded host recycling, stable keyed item scopes, and observable-vector
  incremental updates.
- Added ComboBox item/header adapters and controlled selected-index semantics.
- Added signal-backed events, feedback-safe binding props, tracked resources, WinUI property conversion, and value helpers.
- Added root updates, hot refresh, renderer diagnostics, and a Worker state bridge.
- Added a dependency-free `dynwinrt-jsx create` command with exact-version and local-repository modes.
- Promoted the native WinUI dashboard to the 1.0 APIs.
- Kept repeated runtime theme transitions consistent by batching WinUI theme selection with tracked-resource refresh.

## 0.1.0

- Initial JSX runtime, signals, native renderer, Show, keyed For, resources, and WinUI dashboard.
