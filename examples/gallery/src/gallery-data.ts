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
    id: 'button',
    category: 'Basic input',
    title: 'Button',
    subtitle: 'A control that responds to user input and raises a Click event.',
    description:
      'Place text, images, or custom content in a native button and respond to its Click event.',
    tags: ['button', 'click', 'command', 'input'],
    image: 'ControlImages/Button.png',
  },
  {
    id: 'drop-down-button',
    category: 'Basic input',
    title: 'DropDownButton',
    subtitle: 'A button that displays a flyout of choices when clicked.',
    description:
      'Attach an owned MenuFlyout or Flyout to a button and select from its commands.',
    tags: ['dropdownbutton', 'flyout', 'menu', 'button'],
    image: 'ControlImages/DropDownButton.png',
  },
  {
    id: 'hyperlink-button',
    category: 'Basic input',
    title: 'HyperlinkButton',
    subtitle: 'A hyperlink that navigates to a URI or handles Click.',
    description:
      'Navigate to an external URI or use the Click event for application navigation.',
    tags: ['hyperlinkbutton', 'uri', 'link', 'navigate'],
    image: 'ControlImages/HyperlinkButton.png',
  },
  {
    id: 'repeat-button',
    category: 'Basic input',
    title: 'RepeatButton',
    subtitle: 'Raises Click repeatedly while it is pressed.',
    description:
      'Configure the initial delay and repeat interval for press-and-hold commands.',
    tags: ['repeatbutton', 'hold', 'click', 'command'],
    image: 'ControlImages/RepeatButton.png',
  },
  {
    id: 'toggle-button',
    category: 'Basic input',
    title: 'ToggleButton',
    subtitle: 'A button that switches between checked and unchecked states.',
    description:
      'Use native checked state and events for persistent two-state actions.',
    tags: ['togglebutton', 'checked', 'toggle', 'state'],
    image: 'ControlImages/ToggleButton.png',
  },
  {
    id: 'split-button',
    category: 'Basic input',
    title: 'SplitButton',
    subtitle: 'A primary action paired with a secondary flyout.',
    description:
      'Invoke the current action directly or choose a different action from an owned flyout.',
    tags: ['splitbutton', 'flyout', 'dropdown', 'command'],
    image: 'ControlImages/SplitButton.png',
  },
  {
    id: 'toggle-split-button',
    category: 'Basic input',
    title: 'ToggleSplitButton',
    subtitle: 'A SplitButton whose primary action toggles on and off.',
    description:
      'Combine checked state with a secondary flyout of related toggle modes.',
    tags: ['togglesplitbutton', 'toggle', 'flyout', 'command'],
    image: 'ControlImages/ToggleSplitButton.png',
  },
  {
    id: 'check-box',
    category: 'Basic input',
    title: 'CheckBox',
    subtitle: 'A control that a user can select or clear.',
    description:
      'Model two-state, three-state, and select-all checkbox interactions.',
    tags: ['checkbox', 'checkmark', 'three state', 'selection'],
    image: 'ControlImages/Checkbox.png',
  },
  {
    id: 'color-picker',
    category: 'Basic input',
    title: 'ColorPicker',
    subtitle: 'A control that displays a selectable color spectrum.',
    description:
      'Choose colors through a spectrum, sliders, channels, alpha, and hexadecimal input.',
    tags: ['colorpicker', 'spectrum', 'rgb', 'hex', 'alpha'],
    image: 'ControlImages/ColorPicker.png',
  },
  {
    id: 'combo-box',
    category: 'Basic input',
    title: 'ComboBox',
    subtitle: 'A drop-down list of items a user can select from.',
    description:
      'Own native items and keep selectedIndex synchronized with application state.',
    tags: ['combobox', 'dropdown', 'selection', 'picker'],
    image: 'ControlImages/ComboBox.png',
  },
  {
    id: 'radio-button',
    category: 'Basic input',
    title: 'RadioButton',
    subtitle: 'Select a single option from a group of related choices.',
    description:
      'Use grouped RadioButton controls or a RadioButtons collection for exclusive selection.',
    tags: ['radiobutton', 'radiobuttons', 'choice', 'selection'],
    image: 'ControlImages/RadioButton.png',
  },
  {
    id: 'rating-control',
    category: 'Basic input',
    title: 'RatingControl',
    subtitle: 'Rate something from one to five stars.',
    description:
      'Capture a star rating, placeholder value, caption, and read-only or clear behavior.',
    tags: ['ratingcontrol', 'rating', 'stars', 'review'],
    image: 'ControlImages/RatingControl.png',
  },
  {
    id: 'slider',
    category: 'Basic input',
    title: 'Slider',
    subtitle: 'Select a value by moving a thumb along a track.',
    description:
      'Configure ranges, steps, tick marks, snapping, and horizontal or vertical orientation.',
    tags: ['slider', 'range', 'track', 'thumb', 'ticks'],
    image: 'ControlImages/Slider.png',
  },
  {
    id: 'toggle-switch',
    category: 'Basic input',
    title: 'ToggleSwitch',
    subtitle: 'A switch that toggles between two immediate states.',
    description:
      'Use native on/off state with labels, custom content, and dependent controls.',
    tags: ['toggleswitch', 'toggle', 'on off', 'switch'],
    image: 'ControlImages/ToggleSwitch.png',
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
  | 'category-basic-input'
  | 'diagnostics'
  | 'settings'
  | GalleryPageId

export const basicInputPages = galleryPages.filter(
  (page) => page.category === 'Basic input',
)

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
