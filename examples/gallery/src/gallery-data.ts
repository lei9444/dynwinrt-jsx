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
    id: 'border',
    category: 'Layout',
    title: 'Border',
    subtitle: 'Draws a background and border around one child.',
    description:
      'Configure border thickness, border brush, background, and owned child content.',
    tags: ['border', 'background', 'brush', 'thickness', 'layout'],
    image: 'ControlImages/Border.png',
  },
  {
    id: 'canvas',
    category: 'Layout',
    title: 'Canvas',
    subtitle: 'Positions children with absolute coordinates and z-order.',
    description:
      'Use Canvas.Left, Canvas.Top, and Canvas.ZIndex attached properties for explicit placement.',
    tags: ['canvas', 'absolute', 'position', 'zindex', 'layout'],
    image: 'ControlImages/Canvas.png',
  },
  {
    id: 'expander',
    category: 'Layout',
    title: 'Expander',
    subtitle: 'Shows or hides content beneath a header.',
    description:
      'Configure headers, content alignment, expanded state, and upward or downward expansion.',
    tags: ['expander', 'expand', 'collapse', 'header', 'layout'],
    image: 'ControlImages/Expander.png',
  },
  {
    id: 'grid',
    category: 'Layout',
    title: 'Grid',
    subtitle: 'Arranges children in typed rows and columns.',
    description:
      'Control track sizes, row and column spacing, and attached child positions.',
    tags: ['grid', 'row', 'column', 'spacing', 'layout'],
    image: 'ControlImages/Grid.png',
  },
  {
    id: 'relative-panel',
    category: 'Layout',
    title: 'RelativePanel',
    subtitle: 'Positions children relative to siblings and panel edges.',
    description:
      'Express right-of, below, sibling alignment, and panel alignment constraints.',
    tags: ['relativepanel', 'relative', 'align', 'position', 'layout'],
    image: 'ControlImages/RelativePanel.png',
  },
  {
    id: 'split-view',
    category: 'Layout',
    title: 'SplitView',
    subtitle: 'Displays a pane beside or over application content.',
    description:
      'Own separate pane and content slots with configurable display mode, placement, and lengths.',
    tags: ['splitview', 'pane', 'navigation', 'overlay', 'layout'],
    image: 'ControlImages/SplitView.png',
  },
  {
    id: 'stack-panel',
    category: 'Layout',
    title: 'StackPanel',
    subtitle: 'Stacks children vertically or horizontally.',
    description:
      'Switch orientation and spacing while preserving native child order.',
    tags: ['stackpanel', 'stack', 'orientation', 'spacing', 'layout'],
    image: 'ControlImages/StackPanel.png',
  },
  {
    id: 'variable-sized-wrap-grid',
    category: 'Layout',
    title: 'VariableSizedWrapGrid',
    subtitle: 'Wraps fixed cells whose children can span rows or columns.',
    description:
      'Configure item size, orientation, row span, column span, and maximum rows or columns.',
    tags: ['variablesizedwrapgrid', 'wrap', 'rowspan', 'columnspan', 'layout'],
    image: 'ControlImages/VariableSizedWrapGrid.png',
  },
  {
    id: 'viewbox',
    category: 'Layout',
    title: 'Viewbox',
    subtitle: 'Scales one child to fit the available space.',
    description:
      'Adjust size, stretch mode, and stretch direction for complex child content.',
    tags: ['viewbox', 'scale', 'stretch', 'resize', 'layout'],
    image: 'ControlImages/Viewbox.png',
  },
  {
    id: 'animated-visual-player',
    category: 'Media',
    title: 'AnimatedVisualPlayer',
    subtitle:
      'An element to render and control playback of motion graphics.',
    description:
      'Play, pause, stop, resume, and reverse a generated composition animation source.',
    tags: ['lottie', 'animation', 'motion graphics', 'composition'],
    image: 'ControlImages/AnimatedVisualPlayer.png',
  },
  {
    id: 'capture-element-preview',
    category: 'Media',
    title: 'Capture Element / Camera Preview',
    subtitle: 'A sample for doing a camera preview.',
    description:
      'Use MediaCapture and a MediaPlayerElement to preview a camera, mirror the preview, and capture photos.',
    tags: ['camera', 'webcam', 'mediacapture', 'preview'],
    image: 'ControlImages/CaptureElement.png',
  },
  {
    id: 'image',
    category: 'Media',
    title: 'Image',
    subtitle: 'A control to display image content.',
    description:
      'Show local images, decoded sizes, stretch modes, nine-grid images, SVG content, and animated GIF playback.',
    tags: ['image', 'picture', 'bitmapimage', 'photo', 'svg', 'gif'],
    image: 'ControlImages/Image.png',
  },
  {
    id: 'map-control',
    category: 'Media',
    title: 'MapControl',
    subtitle: 'Displays a symbolic map of the Earth.',
    description:
      'Display an Azure map with a service token and a geographic pin when package identity and network services are available.',
    tags: ['mapcontrol', 'maps', 'geography', 'location', 'azure maps'],
    image: 'ControlImages/MapControl.png',
  },
  {
    id: 'media-player-element',
    category: 'Media',
    title: 'MediaPlayerElement',
    subtitle: 'A control to display video and image content.',
    description:
      'Play bundled video with transport controls or autoplay, and replace the source through the native file picker.',
    tags: ['video', 'media player', 'audio', 'playback'],
    image: 'ControlImages/MediaPlayerElement.png',
  },
  {
    id: 'person-picture',
    category: 'Media',
    title: 'PersonPicture',
    subtitle: 'Displays the picture of a person/contact.',
    description:
      'Switch a PersonPicture between a profile image, generated display-name initials, and explicit initials.',
    tags: ['personpicture', 'avatar', 'contact photo', 'initials'],
    image: 'ControlImages/PersonPicture.png',
  },
  {
    id: 'sound',
    category: 'Media',
    title: 'Sound',
    subtitle:
      'A code-behind API that enables 2D and 3D UI sounds on XAML controls.',
    description:
      'Toggle global UI sound and spatial audio, then play each built-in ElementSoundKind.',
    tags: ['sound', 'audio', 'ui sound', 'elementsoundplayer'],
    image: 'ControlImages/Sound.png',
  },
  {
    id: 'app-bar-button',
    category: 'Menus & toolbars',
    title: 'AppBarButton',
    subtitle: 'A labeled command button for command surfaces.',
    description:
      'Combine labels, icons, tooltips, and attached native flyouts.',
    tags: ['appbarbutton', 'command', 'button', 'toolbar', 'flyout'],
    image: 'ControlImages/AppBarButton.png',
  },
  {
    id: 'app-bar-separator',
    category: 'Menus & toolbars',
    title: 'AppBarSeparator',
    subtitle: 'Visually separates groups of app bar commands.',
    description:
      'Divide primary or secondary CommandBar commands without adding an interactive action.',
    tags: ['appbarseparator', 'separator', 'commandbar', 'toolbar'],
    image: 'ControlImages/AppBarSeparator.png',
  },
  {
    id: 'app-bar-toggle-button',
    category: 'Menus & toolbars',
    title: 'AppBarToggleButton',
    subtitle: 'A command button with persistent checked state.',
    description:
      'Use icon, label, tooltip, compact display, and checked state in command surfaces.',
    tags: ['appbartogglebutton', 'toggle', 'command', 'toolbar'],
    image: 'ControlImages/AppBarToggleButton.png',
  },
  {
    id: 'command-bar',
    category: 'Menus & toolbars',
    title: 'CommandBar',
    subtitle: 'Presents primary commands and an overflow menu.',
    description:
      'Own primary and secondary command collections with label, open, and sticky behavior.',
    tags: ['commandbar', 'commands', 'overflow', 'toolbar', 'appbar'],
    image: 'ControlImages/CommandBar.png',
  },
  {
    id: 'command-bar-flyout',
    category: 'Menus & toolbars',
    title: 'CommandBarFlyout',
    subtitle: 'Shows command collections in a contextual flyout.',
    description:
      'Attach primary and secondary app bar commands to a target through a native flyout.',
    tags: ['commandbarflyout', 'flyout', 'commands', 'context menu'],
    image: 'ControlImages/CommandBarFlyout.png',
  },
  {
    id: 'menu-bar',
    category: 'Menus & toolbars',
    title: 'MenuBar',
    subtitle: 'Displays top-level menus with nested commands.',
    description:
      'Build File, Edit, and View menus with separators, submenus, toggles, and radio items.',
    tags: ['menubar', 'menu', 'submenu', 'commands', 'toolbar'],
    image: 'ControlImages/MenuBar.png',
  },
  {
    id: 'menu-flyout',
    category: 'Menus & toolbars',
    title: 'MenuFlyout',
    subtitle: 'Displays a light-dismiss menu of commands.',
    description:
      'Use standard, toggle, radio, separator, icon, and cascading menu items.',
    tags: ['menuflyout', 'menu', 'context menu', 'submenu', 'radio'],
    image: 'ControlImages/MenuFlyout.png',
  },
  {
    id: 'swipe-control',
    category: 'Menus & toolbars',
    title: 'SwipeControl',
    subtitle: 'Reveals or executes contextual actions through swipe gestures.',
    description:
      'Configure left and right SwipeItems collections in reveal or execute mode.',
    tags: ['swipecontrol', 'swipe', 'actions', 'reveal', 'execute'],
    image: 'ControlImages/SwipeControl.png',
  },
  {
    id: 'standard-ui-command',
    category: 'Menus & toolbars',
    title: 'StandardUICommand',
    subtitle: 'Provides platform-defined command labels, icons, and behavior.',
    description:
      'Share one standard command across app bar, menu, and swipe command surfaces.',
    tags: ['standarduicommand', 'command', 'delete', 'shared', 'toolbar'],
    image: 'ControlImages/StandardUICommand.png',
  },
  {
    id: 'xaml-ui-command',
    category: 'Menus & toolbars',
    title: 'XamlUICommand',
    subtitle: 'Defines a reusable custom command with shared presentation.',
    description:
      'Share a label, description, icon source, and ExecuteRequested handler across controls.',
    tags: ['xamluicommand', 'command', 'execute', 'reusable', 'toolbar'],
    image: 'ControlImages/XamlUICommand.png',
  },
  {
    id: 'breadcrumb-bar',
    category: 'Navigation',
    title: 'BreadcrumbBar',
    subtitle: 'Shows the trail of navigation taken to the current location.',
    description:
      'Display a mutable path whose later nodes are removed when the user selects an earlier location.',
    tags: ['breadcrumbbar', 'breadcrumb', 'navigation trail', 'path'],
    image: 'ControlImages/BreadcrumbBar.png',
  },
  {
    id: 'navigation-view',
    category: 'Navigation',
    title: 'NavigationView',
    subtitle: 'Provides a collapsible pane for top-level app areas.',
    description:
      'Switch between left, compact, automatic, and top navigation layouts while preserving selected content.',
    tags: ['navigationview', 'hamburger menu', 'side nav', 'pane'],
    image: 'ControlImages/NavigationView.png',
  },
  {
    id: 'pivot',
    category: 'Navigation',
    title: 'Pivot',
    subtitle: 'Presents information from different sources in a tabbed view.',
    description:
      'Navigate a fixed collection of PivotItem views and optionally lock the control to the selected item.',
    tags: ['pivot', 'tabs', 'tabbed view', 'navigation'],
    image: 'ControlImages/Pivot.png',
  },
  {
    id: 'selector-bar',
    category: 'Navigation',
    title: 'SelectorBar',
    subtitle: 'Switches between a small, finite set of related views.',
    description:
      'Use icon and text items with controlled native selection to update the visible content.',
    tags: ['selectorbar', 'segmented', 'tabs', 'selection'],
    image: 'ControlImages/Pivot.png',
  },
  {
    id: 'tab-view',
    category: 'Navigation',
    title: 'TabView',
    subtitle: 'Displays a collection of document tabs.',
    description:
      'Add, select, and close TabViewItem objects through an observable native items source.',
    tags: ['tabview', 'tabs', 'documents', 'close', 'navigation'],
    image: 'ControlImages/TabView.png',
  },
  {
    id: 'annotated-scroll-bar',
    category: 'Scrolling',
    title: 'AnnotatedScrollBar',
    subtitle: 'Adds labeled positions to a vertical scroll rail.',
    description:
      'Connect an AnnotatedScrollBar controller to ScrollView and provide labeled offsets and detail tooltips.',
    tags: ['annotatedscrollbar', 'annotated scroll', 'labels', 'navigation'],
    image: 'ControlImages/AnnotatedScrollBar.png',
  },
  {
    id: 'pips-pager',
    category: 'Scrolling',
    title: 'PipsPager',
    subtitle: 'Navigates paginated content with compact glyphs.',
    description:
      'Configure page count, selected index, orientation, navigation buttons, and wrap behavior.',
    tags: ['pipspager', 'pagination', 'dots', 'pages', 'carousel'],
    image: 'ControlImages/PipsPager.png',
  },
  {
    id: 'scroll-view',
    category: 'Scrolling',
    title: 'ScrollView',
    subtitle: 'Provides modern scrolling, panning, and zooming.',
    description:
      'Pan and zoom large content while observing offsets and programmatic scroll and zoom completion.',
    tags: ['scrollview', 'pan', 'zoom', 'scrolling', 'scrollpresenter'],
    image: 'ControlImages/ScrollView.png',
  },
  {
    id: 'scroll-viewer',
    category: 'Scrolling',
    title: 'ScrollViewer',
    subtitle: 'Provides classic content scrolling and zooming.',
    description:
      'Use a reactive controller to track offsets, viewport size, boundaries, and ChangeView operations.',
    tags: ['scrollviewer', 'scroll', 'zoom', 'offset', 'viewport'],
    image: 'ControlImages/ScrollViewer.png',
  },
  {
    id: 'semantic-zoom',
    category: 'Scrolling',
    title: 'SemanticZoom',
    subtitle: 'Switches between detailed and summary collection views.',
    description:
      'Own related zoomed-in and zoomed-out list views and toggle the active semantic representation.',
    tags: ['semanticzoom', 'semantic zoom', 'grouped view', 'collection'],
    image: 'ControlImages/SemanticZoom.png',
  },
  {
    id: 'auto-suggest-box',
    category: 'Text',
    title: 'AutoSuggestBox',
    subtitle: 'Combines editable text, suggestions, and query submission.',
    description:
      'Supply native suggestions and respond to draft text, chosen suggestions, and submitted queries.',
    tags: ['autosuggestbox', 'search', 'suggestions', 'query', 'text'],
    image: 'ControlImages/AutoSuggestBox.png',
  },
  {
    id: 'number-box',
    category: 'Text',
    title: 'NumberBox',
    subtitle: 'Accepts numeric values and arithmetic expressions.',
    description:
      'Configure bounds, expression evaluation, step sizes, and spin-button placement.',
    tags: ['numberbox', 'number', 'expression', 'spin button', 'input'],
    image: 'ControlImages/NumberBox.png',
  },
  {
    id: 'password-box',
    category: 'Text',
    title: 'PasswordBox',
    subtitle: 'Captures secret text with reveal behavior.',
    description:
      'Limit secret input, choose reveal behavior, and respond without exposing password content.',
    tags: ['passwordbox', 'password', 'secret', 'reveal', 'input'],
    image: 'ControlImages/PasswordBox.png',
  },
  {
    id: 'rich-edit-box',
    category: 'Text',
    title: 'RichEditBox',
    subtitle: 'Provides an editable rich text document surface.',
    description:
      'Set document text, edit multiple lines, and observe projected RichEditTextDocument changes.',
    tags: ['richeditbox', 'rich text', 'editor', 'document', 'formatting'],
    image: 'ControlImages/RichEditBox.png',
  },
  {
    id: 'rich-text-block',
    category: 'Text',
    title: 'RichTextBlock',
    subtitle: 'Displays paragraphs with independently formatted runs.',
    description:
      'Own BlockCollection and InlineCollection contents through Paragraph and Run adapters.',
    tags: ['richtextblock', 'paragraph', 'run', 'formatted text', 'display'],
    image: 'ControlImages/RichTextBlock.png',
  },
  {
    id: 'text-block',
    category: 'Text',
    title: 'TextBlock',
    subtitle: 'Displays lightweight text.',
    description:
      'Configure wrapping, trimming, sizing, selection, and theme-aware typography.',
    tags: ['textblock', 'text', 'wrapping', 'trimming', 'typography'],
    image: 'ControlImages/TextBlock.png',
  },
  {
    id: 'text-box',
    category: 'Text',
    title: 'TextBox',
    subtitle: 'Captures single-line or multiline plain text.',
    description:
      'Use headers, placeholders, multiline input, wrapping, and native TextChanged events.',
    tags: ['textbox', 'text', 'input', 'multiline', 'notes'],
    image: 'ControlImages/TextBox.png',
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
    category: 'Fundamentals',
    title: 'Resources',
    subtitle:
      'Reusable definitions for shared values to ensure consistency and maintainability.',
    description:
      'In WinUI 3, XAML resources are reusable objects like colors, brushes, or strings, defined once and used throughout your app to maintain consistency and simplify updates. These resources are typically stored in a ResourceDictionary for better organization and scalability. Special theme resources adapt automatically to light or dark modes, ensuring a seamless look across themes.',
    tags: [
      'resourcedictionary',
      'staticresource',
      'themeresource',
      'resources',
      'lightweight styling',
    ],
    image: 'ControlImages/CodeTagIcon.png',
  },
  {
    id: 'style',
    category: 'Fundamentals',
    title: 'Style',
    subtitle:
      'A style is a reusable collection of property settings for consistent UI design.',
    description:
      'Styles in WinUI 3 are reusable sets of property values that you can apply to multiple controls. They help maintain a consistent look and feel across your app. Instead of setting the same properties on every control, you define a style once and then reuse it wherever needed.',
    tags: ['setter', 'basedon', 'implicit style', 'default style'],
    image: 'ControlImages/CodeTagIcon.png',
  },
  {
    id: 'binding',
    category: 'Fundamentals',
    title: 'Binding',
    subtitle:
      'Connecting UI elements to data for automatic synchronization and updates.',
    description:
      'Binding in WinUI 3 connects a control property to a source such as another property, a data object, or a view model. It keeps source and target data synchronized and enables dynamic updates.',
    tags: [
      'x:bind',
      'data binding',
      'inotifypropertychanged',
      'observablecollection',
      'twoway',
      'oneway',
      'datacontext',
    ],
    image: 'ControlImages/CodeTagIcon.png',
  },
  {
    id: 'templates',
    category: 'Fundamentals',
    title: 'Templates',
    subtitle:
      "Customize controls' visuals, item layouts, and data presentation.",
    description:
      'A template defines the structure and appearance of a control. Unlike styles, which set properties, templates can redefine the visual tree while maintaining control functionality.',
    tags: [
      'controltemplate',
      'datatemplate',
      'itemtemplate',
      'datatemplateselector',
    ],
    image: 'ControlImages/CodeTagIcon.png',
  },
  {
    id: 'custom-user-controls',
    category: 'Fundamentals',
    title: 'Custom & User Controls',
    subtitle:
      'Create reusable UI components with custom functionality and appearance.',
    description:
      'Custom controls and user controls create reusable UI components with unique behavior and styling. User controls encapsulate a composed layout, while custom controls provide full styling and templating flexibility.',
    tags: ['usercontrol', 'custom control', 'reusable control'],
    image: 'ControlImages/CustomControls.png',
  },
  {
    id: 'xaml-conditions',
    category: 'Fundamentals',
    title: 'XAML Conditions',
    subtitle:
      'Define custom XAML conditions evaluated at parse time using IXamlCondition.',
    description:
      'XAML conditions conditionally include markup based on application-specific state such as feature flags, device capabilities, or configuration. The XAML parser evaluates each condition and caches the result for the process lifetime.',
    tags: ['ixamlcondition', 'conditional xaml', 'markup extension'],
    image: 'ControlImages/CodeTagIcon.png',
  },
  {
    id: 'scratch-pad',
    category: 'Fundamentals',
    title: 'Scratch Pad',
    subtitle: 'Scratch pad for testing simple XAML markup',
    description:
      'Provides an edit box where you can type in some markup and load it to see how it looks and behaves.',
    tags: ['playground', 'sandbox', 'test markup'],
    image: 'ControlImages/ScratchPad.png',
  },
  {
    id: 'color',
    category: 'Design',
    title: 'Color',
    subtitle:
      'Balanced color design creates clarity and aesthetic harmony.',
    description:
      'Browse the WinUI text, fill, stroke, background, signal, and High Contrast brush roles and apply them through theme resources.',
    tags: ['palette', 'brush', 'accent color', 'theme color'],
    image: 'ControlImages/ColorPaletteResources.png',
  },
  {
    id: 'geometry',
    category: 'Design',
    title: 'Geometry',
    subtitle:
      'Clear geometric design ensures visual coherence and structure.',
    description:
      'Use the WinUI overlay, control, and straight-edge corner-radius roles consistently.',
    tags: ['path', 'vector', 'figures'],
    image: 'ControlImages/Shape.png',
  },
  {
    id: 'iconography',
    category: 'Design',
    title: 'Iconography',
    subtitle:
      'Icons are a visual design language that can be used to communicate information quickly and effectively.',
    description:
      'The icons use Segoe Fluent Icons on Windows 11 and Segoe MDL2 Assets on Windows 10.',
    tags: [
      'icons',
      'glyph',
      'segoe fluent icons',
      'fonticon',
      'symbolicon',
      'icon font',
    ],
    image: 'ControlImages/IconElement.png',
  },
  {
    id: 'spacing',
    category: 'Design',
    title: 'Spacing',
    subtitle:
      'Thoughtful spacing design enhances readability and flow.',
    description:
      'Use a 4epx grid and the Windows spacing scale to group controls, cards, content sections, and pages.',
    tags: ['margin', 'padding', 'layout spacing'],
    image: 'ControlImages/CompactSizing.png',
  },
  {
    id: 'typography',
    category: 'Design',
    title: 'Typography',
    subtitle:
      'Typography design guides attention with intuitive fonts and hierarchy.',
    description:
      'Use the Segoe UI Variable type ramp and WinUI text styles for caption, body, subtitle, title, and display roles.',
    tags: [
      'font',
      'text style',
      'titletextblockstyle',
      'bodytextblockstyle',
      'font size',
    ],
    image: 'ControlImages/TextBlock.png',
  },
  {
    id: 'color-contrast',
    category: 'Accessibility',
    title: 'Color Contrast',
    subtitle:
      'High contrast design ensures accessibility for all users.',
    description:
      'Calculate text and background contrast ratios and compare regular text, large text, graphical object, and UI component results with WCAG thresholds.',
    tags: ['high contrast', 'wcag', 'accessibility'],
    image: 'ControlImages/Accessibility.png',
  },
  {
    id: 'keyboard-navigation',
    category: 'Accessibility',
    title: 'Keyboard Navigation',
    subtitle:
      'Keyboard-friendly design enables seamless interactions.',
    description:
      'Use logical tab order, arrow-key groups, accelerators, access keys, visible focus, and explicit focus targets.',
    tags: [
      'keyboard',
      'tab navigation',
      'access keys',
      'focus',
      'accessibility',
    ],
    image: 'ControlImages/Accessibility.png',
  },
  {
    id: 'screen-reader',
    category: 'Accessibility',
    title: 'Screen Reader',
    subtitle:
      'Inclusive design ensures meaningful content for assistive technologies.',
    description:
      'Expose accessible names, labels, descriptions, set position, headings, UIA tree views, and live-region events to screen readers.',
    tags: [
      'narrator',
      'automationproperties',
      'assistive technology',
      'accessibility',
    ],
    image: 'ControlImages/Accessibility.png',
  },
  {
    id: 'acrylic-brush',
    category: 'Styles',
    title: 'AcrylicBrush',
    subtitle:
      'A translucent material recommended for panel backgrounds.',
    description:
      'A translucent material recommended for panel backgrounds.',
    tags: ['acrylic', 'material', 'translucent', 'blur', 'acrylicbrush'],
    image: 'ControlImages/Acrylic.png',
  },
  {
    id: 'animated-icon',
    category: 'Styles',
    title: 'AnimatedIcon',
    subtitle:
      'An element that displays and controls an icon that animates when the user interacts with the control.',
    description:
      'An element that displays and controls an icon that animates when the user interacts with the control.',
    tags: ['animated icon', 'icon animation', 'lottie icon'],
    image: 'ControlImages/AnimatedIcon.png',
  },
  {
    id: 'compact-sizing',
    category: 'Styles',
    title: 'Compact Sizing',
    subtitle:
      'How to use a Resource Dictionary to enable compact sizing.',
    description:
      'Enables compact, smaller apps by adding a style resource at the app, page, or control level.',
    tags: ['density', 'compact sizing'],
    image: 'ControlImages/CompactSizing.png',
  },
  {
    id: 'icon-element',
    category: 'Styles',
    title: 'IconElement',
    subtitle:
      'Represents icon controls that use different image types as their content.',
    description:
      'Represents icon controls that use different image types as their content.',
    tags: [
      'bitmapicon',
      'fonticon',
      'pathicon',
      'symbolicon',
      'imageicon',
      'animatedicon',
    ],
    image: 'ControlImages/IconElement.png',
  },
  {
    id: 'line',
    category: 'Styles',
    title: 'Line',
    subtitle: 'Draws a straight line between two points.',
    description:
      'Draws a straight line between two points.',
    tags: ['stroke', 'draw line'],
    image: 'ControlImages/Line.png',
  },
  {
    id: 'shape',
    category: 'Styles',
    title: 'Shape',
    subtitle:
      'How to draw shapes, such as ellipses, rectangles, and polygons.',
    description:
      'Basic shapes are intended for decorative rendering or for compositing non-interactive parts of controls.',
    tags: ['shapes', 'ellipse', 'rectangle', 'polygon', 'path', 'circle'],
    image: 'ControlImages/Shape.png',
  },
  {
    id: 'radial-gradient-brush',
    category: 'Styles',
    title: 'RadialGradientBrush',
    subtitle: 'A brush to show radial gradients.',
    description:
      'Paints an area with a radial gradient. A center point defines the beginning and a radius defines the end.',
    tags: ['gradient', 'radial gradient', 'brush'],
    image: 'ControlImages/Canvas.png',
  },
  {
    id: 'system-backdrops',
    category: 'Styles',
    title: 'System Backdrops (Mica/Acrylic)',
    subtitle:
      'System backdrops, like Mica and Acrylic, for app windows.',
    description:
      'System backdrops apply Mica or Desktop Acrylic to the window background using built-in backdrop types or customizable controllers.',
    tags: ['mica', 'acrylic', 'window material'],
    image: 'ControlImages/Acrylic.png',
  },
  {
    id: 'system-backdrop-element',
    category: 'Styles',
    title: 'SystemBackdropElement',
    subtitle: 'An element to host system backdrop materials.',
    description:
      'Applies Mica and Acrylic to specific areas inside the UI tree for flexible and immersive designs.',
    tags: ['mica', 'acrylic', 'material'],
    image: 'ControlImages/Acrylic.png',
  },
  {
    id: 'theme-shadow',
    category: 'Styles',
    title: 'ThemeShadow',
    subtitle:
      'Adds a depth-aware shadow to UI elements using system lighting.',
    description:
      'Adds a realistic shadow using system lighting and depth to enhance visual hierarchy.',
    tags: ['depth', 'elevation'],
    image: 'ControlImages/ThemeShadow.png',
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
  | 'category-layout'
  | 'category-media'
  | 'category-menus-toolbars'
  | 'category-navigation'
  | 'category-scrolling'
  | 'category-text'
  | 'category-fundamentals'
  | 'category-design'
  | 'category-accessibility'
  | 'category-styles'
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

export const layoutPages = galleryPages.filter(
  (page) => page.category === 'Layout',
)

export const mediaPages = galleryPages.filter(
  (page) => page.category === 'Media',
)

export const menusToolbarsPages = galleryPages.filter(
  (page) => page.category === 'Menus & toolbars',
)

export const navigationPages = galleryPages.filter(
  (page) => page.category === 'Navigation',
)

export const scrollingPages = galleryPages.filter(
  (page) => page.category === 'Scrolling',
)

export const textPages = galleryPages.filter(
  (page) => page.category === 'Text',
)

export const fundamentalsPages = galleryPages.filter(
  (page) => page.category === 'Fundamentals',
)

export const designPages = galleryPages.filter(
  (page) => page.category === 'Design',
)

export const accessibilityPages = galleryPages.filter(
  (page) => page.category === 'Accessibility',
)

export const stylesPages = galleryPages.filter(
  (page) => page.category === 'Styles',
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
