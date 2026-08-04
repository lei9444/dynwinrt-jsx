import {
  computed,
  createRoot,
  effect,
  type Cleanup,
  type ReadonlySignal,
} from '../core/reactive'

export interface WinUIThemePair<Value> {
  readonly Light: Value
  readonly Dark: Value
}

interface WinUIThemeControllerBaseOptions<
  ApplicationTheme,
  ElementTheme,
> {
  readonly isDark: ReadonlySignal<boolean>
  readonly setDark: (value: boolean) => void
  readonly application: {
    requestedTheme: ApplicationTheme
  }
  readonly applicationTheme: WinUIThemePair<ApplicationTheme>
  readonly elementTheme: WinUIThemePair<ElementTheme>
}

type WinUIThemeControllerTitleBarOptions<TitleBarTheme> =
  | {
      readonly titleBar?: undefined
      readonly titleBarTheme?: undefined
    }
  | {
      readonly titleBar: {
        preferredTheme: TitleBarTheme
      }
      readonly titleBarTheme: WinUIThemePair<TitleBarTheme>
    }

export type WinUIThemeControllerOptions<
  ApplicationTheme,
  ElementTheme,
  TitleBarTheme,
> = WinUIThemeControllerBaseOptions<
  ApplicationTheme,
  ElementTheme
> & WinUIThemeControllerTitleBarOptions<TitleBarTheme>

interface WinUIThemeControllerBindingBaseOptions<
  ApplicationTheme,
  ElementTheme,
> {
  readonly isDark: ReadonlySignal<boolean>
  readonly setDark: (value: boolean) => void
  readonly application: {
    requestedTheme: ApplicationTheme
  }
  readonly bindings: {
    readonly ApplicationTheme:
      WinUIThemePair<ApplicationTheme>
    readonly ElementTheme:
      WinUIThemePair<ElementTheme>
  }
}

export type WinUIThemeControllerBindingOptions<
  ApplicationTheme,
  ElementTheme,
  TitleBarTheme,
> =
  | (
      WinUIThemeControllerBindingBaseOptions<
        ApplicationTheme,
        ElementTheme
      > & {
        readonly titleBar?: undefined
      }
    )
  | (
      Omit<
        WinUIThemeControllerBindingBaseOptions<
          ApplicationTheme,
          ElementTheme
        >,
        'bindings'
      > & {
        readonly bindings:
          WinUIThemeControllerBindingBaseOptions<
            ApplicationTheme,
            ElementTheme
          >['bindings'] & {
            readonly TitleBarTheme:
              WinUIThemePair<TitleBarTheme>
          }
        readonly titleBar: {
          preferredTheme: TitleBarTheme
        }
      }
    )

export interface WinUIThemeController<ElementTheme> {
  readonly isDark: ReadonlySignal<boolean>
  readonly requestedTheme: ReadonlySignal<ElementTheme>
  setDark(value: boolean): void
  toggle(): void
  dispose(): void
}

export function createWinUIThemeController<
  ApplicationTheme,
  ElementTheme,
  TitleBarTheme = never,
>(
  options: WinUIThemeControllerOptions<
      ApplicationTheme,
      ElementTheme,
      TitleBarTheme
    > |
    WinUIThemeControllerBindingOptions<
      ApplicationTheme,
      ElementTheme,
      TitleBarTheme
    >,
): WinUIThemeController<ElementTheme> {
  return createRoot((dispose: Cleanup) => {
    let applicationTheme:
      WinUIThemePair<ApplicationTheme>
    let elementTheme:
      WinUIThemePair<ElementTheme>
    let titleBarTheme:
      WinUIThemePair<TitleBarTheme> | undefined
    const usesBindings =
      !('applicationTheme' in options) &&
      'bindings' in options
    if (usesBindings) {
      if (
        !options.bindings.ApplicationTheme ||
        !options.bindings.ElementTheme
      ) {
        throw new TypeError(
          'Theme controller bindings require ApplicationTheme and ElementTheme.',
        )
      }
      applicationTheme =
        options.bindings.ApplicationTheme
      elementTheme = options.bindings.ElementTheme
      titleBarTheme =
        options.titleBar &&
        'TitleBarTheme' in options.bindings
          ? options.bindings.TitleBarTheme
          : undefined
    }
    else {
      applicationTheme = options.applicationTheme
      elementTheme = options.elementTheme
      titleBarTheme = options.titleBarTheme
    }
    if (
      (options.titleBar && !titleBarTheme) ||
      (
        !usesBindings &&
        !options.titleBar &&
        titleBarTheme
      )
    ) {
      throw new TypeError(
        'titleBar and titleBarTheme must be provided together.',
      )
    }

    const requestedTheme = computed(() =>
      options.isDark.value
        ? elementTheme.Dark
        : elementTheme.Light,
    )

    effect(() => {
      const dark = options.isDark.value
      options.application.requestedTheme = dark
        ? applicationTheme.Dark
        : applicationTheme.Light
      if (options.titleBar && titleBarTheme) {
        options.titleBar.preferredTheme = dark
          ? titleBarTheme.Dark
          : titleBarTheme.Light
      }
    })

    return {
      isDark: options.isDark,
      requestedTheme,
      setDark(value) {
        if (options.isDark.peek() !== value) {
          options.setDark(value)
        }
      },
      toggle() {
        options.setDark(!options.isDark.peek())
      },
      dispose,
    }
  })
}
