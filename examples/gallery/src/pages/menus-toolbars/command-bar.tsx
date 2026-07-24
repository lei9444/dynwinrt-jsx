import {
  computed,
  createSymbolIcon,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  CommandBarDefaultLabelPosition,
  Symbol,
  SymbolIcon,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryCommandBar,
  type ToggleInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function CommandBarPage(context: AppContext) {
  const open = signal(false)
  const sticky = signal(false)
  const extraSecondary = signal(true)
  const openToggle: RefObject<ToggleInstance> = { current: null }
  const stickyToggle: RefObject<ToggleInstance> = { current: null }
  const extraToggle: RefObject<ToggleInstance> = { current: null }
  const status = signal('Choose a command.')
  const secondaryCommands = computed(() => [
    <UI.AppBarButton
      key="settings"
      label="Settings"
      icon={createSymbolIcon(SymbolIcon, Symbol.Setting)}
    />,
    ...(extraSecondary.value
      ? [
          <UI.AppBarSeparator key="separator" />,
          <UI.AppBarButton
            key="about"
            label="About"
            icon={createSymbolIcon(SymbolIcon, Symbol.Help)}
          />,
        ]
      : []),
  ])

  return (
    <Page
      title="CommandBar"
      subtitle="Primary commands with an owned secondary overflow collection."
      automationId="CommandBarPageHeading"
      pageId="command-bar"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryMenusCommandBarSample"
        title="Primary and secondary commands"
        description="Toggle open and sticky behavior and add or remove secondary commands."
        code={`
<GalleryCommandBar
  isOpen={open}
  isSticky={sticky}
  defaultLabelPosition={CommandBarDefaultLabelPosition.Right}
  secondaryCommands={secondaryCommands}
>
  <UI.AppBarButton label="Add" />
  <UI.AppBarButton label="Edit" />
</GalleryCommandBar>
        `}
        output={<UI.TextBlock text={status} />}
        options={
          <UI.StackPanel spacing={8}>
            <UI.ToggleSwitch
              ref={openToggle}
              automationId="GalleryCommandBarOpen"
              header="IsOpen"
              onToggled={() => {
                const next = openToggle.current?.isOn ?? open.value
                if (next !== open.value) {
                  open.value = next
                  context.model.recordInteraction()
                }
              }}
            />
            <UI.ToggleSwitch
              ref={stickyToggle}
              automationId="GalleryCommandBarSticky"
              header="IsSticky"
              onToggled={() => {
                const next =
                  stickyToggle.current?.isOn ?? sticky.value
                if (next !== sticky.value) {
                  sticky.value = next
                  context.model.recordInteraction()
                }
              }}
            />
            <UI.ToggleSwitch
              ref={extraToggle}
              automationId="GalleryCommandBarExtra"
              header="Include extra secondary command"
              isOn
              onToggled={() => {
                const next =
                  extraToggle.current?.isOn ??
                  extraSecondary.value
                if (next !== extraSecondary.value) {
                  extraSecondary.value = next
                  context.model.recordInteraction()
                }
              }}
            />
          </UI.StackPanel>
        }
      >
        <UI.StackPanel spacing={12}>
          <GalleryCommandBar
            automationId="GalleryCommandBarControl"
            isOpen={open}
            isSticky={sticky}
            defaultLabelPosition={CommandBarDefaultLabelPosition.Right}
            secondaryCommands={secondaryCommands}
            onOpened={() => {
              open.value = true
            }}
            onClosed={() => {
              open.value = false
            }}
          >
            <UI.AppBarButton
              automationId="GalleryCommandBarAdd"
              label="Add"
              icon={createSymbolIcon(SymbolIcon, Symbol.Add)}
            />
            <UI.AppBarButton
              label="Edit"
              icon={createSymbolIcon(SymbolIcon, Symbol.Edit)}
            />
          </GalleryCommandBar>
          <UI.Button
            automationId="GalleryCommandBarRun"
            onClick={() => {
              status.value = 'CommandBar action simulated.'
              context.model.recordInteraction()
            }}
          >
            Run selected command
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
