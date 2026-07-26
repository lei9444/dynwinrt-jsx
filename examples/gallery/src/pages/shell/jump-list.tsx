import {
  computed,
  onCleanup,
  signal,
} from 'dynwinrt-jsx'
import {
  JumpList,
  JumpListItem,
  JumpListSystemGroupKind,
  Orientation,
  TextWrapping,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import {
  detectPackageIdentity,
  formatNativeError,
} from './shared'

type JumpListAbortSignal = NonNullable<
  Parameters<typeof JumpList.loadCurrentAsync>[0]
>

declare const AbortController: {
  new(): {
    readonly signal: JumpListAbortSignal
    abort(): void
  }
}

const unpackagedPrerequisite =
  'JumpList unavailable: Windows.UI.StartScreen.JumpList requires package identity, and this Gallery is running unpackaged.'
const probeArguments = '--gallery-route=jump-list'

export function JumpListPage(context: AppContext) {
  const identity = detectPackageIdentity()
  const supported = signal(false)
  const busy = signal(false)
  const status = signal(
    identity.available
      ? 'Package identity detected. JumpList.IsSupported has not been checked.'
      : unpackagedPrerequisite,
  )
  let currentAbort:
    | {
      readonly signal: JumpListAbortSignal
      abort(): void
    }
    | undefined
  let disposed = false

  onCleanup(() => {
    disposed = true
    currentAbort?.abort()
    currentAbort = undefined
  })

  const checkCapability = (): boolean => {
    if (!identity.available) {
      supported.value = false
      status.value = unpackagedPrerequisite
      return false
    }
    try {
      supported.value = JumpList.isSupported()
      status.value = supported.value
        ? 'Package identity is present and JumpList.IsSupported returned true.'
        : 'Package identity is present, but JumpList.IsSupported returned false on this system.'
      context.model.recordInteraction()
      return supported.value
    }
    catch (error) {
      supported.value = false
      status.value =
        `JumpList support check failed: ${formatNativeError(error)}`
      return false
    }
  }

  const run = async (
    action: (
      jumpList: JumpList,
      signal: JumpListAbortSignal,
    ) => Promise<string>,
  ) => {
    if (busy.value) {
      return
    }
    if (!supported.value && !checkCapability()) {
      return
    }
    busy.value = true
    currentAbort?.abort()
    const controller = new AbortController()
    currentAbort = controller
    try {
      const jumpList = await JumpList.loadCurrentAsync(
        controller.signal,
      )
      const message = await action(jumpList, controller.signal)
      if (!disposed) {
        status.value = message
        context.model.recordInteraction()
      }
    }
    catch (error) {
      if (!disposed) {
        status.value =
          `JumpList operation failed: ${formatNativeError(error)}`
      }
    }
    finally {
      if (currentAbort === controller) {
        currentAbort = undefined
      }
      if (!disposed) {
        busy.value = false
      }
    }
  }

  const addTasks = () => run(async (jumpList, abortSignal) => {
    const notifications = JumpListItem.createWithArguments(
      '--gallery-route=app-notifications',
      'App notifications',
    )
    notifications.description = 'Open the App notifications Gallery page'
    const search = JumpListItem.createWithArguments(
      '--gallery-search=taskbar%20shell',
      'Search taskbar samples',
    )
    search.description = 'Search the Gallery for taskbar and shell samples'
    jumpList.items.append(notifications)
    jumpList.items.append(search)
    await jumpList.saveAsync(abortSignal)
    return 'Two handled Gallery JumpList tasks were saved.'
  })

  const addCustomGroup = () => run(async (jumpList, abortSignal) => {
    const alpha = JumpListItem.createWithArguments(
      '--gallery-route=badge-notifications',
      'Badge notifications',
    )
    alpha.groupName = 'Shell samples'
    alpha.description = 'Open the Badge notifications Gallery page'
    const beta = JumpListItem.createWithArguments(
      '--gallery-route=jump-list',
      'JumpList',
    )
    beta.groupName = 'Shell samples'
    beta.description = 'Open the JumpList Gallery page'
    jumpList.items.append(alpha)
    jumpList.items.append(beta)
    await jumpList.saveAsync(abortSignal)
    return 'The Shell samples custom JumpList group was saved.'
  })

  const clear = () => run(async (jumpList, abortSignal) => {
    jumpList.items.clear()
    jumpList.systemGroupKind = JumpListSystemGroupKind.None
    await jumpList.saveAsync(abortSignal)
    return 'All application JumpList items were cleared.'
  })

  const probe = () => run(async (jumpList, abortSignal) => {
    const item = JumpListItem.createWithArguments(
      probeArguments,
      'dynwinrt-jsx capability probe',
    )
    item.description = 'Temporary JumpList capability probe'
    jumpList.items.append(item)
    try {
      await jumpList.saveAsync(abortSignal)
      const index = jumpList.items.indexOf(item)
      if (index < 0) {
        throw new Error(
          'The temporary JumpList task was not present after SaveAsync.',
        )
      }
      jumpList.items.removeAt(index)
      await jumpList.saveAsync(abortSignal)
      return 'JumpList path verified: a temporary task was saved and removed.'
    }
    catch (error) {
      try {
        const index = jumpList.items.indexOf(item)
        if (index >= 0) {
          jumpList.items.removeAt(index)
        }
        await jumpList.saveAsync()
      }
      catch {
        // Keep the original probe failure visible.
      }
      throw error
    }
  })

  return (
    <Page
      title="JumpList"
      subtitle="Add custom tasks and groups to the app's taskbar JumpList when package identity and platform support are present."
      automationId="JumpListPageHeading"
      pageId="jump-list"
      model={context.model}
    >
      <UI.InfoBar
        isOpen
        isClosable={false}
        title="Package identity required"
        message="The unpackaged Gallery reports JumpList as unavailable and does not call LoadCurrentAsync or SaveAsync. Packaged tasks use handled --gallery-route or --gallery-search startup arguments, and the selected route intent persists in Gallery state."
      />
      <SampleCard
        automationId="GalleryShellJumpListCapabilitySample"
        title="Capability"
        description="Require package identity, call JumpList.IsSupported, and use a temporary save/remove probe only when both prerequisites are true."
        code={`if (hasPackageIdentity() && JumpList.isSupported()) {
  const jumpList = await JumpList.loadCurrentAsync(signal)
}`}
        output={
          <UI.TextBlock
            automationId="GalleryShellJumpListStatus"
            text={status}
            textWrapping={TextWrapping.Wrap}
          />
        }
      >
        <UI.StackPanel orientation={Orientation.Horizontal} spacing={8}>
          <UI.Button
            automationId="GalleryShellJumpListCheck"
            onClick={checkCapability}
          >
            Check JumpList capability
          </UI.Button>
          <UI.Button
            automationId="GalleryShellJumpListProbe"
            isEnabled={computed(() => !busy.value)}
            onClick={() => {
              void probe()
            }}
          >
            Probe real JumpList path
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        title="Tasks"
        description="Add handled App notifications and taskbar-search launch tasks, or clear all application-owned JumpList items."
        code={`const item = JumpListItem.createWithArguments(
  '--gallery-route=app-notifications',
  'App notifications',
)
jumpList.items.append(item)
await jumpList.saveAsync(signal)`}
      >
        <UI.StackPanel orientation={Orientation.Horizontal} spacing={8}>
          <UI.Button
            isEnabled={computed(() => supported.value && !busy.value)}
            onClick={() => {
              void addTasks()
            }}
          >
            Add tasks
          </UI.Button>
          <UI.Button
            isEnabled={computed(() => supported.value && !busy.value)}
            onClick={() => {
              void clear()
            }}
          >
            Clear tasks
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        title="Custom group"
        description="Add handled Badge notifications and JumpList page tasks under a custom Shell samples group."
        code={`item.groupName = 'Shell samples'
jumpList.items.append(item)
await jumpList.saveAsync(signal)`}
      >
        <UI.Button
          isEnabled={computed(() => supported.value && !busy.value)}
          onClick={() => {
            void addCustomGroup()
          }}
        >
          Add custom group
        </UI.Button>
      </SampleCard>
    </Page>
  )
}
