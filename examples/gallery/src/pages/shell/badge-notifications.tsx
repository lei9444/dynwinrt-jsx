import {
  computed,
  onCleanup,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  BadgeNotificationGlyph,
  BadgeNotificationManager,
  NumberBox,
  NumberBoxSpinButtonPlacementMode,
  Orientation,
  TextWrapping,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import {
  detectPackageIdentity,
  formatNativeError,
} from './shared'

const unpackagedPrerequisite =
  'Badge notifications unavailable: taskbar badges require package identity, and this Gallery is running unpackaged.'

export function BadgeNotificationsPage(context: AppContext) {
  const identity = detectPackageIdentity()
  const countBox: RefObject<NumberBox> = { current: null }
  const managerAvailable = signal(false)
  const status = signal(
    identity.available
      ? 'Package identity detected. BadgeNotificationManager has not been acquired.'
      : unpackagedPrerequisite,
  )
  let manager: BadgeNotificationManager | undefined
  let badgeOwned = false

  const checkCapability = (): boolean => {
    if (!identity.available) {
      status.value =
        unpackagedPrerequisite
      return false
    }
    try {
      manager = BadgeNotificationManager.current
      managerAvailable.value = true
      status.value =
        'Package identity and BadgeNotificationManager are available.'
      context.model.recordInteraction()
      return true
    }
    catch (error) {
      managerAvailable.value = false
      status.value =
        `BadgeNotificationManager is unavailable: ${formatNativeError(error)}`
      return false
    }
  }

  const clearBadge = (cleanup = false) => {
    if (!manager && !checkCapability()) {
      return false
    }
    try {
      manager!.clearBadge()
      badgeOwned = false
      if (!cleanup) {
        status.value = 'The taskbar badge was cleared.'
        context.model.recordInteraction()
      }
      return true
    }
    catch (error) {
      if (!cleanup) {
        status.value =
          `Clearing the taskbar badge failed: ${formatNativeError(error)}`
      }
      return false
    }
  }

  onCleanup(() => {
    if (
      badgeOwned &&
      !clearBadge(true) &&
      !clearBadge(true)
    ) {
      throw new Error(
        'The Shell badge owned by this page could not be cleared after two attempts.',
      )
    }
  })

  const setCount = () => {
    if (!manager && !checkCapability()) {
      return
    }
    const value = Math.max(
      0,
      Math.min(99, Math.round(countBox.current?.value ?? 1)),
    )
    try {
      manager!.setBadgeAsCount(value)
      badgeOwned = true
      status.value = `Taskbar badge count set to ${value}.`
      context.model.recordInteraction()
    }
    catch (error) {
      status.value =
        `Setting the taskbar badge count failed: ${formatNativeError(error)}`
    }
  }

  const setGlyph = (
    glyph: BadgeNotificationGlyph,
    name: string,
  ) => {
    if (!manager && !checkCapability()) {
      return
    }
    try {
      manager!.setBadgeAsGlyph(glyph)
      badgeOwned = true
      status.value = `Taskbar badge glyph set to ${name}.`
      context.model.recordInteraction()
    }
    catch (error) {
      status.value =
        `Setting the taskbar badge glyph failed: ${formatNativeError(error)}`
    }
  }

  const probe = () => {
    if (!manager && !checkCapability()) {
      status.value = unpackagedPrerequisite
      return
    }
    try {
      manager!.setBadgeAsCount(1)
      badgeOwned = true
      manager!.clearBadge()
      badgeOwned = false
      status.value =
        'Badge path verified: a temporary count was set and cleared through BadgeNotificationManager.'
      context.model.recordInteraction()
    }
    catch (error) {
      status.value =
        `Badge path failed: ${formatNativeError(error)}`
    }
  }

  return (
    <Page
      title="Badge notifications"
      subtitle="Show numeric or glyph badges on the app taskbar icon when package identity and BadgeNotificationManager are available."
      automationId="BadgeNotificationsPageHeading"
      pageId="badge-notifications"
      model={context.model}
    >
      <UI.InfoBar
        isOpen
        isClosable={false}
        title="Packaged-only shell feature"
        message="BadgeNotificationManager has no IsSupported method. The page first requires package identity, then acquires the real manager. The unpackaged Gallery does not call badge mutation APIs."
      />
      <SampleCard
        automationId="GalleryShellBadgeCapabilitySample"
        title="Capability"
        description="Detect package identity and acquire BadgeNotificationManager.Current without claiming support from UI state alone."
        code={`if (hasPackageIdentity()) {
  const manager = BadgeNotificationManager.current
}`}
        output={
          <UI.TextBlock
            automationId="GalleryShellBadgeStatus"
            text={status}
            textWrapping={TextWrapping.Wrap}
          />
        }
      >
        <UI.StackPanel orientation={Orientation.Horizontal} spacing={8}>
          <UI.Button
            automationId="GalleryShellBadgeCheck"
            onClick={checkCapability}
          >
            Check badge capability
          </UI.Button>
          <UI.Button
            automationId="GalleryShellBadgeProbe"
            onClick={probe}
          >
            Probe real badge path
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        title="Badge count"
        description="Set a numeric taskbar badge from 0 through 99. A badge set by this page is cleared when the page unmounts."
        code={`BadgeNotificationManager.current.setBadgeAsCount(count)`}
      >
        <UI.StackPanel orientation={Orientation.Horizontal} spacing={8}>
          <UI.NumberBox
            ref={countBox}
            value={1}
            minimum={0}
            maximum={99}
            smallChange={1}
            spinButtonPlacementMode={
              NumberBoxSpinButtonPlacementMode.Compact
            }
          />
          <UI.Button
            isEnabled={computed(() => managerAvailable.value)}
            onClick={setCount}
          >
            Set count
          </UI.Button>
          <UI.Button
            isEnabled={managerAvailable}
            onClick={() => clearBadge()}
          >
            Clear badge
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        title="Badge glyph"
        description="Set representative activity, attention, message, and error glyphs from BadgeNotificationGlyph."
        code={`manager.setBadgeAsGlyph(BadgeNotificationGlyph.NewMessage)`}
      >
        <UI.StackPanel orientation={Orientation.Horizontal} spacing={8}>
          <UI.Button
            isEnabled={managerAvailable}
            onClick={() => setGlyph(
              BadgeNotificationGlyph.Activity,
              'Activity',
            )}
          >
            Activity
          </UI.Button>
          <UI.Button
            isEnabled={managerAvailable}
            onClick={() => setGlyph(
              BadgeNotificationGlyph.Attention,
              'Attention',
            )}
          >
            Attention
          </UI.Button>
          <UI.Button
            isEnabled={managerAvailable}
            onClick={() => setGlyph(
              BadgeNotificationGlyph.NewMessage,
              'NewMessage',
            )}
          >
            New message
          </UI.Button>
          <UI.Button
            isEnabled={managerAvailable}
            onClick={() => setGlyph(
              BadgeNotificationGlyph.Error,
              'Error',
            )}
          >
            Error
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
