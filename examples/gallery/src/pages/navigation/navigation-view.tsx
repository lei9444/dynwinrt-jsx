import {
  computed,
  createNavigationItem,
  createSymbolIcon,
  signal,
  thickness,
} from 'dynwinrt-jsx'
import {
  AutomationProperties,
  NavigationViewItem,
  NavigationViewPaneDisplayMode,
  Symbol,
  SymbolIcon,
  TextBlock,
  TextWrapping,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  Navigation,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

const paneModes = [
  { name: 'Auto', value: NavigationViewPaneDisplayMode.Auto },
  { name: 'Left', value: NavigationViewPaneDisplayMode.Left },
  { name: 'Top', value: NavigationViewPaneDisplayMode.Top },
  {
    name: 'Left compact',
    value: NavigationViewPaneDisplayMode.LeftCompact,
  },
] as const

export function NavigationViewPage(context: AppContext) {
  const selectedName = signal('Home')
  const paneModeIndex = signal(1)
  const itemBindings = {
    NavigationViewItem,
    TextBlock,
    AutomationProperties,
  }
  const menuItems = [
    createNavigationItem(itemBindings, {
      name: 'sample-home',
      label: 'Home',
      icon: createSymbolIcon(SymbolIcon, Symbol.Home),
      automationId: 'GalleryNavigationViewHome',
    }),
    createNavigationItem(itemBindings, {
      name: 'sample-library',
      label: 'Library',
      icon: createSymbolIcon(SymbolIcon, Symbol.Library),
      automationId: 'GalleryNavigationViewLibrary',
    }),
    createNavigationItem(itemBindings, {
      name: 'sample-favorites',
      label: 'Favorites',
      icon: createSymbolIcon(SymbolIcon, Symbol.Favorite),
      automationId: 'GalleryNavigationViewFavorites',
    }),
  ]
  const namesByItem = new Map<NavigationViewItem, string>([
    [menuItems[0]!, 'Home'],
    [menuItems[1]!, 'Library'],
    [menuItems[2]!, 'Favorites'],
  ])
  const namesByRoute = new Map([
    ['sample-home', 'Home'],
    ['sample-library', 'Library'],
    ['sample-favorites', 'Favorites'],
  ])
  const selectedItem = computed(
    () =>
      menuItems.find(
        (item) => namesByItem.get(item) === selectedName.value,
      ) ?? menuItems[0]!,
  )

  return (
    <Page
      title="NavigationView"
      subtitle="Provides a collapsible pane for navigating top-level app areas."
      automationId="NavigationViewPageHeading"
      pageId="navigation-view"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryNavigationViewSample"
        title="Left and top navigation modes"
        description="Switch the pane orientation while selection keeps the content area synchronized."
        code={`
<Navigation
  paneDisplayMode={paneDisplayMode}
  menuItems={menuItems}
  selectedItem={selectedItem}
  onSelectionChanged={(sender) => select(sender.selectedItem)}
>
  <PageContent />
</Navigation>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryNavigationViewStatus"
            text={computed(() => `Selected: ${selectedName.value}`)}
          />
        }
        options={
          <GalleryComboBox
            automationId="GalleryNavigationViewPaneMode"
            header={<UI.TextBlock text="PaneDisplayMode" />}
            selectedIndex={paneModeIndex}
            onSelectedIndexChange={(index) => {
              paneModeIndex.value = index
              context.model.recordInteraction()
            }}
            width={180}
          >
            {paneModes.map((mode) => (
              <UI.TextBlock key={mode.name} text={mode.name} />
            ))}
          </GalleryComboBox>
        }
      >
        <Navigation
          automationId="GalleryNavigationViewControl"
          height={360}
          paneTitle="Navigation"
          paneDisplayMode={computed(
            () =>
              paneModes[paneModeIndex.value]?.value ??
              NavigationViewPaneDisplayMode.Auto,
          )}
          openPaneLength={220}
          isPaneOpen
          isSettingsVisible={false}
          alwaysShowHeader
          header="Sample content"
          menuItems={menuItems}
          selectedItem={selectedItem}
          onSelectionChanged={(_sender, args) => {
            const name = namesByRoute.get(
              args.selectedItemContainer.name,
            )
            if (name && name !== selectedName.value) {
              selectedName.value = name
              context.model.recordInteraction()
            }
          }}
        >
          <UI.Border padding={thickness(28)}>
            <UI.StackPanel spacing={10}>
              <UI.TextBlock
                fontSize={28}
                text={selectedName}
              />
              <UI.TextBlock
                text="The NavigationView owns its pane collections and its content slot independently."
                textWrapping={TextWrapping.Wrap}
              />
            </UI.StackPanel>
          </UI.Border>
        </Navigation>
      </SampleCard>
    </Page>
  )
}
