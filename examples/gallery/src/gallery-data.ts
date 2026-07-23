export interface GalleryPageInfo {
  readonly id: string
  readonly category: string
  readonly title: string
  readonly subtitle: string
  readonly description: string
  readonly tags: readonly string[]
  readonly image: string
}

export const galleryPages = [
  {
    id: 'signals',
    category: 'Framework',
    title: 'Signals and control flow',
    subtitle: 'Fine-grained native updates without component rerenders.',
    description:
      'Use signals, computed values, Show, and keyed For to update only the affected native properties and ranges.',
    tags: ['signal', 'computed', 'show', 'for', 'reactivity'],
    image: 'ControlImages/CodeTagIcon.png',
  },
  {
    id: 'buttons',
    category: 'Controls',
    title: 'Buttons and toggles',
    subtitle: 'Native command and boolean input controls.',
    description:
      'Compose Button, CheckBox, and ToggleSwitch with signal-backed properties and events.',
    tags: ['button', 'checkbox', 'toggle', 'input', 'event'],
    image: 'ControlImages/Button.png',
  },
  {
    id: 'selection',
    category: 'Controls',
    title: 'Selection controls',
    subtitle: 'Controlled ComboBox and ListView selection.',
    description:
      'Use specialized adapters for owned items, headers, selection echo suppression, and model-authoritative updates.',
    tags: ['combobox', 'listview', 'selection', 'controlled', 'adapter'],
    image: 'ControlImages/ComboBox.png',
  },
  {
    id: 'text-input',
    category: 'Controls',
    title: 'Text and numeric input',
    subtitle: 'TextBox, PasswordBox, AutoSuggestBox, and NumberBox.',
    description:
      'Capture text, secret, search, and numeric input through generated native properties and events.',
    tags: ['textbox', 'passwordbox', 'autosuggestbox', 'numberbox', 'input'],
    image: 'ControlImages/TextBox.png',
  },
  {
    id: 'range-progress',
    category: 'Controls',
    title: 'Range and progress',
    subtitle: 'Slider, ProgressBar, and ProgressRing state.',
    description:
      'Share one signal across interactive range input and determinate or indeterminate progress indicators.',
    tags: ['slider', 'progressbar', 'progressring', 'range', 'progress'],
    image: 'ControlImages/Slider.png',
  },
  {
    id: 'choices-status',
    category: 'Controls',
    title: 'Choices and status',
    subtitle: 'RadioButton, ToggleButton, and InfoBar.',
    description:
      'Model mutually exclusive choices, persistent toggle state, and severity-aware notifications.',
    tags: ['radiobutton', 'togglebutton', 'infobar', 'choice', 'status'],
    image: 'ControlImages/InfoBar.png',
  },
  {
    id: 'collections',
    category: 'Collections',
    title: 'Collections and virtualization',
    subtitle: 'Keyed lists and native ItemsRepeater virtualization.',
    description:
      'Keep stable item identity while WinUI realizes and recycles only the dynamic-height rows near the viewport.',
    tags: ['itemsrepeater', 'virtualization', 'list', 'collection', 'key'],
    image: 'ControlImages/ItemsRepeater.png',
  },
  {
    id: 'layout',
    category: 'Layout',
    title: 'Grid and layout',
    subtitle: 'Typed Grid tracks and attached positioning.',
    description:
      'Declare rows, columns, spacing, and attached Grid properties with native WinUI layout semantics.',
    tags: ['grid', 'layout', 'row', 'column', 'spacing'],
    image: 'ControlImages/Grid.png',
  },
  {
    id: 'overlays',
    category: 'Controls',
    title: 'Dialogs and flyouts',
    subtitle: 'Scoped overlay content and deterministic cleanup.',
    description:
      'Render ContentDialog and Flyout content in owned scopes that are released when the native overlay closes.',
    tags: ['dialog', 'flyout', 'overlay', 'portal', 'lifecycle'],
    image: 'ControlImages/ContentDialog.png',
  },
  {
    id: 'resources',
    category: 'Design',
    title: 'Resources and styling',
    subtitle: 'Theme resources, tokens, and typed style recipes.',
    description:
      'Reuse native resources and signal-backed style recipes without CSS or DOM styling concepts.',
    tags: ['theme', 'resource', 'style', 'token', 'design'],
    image: 'ControlImages/ColorPaletteResources.png',
  },
  {
    id: 'icons',
    category: 'Design',
    title: 'Icons and glyphs',
    subtitle: 'SymbolIcon and FontIcon with native sizing.',
    description:
      'Use enum-backed symbols or explicit Segoe Fluent glyph strings without image assets.',
    tags: ['symbolicon', 'fonticon', 'glyph', 'icon', 'design'],
    image: 'ControlImages/IconElement.png',
  },
] as const satisfies readonly GalleryPageInfo[]

export type GalleryPageId =
  (typeof galleryPages)[number]['id']

export type GalleryRoute =
  | 'home'
  | 'search'
  | 'diagnostics'
  | 'settings'
  | GalleryPageId

export const galleryCategories = [
  ...new Set(galleryPages.map((page) => page.category)),
]

export function findGalleryPage(
  id: string,
): GalleryPageInfo | undefined {
  return galleryPages.find((page) => page.id === id)
}

export function searchGalleryPages(
  query: string,
): readonly GalleryPageInfo[] {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (tokens.length === 0) {
    return galleryPages
  }

  return galleryPages.filter((page) => {
    const searchable = [
      page.title,
      page.subtitle,
      page.description,
      page.category,
      ...page.tags,
    ].join(' ').toLowerCase()
    return tokens.every((token) =>
      searchable.includes(token),
    )
  })
}
