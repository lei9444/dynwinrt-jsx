import {
  computed,
  isSignal,
  readSignal,
  type MaybeSignal,
} from './reactive'
import {
  cornerRadius,
  thickness,
  type WinUICornerRadius,
  type WinUIThickness,
} from './winui'
import { theme } from './theme'
import type { ThemeResourceReference } from './resource'
import type { WinUIResourceOverrides } from './winui-resources'

export type StyleValues<Props extends object> = {
  readonly [Key in keyof Props]?: MaybeSignal<Props[Key]>
}

export type StyleVariantDefinitions<Props extends object> = Record<
  string,
  Record<string, StyleValues<Props>>
>

export type StyleVariantSelection<
  Variants extends StyleVariantDefinitions<object>,
> = {
  readonly [Key in keyof Variants]?: MaybeSignal<
    Extract<keyof Variants[Key], string>
  >
}

type DefaultStyleVariants<
  Variants extends StyleVariantDefinitions<object>,
> = {
  readonly [Key in keyof Variants]?: Extract<
    keyof Variants[Key],
    string
  >
}

export interface StyleRecipeDefinition<
  Props extends object,
  Variants extends StyleVariantDefinitions<Props>,
> {
  readonly base: StyleValues<Props>
  readonly variants?: Variants
  readonly defaultVariants?: DefaultStyleVariants<Variants>
}

export type StyleRecipeResult<Props extends object> = {
  readonly [Key in keyof Props]?: MaybeSignal<Props[Key]>
}

export interface StyleRecipe<
  Props extends object,
  Variants extends StyleVariantDefinitions<Props>,
> {
  (
    selection?: StyleVariantSelection<Variants>,
  ): StyleRecipeResult<Props>
  readonly properties: readonly Extract<keyof Props, string>[]
}

export interface BaseStyleRecipe<Props extends object> {
  (): StyleRecipeResult<Props>
  readonly properties: readonly Extract<keyof Props, string>[]
}

function hasOwn(
  value: object,
  property: PropertyKey,
): boolean {
  return Object.prototype.hasOwnProperty.call(value, property)
}

export function createStyleRecipe<Props extends object>(
  definition: {
    readonly base: StyleValues<Props>
    readonly variants?: undefined
    readonly defaultVariants?: undefined
  },
): BaseStyleRecipe<Props>
export function createStyleRecipe<
  Props extends object,
  Variants extends StyleVariantDefinitions<Props>,
>(
  definition: StyleRecipeDefinition<Props, Variants> & {
    readonly variants: Variants
  },
): StyleRecipe<Props, Variants>
export function createStyleRecipe<
  Props extends object,
  Variants extends StyleVariantDefinitions<Props>,
>(
  definition: StyleRecipeDefinition<Props, Variants>,
): StyleRecipe<Props, Variants> | BaseStyleRecipe<Props> {
  const variants = definition.variants ?? {} as Variants
  const properties = new Set<Extract<keyof Props, string>>(
    Object.keys(definition.base) as Array<Extract<keyof Props, string>>,
  )

  for (const variantName of Object.keys(
    definition.defaultVariants ?? {},
  )) {
    if (!hasOwn(variants, variantName)) {
      throw new TypeError(
        `Unknown default style variant "${variantName}".`,
      )
    }
  }

  for (const [variantName, choices] of Object.entries(variants)) {
    if (
      definition.defaultVariants?.[variantName] !== undefined &&
      !hasOwn(
        choices,
        definition.defaultVariants[variantName] as PropertyKey,
      )
    ) {
      throw new TypeError(
        `Unknown default variant ${variantName}=${String(
          definition.defaultVariants[variantName],
        )}.`,
      )
    }
    for (const values of Object.values(choices)) {
      for (const property of Object.keys(values)) {
        if (!hasOwn(definition.base, property)) {
          throw new TypeError(
            `Style variant ${variantName} changes "${property}", but base does not define it.`,
          )
        }
        properties.add(property as Extract<keyof Props, string>)
      }
    }
  }

  const resolveChoice = (
    variantName: string,
    selection: StyleVariantSelection<Variants>,
  ): StyleValues<Props> | undefined => {
    const source =
      selection[variantName] ??
      definition.defaultVariants?.[variantName]
    if (source === undefined) {
      return undefined
    }
    const choice = readSignal(source)
    const choices = variants[variantName]
    if (!choices || !hasOwn(choices, choice)) {
      throw new TypeError(
        `Unknown style variant ${variantName}=${String(choice)}.`,
      )
    }
    return choices[choice]
  }

  const recipe = ((
    selection: StyleVariantSelection<Variants> = {},
  ): StyleRecipeResult<Props> => {
    for (const variantName of Object.keys(selection)) {
      if (!hasOwn(variants, variantName)) {
        throw new TypeError(`Unknown style variant "${variantName}".`)
      }
    }

    const dynamicSelection = Object.values(selection).some(isSignal)
    const result: Record<string, unknown> = {}

    for (const property of properties) {
      const resolveValue = (unwrapSignals: boolean): unknown => {
        let value = definition.base[property]
        for (const variantName of Object.keys(variants)) {
          const values = resolveChoice(variantName, selection)
          if (values && hasOwn(values, property)) {
            value = values[property]
          }
        }
        return unwrapSignals && isSignal(value)
          ? value.value
          : value
      }

      result[property] = dynamicSelection
        ? computed(() => resolveValue(true))
        : resolveValue(false)
    }

    return result as StyleRecipeResult<Props>
  }) as StyleRecipe<Props, Variants>

  Object.defineProperty(recipe, 'properties', {
    value: Object.freeze([...properties]),
    enumerable: true,
  })
  return recipe
}

