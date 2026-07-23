# dynwinrt-jsx Gallery

The Gallery is an interactive native WinUI 3 reference application for
`dynwinrt-jsx`. It follows the metadata, navigation, search, and live-sample
structure of WinUI Gallery while using TypeScript JSX instead of compiled XAML,
reflection, or source-generated page mappings.

The initial pages cover:

- signals, computed values, `Show`, and keyed `For`;
- Button, CheckBox, ToggleSwitch, ComboBox, and ListView;
- TextBox, PasswordBox, AutoSuggestBox, and NumberBox;
- Slider, ProgressBar, ProgressRing, RadioButton, ToggleButton, and InfoBar;
- native ItemsRepeater virtualization;
- typed Grid layout;
- ContentDialog and Flyout lifetimes;
- theme resources, tokens, style recipes, icons, settings, and diagnostics.

Each sample includes a live native preview and selectable TypeScript JSX source.
The Home header reuses MIT-licensed WinUI Gallery tile artwork; its license is
included at `Assets/WinUI-Gallery-LICENSE.txt`.

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
