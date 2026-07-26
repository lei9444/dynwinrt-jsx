import type {
  AppNotification,
  AppNotificationActivatedEventArgs,
  AppNotificationManager,
  AppNotificationSetting,
} from '#winapp/bindings'

type NotificationAbortSignal = NonNullable<
  Parameters<AppNotificationManager['getAllAsync']>[0]
>

export interface AppNotificationLease {
  dispose(): void
}

export interface AppNotificationOwner {
  readonly group: string
  readonly registered: boolean
  readonly cleanupInFlight: boolean
  readonly cleanupFailure: unknown
  readonly setting: AppNotificationSetting | undefined
  acquire(
    onInvoked: (args: AppNotificationActivatedEventArgs) => void,
  ): AppNotificationLease
  register(
    registerManager: (manager: AppNotificationManager) => void,
  ): AppNotificationSetting
  show(notification: AppNotification, tag: string): void
  getAllAsync(signal?: NotificationAbortSignal): ReturnType<
    AppNotificationManager['getAllAsync']
  >
  remove(
    tag: string,
    signal?: NotificationAbortSignal,
  ): Promise<void>
  releaseRegistration(): void | Promise<void>
  dispose(): void | Promise<void>
}

export interface AppNotificationOwnerOptions {
  readonly group?: string
  readonly getManager: () => AppNotificationManager
}

export function createAppNotificationOwner(
  options: AppNotificationOwnerOptions,
): AppNotificationOwner {
  const group = options.group ??
    `dynwinrt-jsx-gallery-${Date.now().toString(36)}`
  const leases = new Set<
    (args: AppNotificationActivatedEventArgs) => void
  >()
  const ownedTags = new Set<string>()
  let manager: AppNotificationManager | undefined
  let removeInvoked: (() => void) | undefined
  let registered = false
  let disposing = false
  let disposed = false
  let cleanupFailure: unknown
  let cleanupPromise: Promise<void> | undefined

  const releaseRegistration = () => {
    if (cleanupPromise) {
      return cleanupPromise
    }
    if (
      !manager &&
      ownedTags.size === 0 &&
      !registered &&
      !removeInvoked
    ) {
      cleanupFailure = undefined
      if (disposing) {
        disposed = true
      }
      return
    }
    const managerToRelease = manager
    cleanupPromise = (async () => {
      let firstError: unknown
      if (managerToRelease) {
        for (const tag of [...ownedTags]) {
          try {
            await managerToRelease.removeByTagAndGroupAsync(
              tag,
              group,
            )
            ownedTags.delete(tag)
          }
          catch (error) {
            firstError ??= error
          }
        }
      }
      if (registered && managerToRelease) {
        try {
          managerToRelease.unregister()
          registered = false
        }
        catch (error) {
          firstError ??= error
        }
      }
      if (removeInvoked) {
        try {
          removeInvoked()
          removeInvoked = undefined
        }
        catch (error) {
          firstError ??= error
        }
      }
      if (
        ownedTags.size === 0 &&
        !registered &&
        !removeInvoked
      ) {
        manager = undefined
      }
      if (firstError !== undefined) {
        throw firstError
      }
    })()
    return cleanupPromise.then(() => {
      cleanupFailure = undefined
      if (disposing) {
        disposed = true
      }
    }, (error) => {
      cleanupFailure = error
      throw error
    }).finally(() => {
      cleanupPromise = undefined
    })
  }

  return {
    group,
    get registered() {
      return registered
    },
    get cleanupInFlight() {
      return cleanupPromise !== undefined
    },
    get cleanupFailure() {
      return cleanupFailure
    },
    get setting() {
      return manager?.setting
    },
    acquire(onInvoked) {
      if (disposing || disposed) {
        throw new Error(
          'App notification owner is shutting down.',
        )
      }
      let released = false
      leases.add(onInvoked)
      return {
        dispose() {
          if (released) {
            return
          }
          released = true
          leases.delete(onInvoked)
        },
      }
    },
    register(registerManager) {
      if (disposing || disposed) {
        throw new Error(
          'App notification owner is shutting down.',
        )
      }
      if (cleanupPromise) {
        throw new Error(
          'App notification cleanup is still in progress.',
        )
      }
      if (cleanupFailure !== undefined) {
        throw new Error(
          'Previous app notification cleanup failed; retry cleanup before registering.',
          { cause: cleanupFailure },
        )
      }
      manager ??= options.getManager()
      if (registered) {
        return manager.setting
      }
      if (!removeInvoked) {
        removeInvoked = manager.onNotificationInvoked(
          (_sender, args) => {
            for (const notify of [...leases]) {
              notify(args)
            }
          },
        )
      }
      try {
        registerManager(manager)
        registered = true
        return manager.setting
      }
      catch (error) {
        try {
          removeInvoked?.()
          removeInvoked = undefined
        }
        catch {
          // The original registration error remains primary.
        }
        if (!removeInvoked) {
          manager = undefined
        }
        throw error
      }
    },
    show(notification, tag) {
      if (!registered || !manager) {
        throw new Error(
          'App notification manager is not registered.',
        )
      }
      notification.tag = tag
      notification.group = group
      manager.show(notification)
      ownedTags.add(tag)
    },
    getAllAsync(signal) {
      if (!registered || !manager) {
        throw new Error(
          'App notification manager is not registered.',
        )
      }
      return manager.getAllAsync(signal)
    },
    async remove(tag, signal) {
      if (!manager) {
        return
      }
      await manager.removeByTagAndGroupAsync(tag, group, signal)
      ownedTags.delete(tag)
    },
    releaseRegistration,
    dispose() {
      if (disposed) {
        return
      }
      disposing = true
      leases.clear()
      return releaseRegistration()
    },
  }
}
