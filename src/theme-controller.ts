import {
  computed,
  createRoot,
  effect,
  type Cleanup,
  type ReadonlySignal,
} from './reactive'

interface ThemePair<Value> {
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
  readonly applicationTheme: ThemePair<ApplicationTheme>
  readonly elementTheme: ThemePair<ElementTheme>
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
      readonly titleBarTheme: ThemePair<TitleBarTheme>
    }

export type WinUIThemeControllerOptions<
  ApplicationTheme,
  ElementTheme,
  TitleBarTheme,
> = WinUIThemeControllerBaseOptions<
  ApplicationTheme,
  ElementTheme
> & WinUIThemeControllerTitleBarOptions<TitleBarTheme>

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
  >,
): WinUIThemeController<ElementTheme> {
  return createRoot((dispose: Cleanup) => {
    if (
      (options.titleBar && !options.titleBarTheme) ||
      (!options.titleBar && options.titleBarTheme)
    ) {
      throw new TypeError(
        'titleBar and titleBarTheme must be provided together.',
      )
    }

    const requestedTheme = computed(() =>
      options.isDark.value
        ? options.elementTheme.Dark
        : options.elementTheme.Light,
    )

    effect(() => {
      const dark = options.isDark.value
      options.application.requestedTheme = dark
        ? options.applicationTheme.Dark
        : options.applicationTheme.Light
      if (options.titleBar && options.titleBarTheme) {
        options.titleBar.preferredTheme = dark
          ? options.titleBarTheme.Dark
          : options.titleBarTheme.Light
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
