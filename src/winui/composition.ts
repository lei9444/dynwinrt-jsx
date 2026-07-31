import {
  createNativeResourceOwner,
  type NativeResourceOwner,
  type NativeResourceOwnerOptions,
} from '../runtime/native-resource'

export interface XamlAnimationTarget<
  Animation extends object,
> {
  startAnimation(animation: Animation): void
  stopAnimation(animation: Animation): void
}

export interface CompositionPropertyTarget<
  Animation extends object,
> {
  startAnimation(
    propertyName: string,
    animation: Animation,
  ): void
  stopAnimation(propertyName: string): void
}

export interface CompositionOwner
extends NativeResourceOwner {
  start<Animation extends object>(
    target: XamlAnimationTarget<Animation>,
    animation: Animation,
  ): void
  stop<Animation extends object>(
    target: XamlAnimationTarget<Animation>,
    animation: Animation,
  ): void
  startProperty<Animation extends object>(
    target: CompositionPropertyTarget<Animation>,
    propertyName: string,
    animation: Animation,
  ): void
  stopProperty<Animation extends object>(
    target: CompositionPropertyTarget<Animation>,
    propertyName: string,
  ): void
  stopAll(target: object): void
}

export function createCompositionOwner(
  options: NativeResourceOwnerOptions = {},
): CompositionOwner {
  const resources = createNativeResourceOwner(options)
  const xamlCleanups =
    new Map<object, Map<object, () => void>>()
  const propertyCleanups =
    new Map<object, Map<string, () => void>>()

  const untrackXaml = (
    target: object,
    animation: object,
  ) => {
    const targets = xamlCleanups.get(target)
    targets?.delete(animation)
    if (targets?.size === 0) {
      xamlCleanups.delete(target)
    }
  }
  const untrackProperty = (
    target: object,
    propertyName: string,
  ) => {
    const targets = propertyCleanups.get(target)
    targets?.delete(propertyName)
    if (targets?.size === 0) {
      propertyCleanups.delete(target)
    }
  }
  const runCleanups = (
    cleanups: readonly (() => void)[],
  ) => {
    const failures: unknown[] = []
    for (const cleanup of cleanups) {
      try {
        cleanup()
      }
      catch (error) {
        failures.push(error)
      }
    }
    if (failures.length === 1) {
      throw failures[0]
    }
    if (failures.length > 1) {
      throw new AggregateError(
        failures,
        'Composition target cleanup failed.',
      )
    }
  }

  return {
    get disposed() {
      return resources.disposed
    },
    own: resources.own,
    ownCloseable: resources.ownCloseable,
    ownDisposable: resources.ownDisposable,
    ownProjected: resources.ownProjected,
    defer: resources.defer,
    release: resources.release,
    dispose: resources.dispose,
    start(target, animation) {
      target.startAnimation(animation)
      let targets = xamlCleanups.get(target)
      if (!targets) {
        targets = new Map()
        xamlCleanups.set(target, targets)
      }
      if (targets.has(animation as object)) {
        return
      }
      const cleanup = resources.defer(() => {
        target.stopAnimation(animation)
        untrackXaml(
          target as object,
          animation as object,
        )
      })
      targets.set(animation as object, cleanup)
    },
    stop(target, animation) {
      const cleanup = xamlCleanups
        .get(target as object)
        ?.get(animation as object)
      if (cleanup) {
        cleanup()
        return
      }
      target.stopAnimation(animation)
    },
    startProperty(
      target,
      propertyName,
      animation,
    ) {
      this.stopProperty(target, propertyName)
      target.startAnimation(propertyName, animation)
      let targets = propertyCleanups.get(target)
      if (!targets) {
        targets = new Map()
        propertyCleanups.set(target, targets)
      }
      const cleanup = resources.defer(() => {
        target.stopAnimation(propertyName)
        untrackProperty(
          target as object,
          propertyName,
        )
      })
      targets.set(propertyName, cleanup)
    },
    stopProperty(target, propertyName) {
      const cleanup = propertyCleanups
        .get(target as object)
        ?.get(propertyName)
      if (cleanup) {
        cleanup()
      }
    },
    stopAll(target) {
      runCleanups([
        ...(
          xamlCleanups
            .get(target)
            ?.values() ?? []
        ),
        ...(
          propertyCleanups
            .get(target)
            ?.values() ?? []
        ),
      ])
    },
  }
}