export interface WinUIElevation {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface WinUITypographyToken {
  readonly fontSize: number
  readonly fontWeight: {
    readonly weight: number
  }
}

const spacingTokens = Object.freeze({
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
})

const radiusTokens = Object.freeze({
  none: cornerRadius(0),
  control: cornerRadius(4),
  card: cornerRadius(8),
  overlay: cornerRadius(12),
  round: cornerRadius(999),
})

const typographyTokens = Object.freeze({
  caption: Object.freeze({
    fontSize: 12,
    fontWeight: Object.freeze({ weight: 400 }),
  }),
  body: Object.freeze({
    fontSize: 14,
    fontWeight: Object.freeze({ weight: 400 }),
  }),
  bodyStrong: Object.freeze({
    fontSize: 14,
    fontWeight: Object.freeze({ weight: 600 }),
  }),
  subtitle: Object.freeze({
    fontSize: 20,
    fontWeight: Object.freeze({ weight: 600 }),
  }),
  title: Object.freeze({
    fontSize: 28,
    fontWeight: Object.freeze({ weight: 700 }),
  }),
  display: Object.freeze({
    fontSize: 40,
    fontWeight: Object.freeze({ weight: 700 }),
  }),
})

const elevationTokens = Object.freeze({
  none: Object.freeze({ x: 0, y: 0, z: 0 }),
  low: Object.freeze({ x: 0, y: 0, z: 8 }),
  medium: Object.freeze({ x: 0, y: 0, z: 16 }),
  high: Object.freeze({ x: 0, y: 0, z: 32 }),
})

export const tokens = Object.freeze({
  spacing: spacingTokens,
  radius: radiusTokens,
  typography: typographyTokens,
  elevation: elevationTokens,
})

interface CardStyleProps {
  padding: WinUIThickness
  cornerRadius: WinUICornerRadius
  borderThickness: WinUIThickness
  background: ThemeResourceReference
  borderBrush: ThemeResourceReference
}

type CardStyleVariants = {
  density: {
    compact: StyleValues<CardStyleProps>
    comfortable: StyleValues<CardStyleProps>
    spacious: StyleValues<CardStyleProps>
  }
  surface: {
    card: StyleValues<CardStyleProps>
    layer: StyleValues<CardStyleProps>
    subtle: StyleValues<CardStyleProps>
  }
}

const card = createStyleRecipe<CardStyleProps, CardStyleVariants>({
  base: {
    padding: thickness(tokens.spacing.lg),
    cornerRadius: tokens.radius.card,
    borderThickness: thickness(1),
    background: theme.cardBackground,
    borderBrush: theme.cardStroke,
  },
  variants: {
    density: {
      compact: { padding: thickness(tokens.spacing.md) },
      comfortable: { padding: thickness(tokens.spacing.lg) },
      spacious: { padding: thickness(tokens.spacing.xl) },
    },
    surface: {
      card: {
        background: theme.cardBackground,
        borderBrush: theme.cardStroke,
      },
      layer: {
        background: theme.layerFill,
        borderBrush: theme.surfaceStroke,
      },
      subtle: {
        background: theme.subtleFill,
        borderBrush: theme.dividerStroke,
      },
    },
  },
  defaultVariants: {
    density: 'comfortable',
    surface: 'card',
  },
})

interface HeadingStyleProps {
  fontSize: number
  fontWeight: {
    readonly weight: number
  }
  foreground: ThemeResourceReference
}

type HeadingStyleVariants = {
  level: {
    caption: StyleValues<HeadingStyleProps>
    body: StyleValues<HeadingStyleProps>
    bodyStrong: StyleValues<HeadingStyleProps>
    subtitle: StyleValues<HeadingStyleProps>
    title: StyleValues<HeadingStyleProps>
    display: StyleValues<HeadingStyleProps>
  }
  tone: {
    primary: StyleValues<HeadingStyleProps>
    secondary: StyleValues<HeadingStyleProps>
    accent: StyleValues<HeadingStyleProps>
  }
}

const heading = createStyleRecipe<
  HeadingStyleProps,
  HeadingStyleVariants
>({
  base: {
    ...tokens.typography.body,
    foreground: theme.primaryText,
  },
  variants: {
    level: {
      caption: tokens.typography.caption,
      body: tokens.typography.body,
      bodyStrong: tokens.typography.bodyStrong,
      subtitle: tokens.typography.subtitle,
      title: tokens.typography.title,
      display: tokens.typography.display,
    },
    tone: {
      primary: { foreground: theme.primaryText },
      secondary: { foreground: theme.secondaryText },
      accent: { foreground: theme.accentText },
    },
  },
  defaultVariants: {
    level: 'body',
    tone: 'primary',
  },
})

interface ButtonStyleProps {
  padding: WinUIThickness
  resourceOverrides: WinUIResourceOverrides
}

type ButtonStyleVariants = {
  density: {
    compact: StyleValues<ButtonStyleProps>
    comfortable: StyleValues<ButtonStyleProps>
  }
  variant: {
    standard: StyleValues<ButtonStyleProps>
    accent: StyleValues<ButtonStyleProps>
    subtle: StyleValues<ButtonStyleProps>
  }
}

const button = createStyleRecipe<
  ButtonStyleProps,
  ButtonStyleVariants
>({
  base: {
    padding: thickness(tokens.spacing.md, tokens.spacing.sm),
    resourceOverrides: {},
  },
  variants: {
    density: {
      compact: {
        padding: thickness(tokens.spacing.sm, tokens.spacing.xs),
      },
      comfortable: {
        padding: thickness(tokens.spacing.md, tokens.spacing.sm),
      },
    },
    variant: {
      standard: {
        resourceOverrides: {},
      },
      accent: {
        resourceOverrides: Object.freeze({
          ButtonBackground: theme.accent,
          ButtonBackgroundPointerOver: theme.accentSecondary,
          ButtonBackgroundPressed: theme.accentTertiary,
          ButtonBackgroundDisabled: theme.accentDisabled,
          ButtonForeground: theme.textOnAccent,
          ButtonForegroundPointerOver: theme.textOnAccent,
          ButtonForegroundPressed: theme.textOnAccent,
        }),
      },
      subtle: {
        resourceOverrides: Object.freeze({
          ButtonBackground: theme.subtleFill,
          ButtonBackgroundPointerOver: theme.controlFillSecondary,
          ButtonBackgroundPressed: theme.controlFillTertiary,
          ButtonForeground: theme.primaryText,
        }),
      },
    },
  },
  defaultVariants: {
    density: 'comfortable',
    variant: 'standard',
  },
})

interface StatusStyleProps {
  padding: WinUIThickness
  cornerRadius: WinUICornerRadius
  borderThickness: WinUIThickness
  background: ThemeResourceReference
  borderBrush: ThemeResourceReference
}

type StatusStyleVariants = {
  tone: {
    neutral: StyleValues<StatusStyleProps>
    attention: StyleValues<StatusStyleProps>
    success: StyleValues<StatusStyleProps>
    caution: StyleValues<StatusStyleProps>
    critical: StyleValues<StatusStyleProps>
  }
}

const status = createStyleRecipe<
  StatusStyleProps,
  StatusStyleVariants
>({
  base: {
    padding: thickness(tokens.spacing.md),
    cornerRadius: tokens.radius.control,
    borderThickness: thickness(1),
    background: theme.systemNeutralBackground,
    borderBrush: theme.systemNeutral,
  },
  variants: {
    tone: {
      neutral: {
        background: theme.systemNeutralBackground,
        borderBrush: theme.systemNeutral,
      },
      attention: {
        background: theme.systemAttentionBackground,
        borderBrush: theme.systemAttention,
      },
      success: {
        background: theme.systemSuccessBackground,
        borderBrush: theme.systemSuccess,
      },
      caution: {
        background: theme.systemCautionBackground,
        borderBrush: theme.systemCaution,
      },
      critical: {
        background: theme.systemCriticalBackground,
        borderBrush: theme.systemCritical,
      },
    },
  },
  defaultVariants: {
    tone: 'neutral',
  },
})

export const styles = Object.freeze({
  button,
  card,
  heading,
  status,
})
