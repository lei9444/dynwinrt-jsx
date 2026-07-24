import {
  computed,
  onCleanup,
  signal,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  AutomationProperties,
  IObservableVector_Object,
  Symbol,
  SymbolIconSource,
  TabView,
  TabViewCloseButtonOverlayMode,
  TabViewItem,
  TabViewWidthMode,
  TextBlock,
  TextWrapping,
  type Symbol as SymbolValue,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  GalleryTabView,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

interface WorkspaceTab {
  readonly id: number
  readonly title: string
  readonly description: string
  readonly symbol: SymbolValue
  readonly item: TabViewItem
}

const widthModes = [
  { name: 'Equal', value: TabViewWidthMode.Equal },
  {
    name: 'Size to content',
    value: TabViewWidthMode.SizeToContent,
  },
  { name: 'Compact', value: TabViewWidthMode.Compact },
] as const

const closeModes = [
  {
    name: 'Auto',
    value: TabViewCloseButtonOverlayMode.Auto,
  },
  {
    name: 'On pointer over',
    value: TabViewCloseButtonOverlayMode.OnPointerOver,
  },
  {
    name: 'Always',
    value: TabViewCloseButtonOverlayMode.Always,
  },
] as const

function iconSource(symbol: SymbolValue): SymbolIconSource {
  const source = new SymbolIconSource()
  source.symbol = symbol
  return source
}

export function TabViewPage(context: AppContext) {
  let nextId = 3
  const tabView: RefObject<TabView> = { current: null }
  const closeSubscriptions = new Map<number, () => void>()
  let tabSource:
    ReturnType<typeof IObservableVector_Object.create>
  const createTab = (
    id: number,
    title: string,
    description: string,
    symbol: SymbolValue,
  ): WorkspaceTab => {
    const item = new TabViewItem()
    const header = new TextBlock()
    const content = new TextBlock()
    header.text = title
    content.text = description
    content.fontSize = 26
    content.margin = thickness(28)
    content.textWrapping = TextWrapping.Wrap
    item.header = header
    item.content = content
    item.iconSource = iconSource(symbol)
    item.isClosable = id !== 0
    AutomationProperties.setAutomationId(
      item,
      `GalleryTabViewTab${id}`,
    )
    if (item.isClosable) {
      closeSubscriptions.set(
        id,
        item.onCloseRequested(() => {
          removeTab(id)
        }),
      )
    }
    return {
      id,
      title,
      description,
      symbol,
      item,
    }
  }
  const initialTabs = [
    createTab(
      0,
      'Home',
      'Welcome to the workspace.',
      Symbol.Home,
    ),
    createTab(
      1,
      'Document 1',
      'Notes for the first document.',
      Symbol.Document,
    ),
    createTab(
      2,
      'Document 2',
      'Notes for the second document.',
      Symbol.Document,
    ),
  ] as const
  const tabs = signal<readonly WorkspaceTab[]>(initialTabs)
  tabSource = IObservableVector_Object.create(
    initialTabs.map((tab) => tab.item),
  )
  const widthModeIndex = signal(0)
  const closeModeIndex = signal(0)
  const selectedTitle = signal('Home')
  const status = signal('Ready.')
  const nativeTabCount = signal(3)
  const addTab = () => {
    const id = nextId
    nextId += 1
    const tab = createTab(
      id,
      `Document ${id}`,
      `Notes for document ${id}.`,
      Symbol.Document,
    )
    tabSource.append(tab.item)
    const nextTabs = [...tabs.value, tab]
    tabs.value = nextTabs
    status.value = `${tab.title} added.`
    context.model.recordInteraction()
  }
  function removeTab(id: number) {
    const current = tabs.peek()
    const index = current.findIndex((tab) => tab.id === id)
    const tab = current[index]
    if (!tab || current.length === 1 || index < 0) {
      return
    }
    closeSubscriptions.get(id)?.()
    closeSubscriptions.delete(id)
    tabSource.removeAt(index)
    tabs.value = current.filter((item) => item.id !== id)
    status.value = `${tab.title} closed.`
    context.model.recordInteraction()
  }
  onCleanup(() => {
    for (const unsubscribe of closeSubscriptions.values()) {
      unsubscribe()
    }
    closeSubscriptions.clear()
    tabSource.clear()
  })

  return (
    <Page
      title="TabView"
      subtitle="Displays document tabs that users can add, select, and close."
      automationId="TabViewPageHeading"
      pageId="tab-view"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryTabViewSample"
        title="Add and close document tabs"
        description="An observable native items source updates document tabs while close handlers release their subscriptions."
        code={`
const tabSource = IObservableVector_Object.create(initialTabs)

<GalleryTabView
  tabItemsSource={tabSource}
  selectedIndex={0}
  onAddTabButtonClick={addTab}
  tabStripHeaderContent={<UI.TextBlock text="Workspace" />}
/>
        `}
        output={
          <UI.StackPanel spacing={6}>
            <UI.TextBlock
              automationId="GalleryTabViewSelectionStatus"
              text={computed(
                () => `Selected: ${selectedTitle.value}`,
              )}
            />
            <UI.TextBlock
              automationId="GalleryTabViewStatus"
              text={status}
            />
          </UI.StackPanel>
        }
        options={
          <UI.StackPanel spacing={10}>
            <GalleryComboBox
              automationId="GalleryTabViewWidthMode"
              header={<UI.TextBlock text="TabWidthMode" />}
              selectedIndex={widthModeIndex}
              onSelectedIndexChange={(index) => {
                widthModeIndex.value = index
                context.model.recordInteraction()
              }}
              width={180}
            >
              {widthModes.map((mode) => (
                <UI.TextBlock key={mode.name} text={mode.name} />
              ))}
            </GalleryComboBox>
            <GalleryComboBox
              automationId="GalleryTabViewCloseMode"
              header={<UI.TextBlock text="Close button mode" />}
              selectedIndex={closeModeIndex}
              onSelectedIndexChange={(index) => {
                closeModeIndex.value = index
                context.model.recordInteraction()
              }}
              width={180}
            >
              {closeModes.map((mode) => (
                <UI.TextBlock key={mode.name} text={mode.name} />
              ))}
            </GalleryComboBox>
          </UI.StackPanel>
        }
      >
        <GalleryTabView
          ref={tabView}
          automationId="GalleryTabViewControl"
          minHeight={340}
          tabItemsSource={tabSource}
          selectedIndex={0}
          tabWidthMode={computed(
            () =>
              widthModes[widthModeIndex.value]?.value ??
              TabViewWidthMode.SizeToContent,
          )}
          closeButtonOverlayMode={computed(
            () =>
              closeModes[closeModeIndex.value]?.value ??
              TabViewCloseButtonOverlayMode.Auto,
          )}
          onAddTabButtonClick={addTab}
          onTabItemsChanged={(sender) => {
            nativeTabCount.value = sender.tabItems.size
          }}
          onSelectionChanged={() => {
            const selectedIndex = tabView.current?.selectedIndex
            const tab =
              selectedIndex === undefined
                ? undefined
                : tabs.peek()[selectedIndex]
            if (tab) {
              selectedTitle.value = tab.title
              context.model.recordInteraction()
            }
          }}
          tabStripHeaderContent={
            <UI.TextBlock
              margin={thickness(8, 0)}
              text="Workspace"
            />
          }
          tabStripFooterContent={
            <UI.TextBlock
              margin={thickness(8, 0)}
              text={computed(
                () => `Native tab count: ${nativeTabCount.value}`,
              )}
            />
          }
        />
      </SampleCard>
    </Page>
  )
}
