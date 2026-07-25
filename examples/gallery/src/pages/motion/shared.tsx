import {
  computed,
  onCleanup,
  signal,
  type ReadonlySignal,
} from 'dynwinrt-jsx'
import {
  DurationType,
  InfoBarSeverity,
  releaseProjected,
  UISettings,
} from '#winapp/bindings'
import { UI } from '../../gallery-ui'

export interface MotionSettings {
  readonly enabled: ReadonlySignal<boolean>
  readonly status: ReadonlySignal<string>
}

export function useMotionSettings(): MotionSettings {
  const settings = new UISettings()
  const enabled = signal(settings.animationsEnabled)
  const update = () => {
    enabled.value = settings.animationsEnabled
  }
  const unsubscribe = settings.onAnimationsEnabledChanged(update)
  onCleanup(() => {
    let firstError: unknown
    try {
      unsubscribe()
    }
    catch (error: unknown) {
      firstError = error
    }
    try {
      releaseProjected(settings)
    }
    catch (error: unknown) {
      firstError ??= error
    }
    if (firstError !== undefined) {
      throw firstError
    }
  })
  return {
    enabled,
    status: computed(() =>
      enabled.value
        ? 'Windows animations are enabled.'
        : 'Reduced motion is active. Animated changes are applied immediately.',
    ),
  }
}

export function MotionStatus(props: {
  readonly automationId: string
  readonly settings: MotionSettings
}) {
  return (
    <UI.InfoBar
      automationId={props.automationId}
      isClosable={false}
      isOpen
      severity={InfoBarSeverity.Informational}
      title="Motion setting"
      message={props.settings.status}
    />
  )
}

export function duration(milliseconds: number) {
  return {
    timeSpan: {
      duration: BigInt(Math.round(milliseconds * 10_000)),
    },
    type: DurationType.TimeSpan,
  }
}

export function timeSpan(milliseconds: number) {
  return {
    duration: BigInt(Math.round(milliseconds * 10_000)),
  }
}

export function releaseMotionResources(
  resources: readonly unknown[],
): void {
  let firstError: unknown
  for (const resource of resources) {
    if (!resource) {
      continue
    }
    try {
      const close = Reflect.get(resource as object, 'close')
      if (typeof close === 'function') {
        Reflect.apply(close, resource, [])
      }
      else {
        releaseProjected(resource)
      }
    }
    catch (error: unknown) {
      firstError ??= error
    }
  }
  if (firstError !== undefined) {
    throw firstError
  }
}
