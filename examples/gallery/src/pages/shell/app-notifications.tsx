import {
  onCleanup,
  signal,
} from 'dynwinrt-jsx'
import {
  AppNotification,
  AppNotificationBuilder,
  AppNotificationButton,
  AppNotificationComboBox,
  AppNotificationImageCrop,
  AppNotificationManager,
  AppNotificationProgressBar,
  AppNotificationSetting,
  AppNotificationSoundEvent,
  Orientation,
  TextWrapping,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { createGalleryAssetUri } from '../../gallery-assets'
import { Page, SampleCard } from '../../components/gallery-components'
import {
  detectPackageIdentity,
  formatNativeError,
} from './shared'

const probeTag = 'dynwinrt-jsx-gallery-probe'

type NotificationAbortSignal = NonNullable<
  Parameters<AppNotificationManager['getAllAsync']>[0]
>

declare const AbortController: {
  new(): {
    readonly signal: NotificationAbortSignal
    abort(): void
  }
}

function describeSetting(setting: AppNotificationSetting): string {
  switch (setting) {
    case AppNotificationSetting.Enabled:
      return 'enabled'
    case AppNotificationSetting.DisabledForApplication:
      return 'disabled for this application'
    case AppNotificationSetting.DisabledForUser:
      return 'disabled for the current user'
    case AppNotificationSetting.DisabledByGroupPolicy:
      return 'disabled by Group Policy'
    case AppNotificationSetting.DisabledByManifest:
      return 'disabled by the package manifest'
    case AppNotificationSetting.Unsupported:
      return 'unsupported'
  }
}

export function AppNotificationsPage(context: AppContext) {
  const identity = detectPackageIdentity()
  const launcherCapability =
    context.shellCapabilities.appNotifications
  const registrationPrerequisite = identity.available
    ? identity
    : launcherCapability
  const registrationPrerequisiteAvailable =
    registrationPrerequisite.available
  const registrationPrerequisiteDescription =
    registrationPrerequisite.available
      ? identity.available
        ? `Package identity detected (${identity.value}).`
        : `App-specific notification launcher capability detected (${registrationPrerequisite.value}).`
      : registrationPrerequisite.reason
  let supported = false
  let supportError: unknown
  try {
    supported = AppNotificationManager.isSupported()
  }
  catch (error) {
    supportError = error
  }

  const registered = signal(context.appNotifications.registered)
  const notificationEnabled = signal(
    context.appNotifications.setting === AppNotificationSetting.Enabled,
  )
  const registrationStatus = signal(
    !registrationPrerequisiteAvailable
      ? registrationPrerequisiteDescription
      : supportError
      ? `App notification support check failed: ${formatNativeError(supportError)}`
      : supported
        ? `${registrationPrerequisiteDescription} App notification APIs are supported; this page has not registered yet.`
        : `${registrationPrerequisiteDescription} App notification APIs are not supported by this Windows App SDK runtime.`,
  )
  const operationStatus = signal(
    'No app notification operation has been submitted.',
  )
  const activationStatus = signal(
    'No notification activation has been received by this page.',
  )
  let disposed = false
  let notificationSequence = 0
  let currentAbort:
    | {
      readonly signal: NotificationAbortSignal
      abort(): void
    }
    | undefined
  const notificationLease = context.appNotifications.acquire((args) => {
    const message = args.argument
      ? `Notification invoked with arguments: ${args.argument}`
      : 'Notification invoked without arguments.'
    context.window.dispatcherQueue.tryEnqueue(() => {
      if (!disposed) {
        activationStatus.value = message
      }
    })
  })

  onCleanup(() => {
    disposed = true
    currentAbort?.abort()
    currentAbort = undefined
    notificationLease.dispose()
  })

  const register = (): boolean => {
    if (context.appNotifications.cleanupInFlight) {
      registrationStatus.value =
        'Registration is waiting for the application-owned notification cleanup to finish.'
      return false
    }
    if (context.appNotifications.cleanupFailure !== undefined) {
      registrationStatus.value =
        `Registration blocked because previous notification cleanup failed: ${formatNativeError(context.appNotifications.cleanupFailure)}`
      return false
    }
    if (context.appNotifications.registered) {
      notificationEnabled.value =
        context.appNotifications.setting ===
          AppNotificationSetting.Enabled
      registrationStatus.value =
        `Registered. Notifications are ${describeSetting(context.appNotifications.setting!)}.`
      return notificationEnabled.value
    }
    if (!registrationPrerequisiteAvailable) {
      registrationStatus.value =
        registrationPrerequisiteDescription
      return false
    }
    if (!supported) {
      registrationStatus.value =
        'Registration unavailable because AppNotificationManager.IsSupported returned false.'
      return false
    }

    try {
      const setting = context.appNotifications.register((manager) => {
        if (identity.available) {
          manager.register()
        }
        else {
          manager.register(
            'dynwinrt-jsx Gallery',
            createGalleryAssetUri('GalleryAppIcon.png'),
          )
        }
      })
      registered.value = true
      notificationEnabled.value =
        setting === AppNotificationSetting.Enabled
      registrationStatus.value =
        `${identity.available ? 'Packaged' : 'App-specific launcher'} registration succeeded. ` +
        `Notifications are ${describeSetting(setting)}.`
      context.model.recordInteraction()
      return setting === AppNotificationSetting.Enabled
    }
    catch (error) {
      registered.value = context.appNotifications.registered
      notificationEnabled.value = false
      registrationStatus.value =
        `App notification registration failed: ${formatNativeError(error)}`
      return false
    }
  }

  const show = (
    description: string,
    createNotification: () => AppNotification,
  ) => {
    if (!registrationPrerequisiteAvailable) {
      operationStatus.value = registrationPrerequisiteDescription
      return
    }
    if (!register()) {
      operationStatus.value =
        'Notification was not submitted because registration failed or Windows notifications are disabled; see registration status.'
      return
    }
    try {
      const notification = createNotification()
      const tag = `gallery-${++notificationSequence}`
      context.appNotifications.show(notification, tag)
      operationStatus.value =
        `${description} was submitted to Windows. ` +
        `The manager setting is ${describeSetting(context.appNotifications.setting!)}.`
      context.model.recordInteraction()
    }
    catch (error) {
      operationStatus.value =
        `Notification submission failed: ${formatNativeError(error)}`
    }
  }

  const probe = async () => {
    if (!registrationPrerequisiteAvailable) {
      operationStatus.value = registrationPrerequisiteDescription
      return
    }
    if (!register()) {
      operationStatus.value =
        'App notification path was not probed because registration failed or Windows notifications are disabled; see registration status.'
      return
    }
    let submitted = false
    currentAbort?.abort()
    const controller = new AbortController()
    currentAbort = controller
    try {
      const notification = new AppNotificationBuilder()
        .addText('dynwinrt-jsx Gallery capability probe')
        .addText('This suppressed notification is removed immediately.')
        .setTag(probeTag)
        .setGroup(context.appNotifications.group)
        .buildNotification()
      notification.suppressDisplay = true
      context.appNotifications.show(notification, probeTag)
      submitted = true
      const notifications = await context.appNotifications.getAllAsync(
        controller.signal,
      )
      const observed = notifications.toArray().some((item) =>
        item.tag === probeTag &&
        item.group === context.appNotifications.group)
      await context.appNotifications.remove(
        probeTag,
        controller.signal,
      )
      if (!disposed) {
        operationStatus.value = observed
          ? 'App notification path verified: Windows accepted, returned, and removed the suppressed probe.'
          : 'Windows accepted and removed the suppressed probe, but it was not returned by GetAllAsync.'
        context.model.recordInteraction()
      }
    }
    catch (error) {
      if (submitted) {
        try {
          await context.appNotifications.remove(probeTag)
        }
        catch {
          // Keep the original probe failure visible.
        }
      }
      if (!disposed) {
        operationStatus.value =
          `App notification path failed: ${formatNativeError(error)}`
      }
    }
    finally {
      if (currentAbort === controller) {
        currentAbort = undefined
      }
    }
  }

  return (
    <Page
      title="App notifications"
      subtitle="Send rich Windows notifications after verifying runtime support, registration, and the user's notification setting."
      automationId="AppNotificationsPageHeading"
      pageId="app-notifications"
      model={context.model}
    >
      <UI.InfoBar
        isOpen
        isClosable={false}
        title="Registration and identity"
        message="Packaged apps use manifest identity. Unpackaged registration is attempted only from an explicit app-specific launcher/AUMID activation path; the normal shared node.exe Gallery reports the prerequisite as unavailable. Application-owned notifications are removed before unregistering during awaited Worker shutdown."
      />
      <SampleCard
        automationId="GalleryShellAppNotificationCapabilitySample"
        title="Capability and registration"
        description="Requires package identity or an explicit app-specific launcher/AUMID activation path, then checks AppNotificationManager support and the effective Windows notification setting."
        code={`if (AppNotificationManager.isSupported()) {
  const manager = AppNotificationManager.default_
  manager.onNotificationInvoked(handleActivation)
  registrationCapability.packaged
    ? manager.register()
    : registrationCapability.appLauncher
      ? manager.register(displayName, fileIconUri)
      : reportPrerequisiteUnavailable()
}`}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryShellAppNotificationRegistrationStatus"
              text={registrationStatus}
              textWrapping={TextWrapping.Wrap}
            />
            <UI.TextBlock
              automationId="GalleryShellAppNotificationActivationStatus"
              text={activationStatus}
              textWrapping={TextWrapping.Wrap}
            />
          </UI.StackPanel>
        }
      >
        <UI.StackPanel orientation={Orientation.Horizontal} spacing={8}>
          <UI.Button
            automationId="GalleryShellAppNotificationRegister"
            onClick={register}
          >
            Check and register
          </UI.Button>
          <UI.Button
            automationId="GalleryShellAppNotificationProbe"
            onClick={() => {
              void probe()
            }}
          >
            Probe real notification path
          </UI.Button>
          <UI.Button
            isEnabled={registered}
            onClick={() => {
              currentAbort?.abort()
              currentAbort = undefined
              void Promise.resolve(
                context.appNotifications.releaseRegistration(),
              ).then(() => {
                registered.value = false
                notificationEnabled.value = false
                registrationStatus.value =
                  'Registration and invocation subscription released.'
              }).catch((error) => {
                registrationStatus.value =
                  `Registration cleanup failed: ${formatNativeError(error)}`
              })
            }}
          >
            Unregister
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GalleryShellAppNotificationBasicSample"
        title="Basic notification"
        description="Build and submit a two-line notification through the real Windows notification manager."
        code={`const notification = new AppNotificationBuilder()
  .addText('Welcome to dynwinrt-jsx Gallery')
  .addText('Explore native WinUI samples.')
  .buildNotification()
manager.show(notification)`}
        output={
          <UI.TextBlock
            automationId="GalleryShellAppNotificationOperationStatus"
            text={operationStatus}
            textWrapping={TextWrapping.Wrap}
          />
        }
      >
        <UI.Button
          isEnabled={notificationEnabled}
          onClick={() => show(
            'Basic notification',
            () => new AppNotificationBuilder()
              .addText('Welcome to dynwinrt-jsx Gallery')
              .addText('Explore native WinUI samples and Windows shell APIs.')
              .buildNotification(),
          )}
        >
          Show basic notification
        </UI.Button>
      </SampleCard>

      <SampleCard
        title="Logo, hero image, controls, and progress"
        description="The remaining original Gallery scenarios use projected builder objects, local file assets, a system sound, input controls, an action button, and a progress bar."
        code={`builder
  .setAppLogoOverride(fileLogoUri, AppNotificationImageCrop.Circle)
  .setHeroImage(fileHeroUri)
  .addComboBox(combo)
  .addTextBox('comment', 'Leave a comment...', '')
  .addButton(button)
  .addProgressBar(progress)`}
      >
        <UI.StackPanel orientation={Orientation.Horizontal} spacing={8}>
          <UI.Button
            isEnabled={notificationEnabled}
            onClick={() => show(
              'Logo notification',
              () => new AppNotificationBuilder()
                .addText('Control highlight: PersonPicture')
                .addText('Display user avatars with initials or images.')
                .setAppLogoOverride(
                  createGalleryAssetUri('ControlImages/PersonPicture.png'),
                  AppNotificationImageCrop.Circle,
                )
                .setAudioEvent(AppNotificationSoundEvent.Default)
                .buildNotification(),
            )}
          >
            Show logo notification
          </UI.Button>
          <UI.Button
            isEnabled={notificationEnabled}
            onClick={() => show(
              'Hero-image notification',
              () => new AppNotificationBuilder()
                .addText('Harbor scene with boats')
                .addText('A quiet harbor with boats gently anchored in view.')
                .setHeroImage(
                  createGalleryAssetUri('SampleMedia/LandscapeImage5.jpg'),
                  'Harbor scene',
                )
                .setAttributionText('WinUI Gallery assets')
                .buildNotification(),
            )}
          >
            Show hero image
          </UI.Button>
          <UI.Button
            isEnabled={notificationEnabled}
            onClick={() => show(
              'Interactive notification',
              () => {
                const combo = new AppNotificationComboBox('satisfaction')
                  .addItem('1', 'Very bad')
                  .addItem('2', 'Bad')
                  .addItem('3', 'Neutral')
                  .addItem('4', 'Good')
                  .addItem('5', 'Excellent')
                  .setSelectedItem('3')
                const button = new AppNotificationButton('Submit')
                  .addArgument('action', 'submit_survey')
                return new AppNotificationBuilder()
                  .addText('Survey')
                  .addText('Select a satisfaction level and leave a comment.')
                  .addComboBox(combo)
                  .addTextBox('comment', 'Leave a comment here...', '')
                  .addButton(button)
                  .buildNotification()
              },
            )}
          >
            Show controls
          </UI.Button>
          <UI.Button
            isEnabled={notificationEnabled}
            onClick={() => show(
              'Progress notification',
              () => {
                const progress = new AppNotificationProgressBar()
                  .setTitle('Demo progress')
                  .setValue(0.6)
                  .setValueStringOverride('60%')
                  .setStatus('In progress...')
                return new AppNotificationBuilder()
                  .addText('Progress bar example')
                  .addText('A real app notification progress payload.')
                  .addProgressBar(progress)
                  .buildNotification()
              },
            )}
          >
            Show progress
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
