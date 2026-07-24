import {
  computed,
  createNavigationItem,
  createSymbolIcon,
  effect,
  resource,
  signal,
  theme,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  AutomationProperties,
  HorizontalAlignment,
  InfoBadge,
  NavigationViewItem,
  NavigationViewPaneDisplayMode,
  NumberBoxSpinButtonPlacementMode,
  Orientation,
  Symbol,
  SymbolIcon,
  SymbolIconSource,
  TextBlock,
  VerticalAlignment,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  LayoutGrid,
  Navigation,
  type NumberBoxInstance,
  type ToggleInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

const displayModes = [
  {
    name: 'LeftExpanded',
    value: NavigationViewPaneDisplayMode.Left,
    paneOpen: true,
  },
  {
    name: 'LeftCompact',
    value: NavigationViewPaneDisplayMode.LeftCompact,
    paneOpen: false,
  },
  {
    name: 'Top',
    value: NavigationViewPaneDisplayMode.Top,
    paneOpen: true,
  },
] as const

const badgeStyleNames = [
  'Attention',
  'Informational',
  'Success',
  'Critical',
] as const

export function InfoBadgePage(context: AppContext) {
  const itemBindings = {
    NavigationViewItem,
    TextBlock,
    AutomationProperties,
  }
  const inboxBadge = new InfoBadge()
  inboxBadge.value = 5
  const homeItem = createNavigationItem(itemBindings, {
    name: 'badge-home',
    label: 'Home',
    icon: createSymbolIcon(SymbolIcon, Symbol.Home),
  })
  const accountItem = createNavigationItem(itemBindings, {
    name: 'badge-account',
    label: 'Account',
    icon: createSymbolIcon(SymbolIcon, Symbol.Contact),
  })
  const inboxItem = createNavigationItem(itemBindings, {
    name: 'badge-inbox',
    label: 'Inbox',
    icon: createSymbolIcon(SymbolIcon, Symbol.Mail),
  })
  inboxItem.infoBadge = inboxBadge

  const badgeVisible = signal(true)
  const displayModeIndex = signal(0)
  const styleIndex = signal(0)
  const dynamicValue = signal(1)
  const opacityToggle: RefObject<ToggleInstance> = {
    current: null,
  }
  const valueInput: RefObject<NumberBoxInstance> = {
    current: null,
  }
  const displayMode = computed(
    () => displayModes[displayModeIndex.value] ?? displayModes[0],
  )
  const styleName = computed(
    () => badgeStyleNames[styleIndex.value] ?? badgeStyleNames[0],
  )
  const iconStyle = computed(() =>
    resource(`${styleName.value}IconInfoBadgeStyle`),
  )
  const valueStyle = computed(() =>
    resource(`${styleName.value}ValueInfoBadgeStyle`),
  )
  const dotStyle = computed(() =>
    resource(`${styleName.value}DotInfoBadgeStyle`),
  )
  const badgeIcon = new SymbolIconSource()
  badgeIcon.symbol = Symbol.Sync
  const alertIcon = new SymbolIconSource()
  alertIcon.symbol = Symbol.Important

  effect(() => {
    inboxBadge.opacity = badgeVisible.value ? 1 : 0
  })

  return (
    <Page
      title="InfoBadge"
      subtitle="A compact count, dot, or icon that highlights status and attention."
      automationId="InfoBadgePageHeading"
      pageId="info-badge"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStatusInfoBadgeNavigationSample"
        title="Embed an InfoBadge in NavigationView"
        description="The badge stays attached to its NavigationViewItem across pane display modes."
        code={`
const badge = new InfoBadge()
badge.value = 5
inboxItem.infoBadge = badge
<Navigation menuItems={[homeItem, accountItem, inboxItem]} />
        `}
        options={
          <UI.StackPanel spacing={12}>
            <UI.ToggleSwitch
              ref={opacityToggle}
              automationId="GalleryInfoBadgeOpacity"
              header="InfoBadge Opacity"
              isOn
              onToggled={() => {
                const next =
                  opacityToggle.current?.isOn ??
                  badgeVisible.value
                if (next !== badgeVisible.value) {
                  badgeVisible.value = next
                  context.model.recordInteraction()
                }
              }}
            />
            <GalleryComboBox
              automationId="GalleryInfoBadgeDisplayMode"
              header={<UI.TextBlock text="Display Mode" />}
              selectedIndex={displayModeIndex}
              onSelectedIndexChange={(index) => {
                if (index !== displayModeIndex.value) {
                  displayModeIndex.value = index
                  context.model.recordInteraction()
                }
              }}
              width={180}
            >
              {displayModes.map((mode) => (
                <UI.TextBlock key={mode.name} text={mode.name} />
              ))}
            </GalleryComboBox>
          </UI.StackPanel>
        }
      >
        <Navigation
          automationId="GalleryInfoBadgeNavigation"
          height={300}
          paneDisplayMode={computed(() => displayMode.value.value)}
          isPaneOpen={computed(() => displayMode.value.paneOpen)}
          isSettingsVisible={false}
          alwaysShowHeader={false}
          menuItems={[homeItem, accountItem, inboxItem]}
        >
          <UI.TextBlock
            margin={{ left: 24, top: 24, right: 24, bottom: 24 }}
            text="Select a navigation item."
          />
        </Navigation>
      </SampleCard>
      <SampleCard
        automationId="GalleryStatusInfoBadgeStylesSample"
        title="Use semantic InfoBadge styles"
        description="Switch icon, value, and dot badges together between attention, informational, success, and critical styles."
        code={`
<UI.InfoBadge
  iconSource={icon}
  style={resource("AttentionIconInfoBadgeStyle")}
/>
<UI.InfoBadge
  value={10}
  style={resource("AttentionValueInfoBadgeStyle")}
/>
        `}
        options={
          <GalleryComboBox
            automationId="GalleryInfoBadgeStyle"
            header={<UI.TextBlock text="Styles" />}
            selectedIndex={styleIndex}
            onSelectedIndexChange={(index) => {
              if (index !== styleIndex.value) {
                styleIndex.value = index
                context.model.recordInteraction()
              }
            }}
            width={180}
          >
            {badgeStyleNames.map((name) => (
              <UI.TextBlock key={name} text={name} />
            ))}
          </GalleryComboBox>
        }
      >
        <UI.StackPanel
          orientation={Orientation.Horizontal}
          spacing={20}
          horizontalAlignment={HorizontalAlignment.Center}
        >
          <UI.InfoBadge
            automationId="GalleryInfoBadgeIcon"
            iconSource={badgeIcon}
            style={iconStyle}
          />
          <UI.InfoBadge
            automationId="GalleryInfoBadgeValue"
            value={10}
            style={valueStyle}
          />
          <UI.InfoBadge
            automationId="GalleryInfoBadgeDot"
            style={dotStyle}
          />
        </UI.StackPanel>
      </SampleCard>
      <SampleCard
        automationId="GalleryStatusInfoBadgeOverlaySample"
        title="Place an InfoBadge inside another control"
        description="Overlay an icon badge in the top-right corner of a button."
        code={`
<UI.Button toolTip="Refresh required">
  <LayoutGrid>
    <UI.SymbolIcon symbol={Symbol.Sync} />
    <UI.InfoBadge
      horizontalAlignment={HorizontalAlignment.Right}
      verticalAlignment={VerticalAlignment.Top}
      iconSource={alertIcon}
    />
  </LayoutGrid>
</UI.Button>
        `}
      >
        <UI.Button
          automationId="GalleryInfoBadgeOverlayButton"
          automationName="Refresh required"
          toolTip="Refresh required"
          width={200}
          height={60}
          padding={thickness(0)}
        >
          <LayoutGrid>
            <UI.SymbolIcon
              horizontalAlignment={HorizontalAlignment.Center}
              symbol={Symbol.Sync}
            />
            <UI.InfoBadge
              horizontalAlignment={HorizontalAlignment.Right}
              verticalAlignment={VerticalAlignment.Top}
              background={theme.ref('SystemFillColorCriticalBrush')}
              iconSource={alertIcon}
            />
          </LayoutGrid>
        </UI.Button>
      </SampleCard>
      <SampleCard
        automationId="GalleryStatusInfoBadgeDynamicSample"
        title="Update or hide an InfoBadge value"
        description="A value of -1 hides the badge; non-negative values display a count."
        code={`
const value = signal(1)
<UI.InfoBadge value={value} />
        `}
        output={
          <UI.TextBlock
            automationId="GalleryInfoBadgeDynamicStatus"
            text={computed(() =>
              dynamicValue.value === -1
                ? 'InfoBadge hidden.'
                : `InfoBadge value: ${dynamicValue.value}`,
            )}
          />
        }
        options={
          <UI.NumberBox
            ref={valueInput}
            automationId="GalleryInfoBadgeValueInput"
            header="InfoBadge Value"
            value={1}
            minimum={-1}
            smallChange={1}
            spinButtonPlacementMode={
              NumberBoxSpinButtonPlacementMode.Inline
            }
            onValueChanged={() => {
              const next = valueInput.current?.value
              if (
                next !== undefined &&
                Number.isFinite(next) &&
                next >= -1
              ) {
                const integer = Math.trunc(next)
                if (integer !== dynamicValue.value) {
                  dynamicValue.value = integer
                  context.model.recordInteraction()
                }
              }
            }}
          />
        }
      >
        <UI.InfoBadge
          automationId="GalleryInfoBadgeDynamic"
          horizontalAlignment={HorizontalAlignment.Center}
          value={dynamicValue}
        />
      </SampleCard>
    </Page>
  )
}
