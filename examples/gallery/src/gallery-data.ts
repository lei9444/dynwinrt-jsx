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
    category: 'Framework',
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
    id: 'info-badge',
    category: 'Status & info',
    title: 'InfoBadge',
    subtitle: 'Displays a count, dot, or icon for attention and status.',
    description:
      'Embed badges in navigation, switch semantic styles, overlay an icon, and update or hide numeric values.',
    tags: ['infobadge', 'badge', 'notification', 'count', 'status'],
    image: 'ControlImages/InfoBadge.png',
  },
  {
    id: 'info-bar',
    category: 'Status & info',
    title: 'InfoBar',
    subtitle: 'Shows an inline app-wide message with optional actions.',
    description:
      'Configure severity, message length, action buttons, icons, open state, and close behavior.',
    tags: ['infobar', 'message', 'severity', 'notification', 'status'],
    image: 'ControlImages/InfoBar.png',
  },
  {
    id: 'progress-bar',
    category: 'Status & info',
    title: 'ProgressBar',
    subtitle: 'Shows determinate or indeterminate linear progress.',
    description:
      'Display running, paused, error, and numeric progress states in a horizontal indicator.',
    tags: ['progressbar', 'progress', 'loading', 'paused', 'error'],
    image: 'ControlImages/ProgressBar.png',
  },
  {
    id: 'progress-ring',
    category: 'Status & info',
    title: 'ProgressRing',
    subtitle: 'Shows circular activity or determinate progress.',
    description:
      'Toggle active work, choose a background, and set a numeric circular progress value.',
    tags: ['progressring', 'progress', 'loading', 'activity', 'ring'],
    image: 'ControlImages/ProgressRing.png',
  },
  {
    id: 'tool-tip',
    category: 'Status & info',
    title: 'ToolTip',
    subtitle: 'Displays contextual information when an element is hovered or focused.',
    description:
      'Attach simple or custom tooltips with offsets, placement rectangles, and non-occluding placement.',
    tags: ['tooltip', 'help', 'hover', 'focus', 'placement'],
    image: 'ControlImages/ToolTip.png',
  },
  {
    id: 'flip-view',
    category: 'Collections',
    title: 'FlipView',
    subtitle: 'Presents a collection one item at a time.',
    description:
      'Flip through images, galleries, or other sequential content with native paging controls.',
    tags: ['flipview', 'carousel', 'slideshow', 'gallery'],
    image: 'ControlImages/FlipView.png',
  },
  {
    id: 'grid-view',
    category: 'Collections',
    title: 'GridView',
    subtitle: 'Presents a collection in rows and columns.',
    description:
      'Arrange selectable, invokable items in a wrapping native grid with configurable item sizing.',
    tags: ['gridview', 'tiles', 'collection grid', 'selection'],
    image: 'ControlImages/GridView.png',
  },
  {
    id: 'items-repeater',
    category: 'Collections',
    title: 'ItemsRepeater',
    subtitle: 'A flexible primitive for data-driven layouts.',
    description:
      'Keep stable keyed item identity while WinUI realizes and recycles only the rows near the viewport.',
    tags: ['itemsrepeater', 'virtualization', 'list', 'collection', 'key'],
    image: 'ControlImages/ItemsRepeater.png',
  },
  {
    id: 'items-view',
    category: 'Collections',
    title: 'ItemsView',
    subtitle: 'Presents a collection using swappable layouts.',
    description:
      'Combine native virtualization, invocation, selection, and Stack, UniformGrid, or LinedFlow layouts.',
    tags: ['itemsview', 'collection', 'items source', 'layout', 'selection'],
    image: 'ControlImages/ItemsView.png',
  },
  {
    id: 'list-view',
    category: 'Collections',
    title: 'ListView',
    subtitle: 'Presents a collection in a vertical list.',
    description:
      'Display, filter, select, reorder, and update native list items with controlled application state.',
    tags: ['listview', 'list', 'selection', 'collection list', 'filter'],
    image: 'ControlImages/ListView.png',
  },
  {
    id: 'pull-to-refresh',
    category: 'Collections',
    title: 'PullToRefresh',
    subtitle: 'Refreshes collection content with a pull gesture.',
    description:
      'Use RefreshContainer and RefreshVisualizer to request and complete collection refresh work.',
    tags: ['pull to refresh', 'refreshcontainer', 'refreshvisualizer', 'list'],
    image: 'ControlImages/PullToRefresh.png',
  },
  {
    id: 'tree-view',
    category: 'Collections',
    title: 'TreeView',
    subtitle: 'Displays expandable hierarchical collections.',
    description:
      'Build nested TreeViewNode collections with expansion, invocation, drag, and multiple selection.',
    tags: ['treeview', 'tree', 'hierarchy', 'nodes', 'expandable list'],
    image: 'ControlImages/TreeView.png',
  },
  {
    id: 'calendar-date-picker',
    category: 'Date & time',
    title: 'CalendarDatePicker',
    subtitle: 'Lets users pick a date from a compact calendar flyout.',
    description:
      'Add a header and placeholder while receiving nullable date changes from the native calendar flyout.',
    tags: ['calendardatepicker', 'calendar', 'date', 'picker'],
    image: 'ControlImages/CalendarDatePicker.png',
  },
  {
    id: 'calendar-view',
    category: 'Date & time',
    title: 'CalendarView',
    subtitle: 'Shows a large calendar for selecting one or more dates.',
    description:
      'Configure selection, calendar systems, language, group labels, and out-of-scope dates.',
    tags: ['calendarview', 'calendar', 'date', 'selection', 'language'],
    image: 'ControlImages/CalendarView.png',
  },
  {
    id: 'date-picker',
    category: 'Date & time',
    title: 'DatePicker',
    subtitle: 'Lets users select a month, day, and year.',
    description:
      'Present a compact date selector with headers, date ranges, custom formats, and hidden fields.',
    tags: ['datepicker', 'date', 'month', 'day', 'year'],
    image: 'ControlImages/DatePicker.png',
  },
  {
    id: 'time-picker',
    category: 'Date & time',
    title: 'TimePicker',
    subtitle: 'Lets users select hours and minutes.',
    description:
      'Configure headers, minute increments, nullable selected times, and 12- or 24-hour clocks.',
    tags: ['timepicker', 'time', 'clock', 'hours', 'minutes'],
    image: 'ControlImages/TimePicker.png',
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
    id: 'content-dialog',
    category: 'Dialogs & flyouts',
    title: 'ContentDialog',
    subtitle: 'Shows modal information or choices over the current window.',
    description:
      'Display owned XAML content with primary, secondary, close, and default button behavior.',
    tags: ['contentdialog', 'dialog', 'modal', 'buttons', 'overlay'],
    image: 'ControlImages/ContentDialog.png',
  },
  {
    id: 'flyout',
    category: 'Dialogs & flyouts',
    title: 'Flyout',
    subtitle: 'Displays lightweight contextual UI next to a target.',
    description:
      'Collect input, show details, or confirm an action in a light-dismiss overlay.',
    tags: ['flyout', 'overlay', 'light dismiss', 'popup', 'confirmation'],
    image: 'ControlImages/Flyout.png',
  },
  {
    id: 'popup',
    category: 'Dialogs & flyouts',
    title: 'Popup',
    subtitle: 'Displays temporary content above the application UI.',
    description:
      'Position a custom floating panel with offsets and optional light-dismiss behavior.',
    tags: ['popup', 'overlay', 'offset', 'light dismiss', 'floating panel'],
    image: 'ControlImages/Popup.png',
  },
  {
    id: 'teaching-tip',
    category: 'Dialogs & flyouts',
    title: 'TeachingTip',
    subtitle: 'Guides users with contextual, content-rich notifications.',
    description:
      'Show targeted, non-targeted, actionable, and hero-content guidance with owned lifetimes.',
    tags: ['teachingtip', 'guidance', 'tip', 'hero', 'overlay'],
    image: 'ControlImages/TeachingTip.png',
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
  | 'category-collections'
  | 'category-date-time'
  | 'category-dialogs-flyouts'
  | 'category-status-info'
  | 'diagnostics'
  | 'settings'
  | GalleryPageId

export const basicInputPages = galleryPages.filter(
  (page) => page.category === 'Basic input',
)

export const collectionPages = galleryPages.filter(
  (page) => page.category === 'Collections',
)

export const dateTimePages = galleryPages.filter(
  (page) => page.category === 'Date & time',
)

export const dialogsFlyoutsPages = galleryPages.filter(
  (page) => page.category === 'Dialogs & flyouts',
)

export const statusInfoPages = galleryPages.filter(
  (page) => page.category === 'Status & info',
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
