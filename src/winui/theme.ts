import {
  themeResource,
  type ThemeResourceReference,
} from './resource'

function ref<Value = unknown>(
  key: string,
  fallback?: Value,
): ThemeResourceReference<Value> {
  return themeResource(key, fallback)
}

export const theme = Object.freeze({
  accent: ref('AccentFillColorDefaultBrush'),
  accentSecondary: ref('AccentFillColorSecondaryBrush'),
  accentTertiary: ref('AccentFillColorTertiaryBrush'),
  accentDisabled: ref('AccentFillColorDisabledBrush'),

  primaryText: ref('TextFillColorPrimaryBrush'),
  secondaryText: ref('TextFillColorSecondaryBrush'),
  tertiaryText: ref('TextFillColorTertiaryBrush'),
  disabledText: ref('TextFillColorDisabledBrush'),
  accentText: ref('AccentTextFillColorPrimaryBrush'),
  textOnAccent: ref('TextOnAccentFillColorPrimaryBrush'),

  solidBackground: ref('SolidBackgroundFillColorBaseBrush'),
  cardBackground: ref('CardBackgroundFillColorDefaultBrush'),
  smokeFill: ref('SmokeFillColorDefaultBrush'),
  subtleFill: ref('SubtleFillColorSecondaryBrush'),
  layerFill: ref('LayerFillColorDefaultBrush'),

  controlFill: ref('ControlFillColorDefaultBrush'),
  controlFillSecondary: ref('ControlFillColorSecondaryBrush'),
  controlFillTertiary: ref('ControlFillColorTertiaryBrush'),
  controlFillDisabled: ref('ControlFillColorDisabledBrush'),
  controlFillInputActive: ref('ControlFillColorInputActiveBrush'),

  cardStroke: ref('CardStrokeColorDefaultBrush'),
  surfaceStroke: ref('SurfaceStrokeColorDefaultBrush'),
  dividerStroke: ref('DividerStrokeColorDefaultBrush'),
  controlStroke: ref('ControlStrokeColorDefaultBrush'),
  controlStrokeSecondary: ref('ControlStrokeColorSecondaryBrush'),

  systemAttention: ref('SystemFillColorAttentionBrush'),
  systemSuccess: ref('SystemFillColorSuccessBrush'),
  systemCaution: ref('SystemFillColorCautionBrush'),
  systemCritical: ref('SystemFillColorCriticalBrush'),
  systemNeutral: ref('SystemFillColorNeutralBrush'),
  systemSolidNeutral: ref('SystemFillColorSolidNeutralBrush'),
  systemAttentionBackground: ref(
    'SystemFillColorAttentionBackgroundBrush',
  ),
  systemSuccessBackground: ref(
    'SystemFillColorSuccessBackgroundBrush',
  ),
  systemCautionBackground: ref(
    'SystemFillColorCautionBackgroundBrush',
  ),
  systemCriticalBackground: ref(
    'SystemFillColorCriticalBackgroundBrush',
  ),
  systemNeutralBackground: ref(
    'SystemFillColorNeutralBackgroundBrush',
  ),
  systemSolidAttention: ref(
    'SystemFillColorSolidAttentionBackgroundBrush',
  ),

  ref,
})
