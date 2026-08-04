import {
  For,
  computed,
  gridLength,
  onCleanup,
  signal,
  styles,
  theme,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  DispatcherQueuePriority,
  HorizontalAlignment,
  FlyoutBase,
  ListView,
  ListViewItem,
  ListViewSelectionMode,
  MenuFlyout,
  MenuFlyoutItem,
  Orientation,
  projectAs,
  releaseProjected,
  TextBox,
  TextTrimming,
  TextWrapping,
  VerticalAlignment,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  GalleryListView,
  LayoutGrid,
  UI,
} from '../../gallery-ui'
import {
  Page,
  SampleCard,
} from '../../components/gallery-components'
import { loadGalleryBitmap } from '../../gallery-assets'

interface Contact {
  readonly id: number
  readonly name: string
  readonly company: string
}

function ContextMenuRow(props: {
  readonly context: AppContext
  readonly message: { readonly id: number; readonly text: string }
  readonly onDelete: () => void
}) {
  const menu = props.context.createProjected(
    () => new MenuFlyout(),
  )
  const deleteItem = props.context.createProjected(
    () => new MenuFlyoutItem(),
  )
  deleteItem.text = 'Delete'
  const menuItems = props.context.ownProjected(menu.items)
  menuItems.append(deleteItem)
  const contextFlyout = props.context.ownProjected(
    projectAs(menu, FlyoutBase),
  )
  onCleanup(deleteItem.onClick(props.onDelete))
  onCleanup(() => menuItems.clear())
  return (
    <UI.ListViewItem contextFlyout={contextFlyout}>
      <UI.TextBlock
        padding={thickness(10)}
        text={props.message.text}
      />
    </UI.ListViewItem>
  )
}

const contacts: readonly Contact[] = [
  { id: 1, name: 'Adele Vance', company: 'Contoso' },
  { id: 2, name: 'Alex Wilber', company: 'Fabrikam' },
  { id: 3, name: 'Diego Siciliani', company: 'Adventure Works' },
  { id: 4, name: 'Grady Archie', company: 'Tailwind Traders' },
  { id: 5, name: 'Henrietta Mueller', company: 'Contoso' },
  { id: 6, name: 'Isaiah Langer', company: 'Northwind' },
  { id: 7, name: 'Johanna Lorenz', company: 'Fabrikam' },
  { id: 8, name: 'Lee Gu', company: 'Adventure Works' },
]

const selectionModes = [
  ['None', ListViewSelectionMode.None],
  ['Single', ListViewSelectionMode.Single],
  ['Multiple', ListViewSelectionMode.Multiple],
  ['Extended', ListViewSelectionMode.Extended],
] as const

export function ListViewPage(context: AppContext) {
  const selectionList:
    RefObject<InstanceType<typeof ListView>> = {
      current: null,
    }
  const messageList:
    RefObject<InstanceType<typeof ListView>> = {
      current: null,
    }
  const firstFilterBox:
    RefObject<InstanceType<typeof TextBox>> = {
      current: null,
    }
  const lastFilterBox:
    RefObject<InstanceType<typeof TextBox>> = {
      current: null,
    }
  const companyFilterBox:
    RefObject<InstanceType<typeof TextBox>> = {
      current: null,
    }
  const selectionModeIndex = signal(1)
  const selectionStatus = signal('Selected items: 0')
  const firstFilter = signal('')
  const lastFilter = signal('')
  const companyFilter = signal('')
  const filteredContacts = computed(() => {
    const first = firstFilter.value.trim().toLowerCase()
    const last = lastFilter.value.trim().toLowerCase()
    const company = companyFilter.value.trim().toLowerCase()
    return contacts.filter((contact) => {
      const [firstName = '', ...lastParts] =
        contact.name.toLowerCase().split(' ')
      return (
        firstName.includes(first) &&
        lastParts.join(' ').includes(last) &&
        contact.company.toLowerCase().includes(company)
      )
    })
  })
  let nextMessageId = 4
  const messages = signal([
    { id: 1, text: 'ListView keeps native item containers.' },
    { id: 2, text: 'Signals update only the changed collection range.' },
    { id: 3, text: 'Add or delete a message below.' },
  ])
  const leftDragItems = signal(['Item 1', 'Item 2', 'Item 3'])
  const rightDragItems = signal(['Item 4', 'Item 5'])
  const cliffImage = loadGalleryBitmap(
    'SampleMedia/cliff.jpg',
    80,
    context.ownProjected,
  )
  const valleyImage = loadGalleryBitmap(
    'SampleMedia/valley.jpg',
    80,
    context.ownProjected,
  )
  const scrollMessagesToEnd = () => {
    context.window.dispatcherQueue.tryEnqueue(
      DispatcherQueuePriority.Low,
      () => {
        const list = messageList.current
        if (!list) {
          return
        }
        const items = list.items
        try {
          if (items.size === 0) {
            return
          }
          const item = projectAs(
            items.getAt(items.size - 1),
            ListViewItem,
          )
          try {
            list.scrollIntoView(item)
          }
          finally {
            releaseProjected(item)
          }
        }
        finally {
          releaseProjected(items)
        }
      },
    )
  }

  return (
    <Page
      title="ListView"
      subtitle="Display vertically scrolling collections with selection, filtering, and live updates."
      automationId="ListViewPageHeading"
      pageId="list-view"
      model={context.model}
    >
      <SampleCard
        title="Basic list"
        description="ListView children map to the native Items collection and can contain primitive or composed item content."
        code={`
<GalleryListView selectionMode={ListViewSelectionMode.None}>
  <UI.ListViewItem>Item 1</UI.ListViewItem>
  <UI.ListViewItem>Item 2</UI.ListViewItem>
</GalleryListView>
        `}
      >
        <GalleryListView
          ref={messageList}
          selectionMode={ListViewSelectionMode.None}
          width={320}
          maxHeight={260}
          horizontalAlignment={HorizontalAlignment.Left}
        >
          {['Item 1', 'Item 2', 'Item 3', 'Item 4'].map(
            (item) => (
              <UI.ListViewItem
                key={item}
                horizontalContentAlignment={
                  HorizontalAlignment.Stretch
                }
              >
                <UI.TextBlock
                  padding={thickness(8)}
                  text={item}
                />
              </UI.ListViewItem>
            ),
          )}
        </GalleryListView>
      </SampleCard>

      <SampleCard
        automationId="GalleryCollectionsListViewDragSample"
        title="Drag and drop reordering"
        description="Each list exposes native drag and reorder states; cross-list transfer requires app-specific data handling."
        code={`
<GalleryListView
  canDragItems
  canReorderItems
  allowDrop
/>
        `}
      >
        <LayoutGrid
          columnDefinitions={[
            gridLength.star(),
            gridLength.star(),
          ]}
          columnSpacing={16}
        >
          {[leftDragItems, rightDragItems].map(
            (items, column) => (
              <GalleryListView
                key={column}
                gridColumn={column}
                height={220}
                selectionMode={ListViewSelectionMode.Single}
                canDragItems
                canReorderItems
                allowDrop
                borderBrush={theme.controlStroke}
                borderThickness={thickness(1)}
              >
                <For each={items} key={(item) => item}>
                  {(item) => (
                    <UI.ListViewItem>
                      <UI.TextBlock
                        padding={thickness(10)}
                        text={item}
                      />
                    </UI.ListViewItem>
                  )}
                </For>
              </GalleryListView>
            ),
          )}
        </LayoutGrid>
      </SampleCard>

      <SampleCard
        automationId="GalleryCollectionsListViewGroupedSample"
        title="Grouped presentation"
        description="Present alphabetic sections with distinct visual headers."
        code={`<GalleryListView>...grouped items...</GalleryListView>`}
      >
        <UI.Border
          height={280}
          borderBrush={theme.controlStroke}
          borderThickness={thickness(1)}
        >
          <UI.ScrollViewer>
            <UI.StackPanel>
              {([
                ['A', 'Adele Vance', 'Alex Wilber'],
                ['D', 'Diego Siciliani'],
                ['G', 'Grady Archie'],
                ['H', 'Henrietta Mueller'],
              ] as const).map(([header, ...names]) => (
                <UI.StackPanel key={header}>
                  <UI.Border
                    padding={thickness(12, 8)}
                    background={theme.layerFill}
                  >
                    <UI.TextBlock
                      {...styles.heading({
                        level: 'bodyStrong',
                      })}
                      text={header}
                    />
                  </UI.Border>
                  {names.map((name) => (
                    <UI.TextBlock
                      key={name}
                      padding={thickness(16, 10)}
                      text={name}
                    />
                  ))}
                </UI.StackPanel>
              ))}
            </UI.StackPanel>
          </UI.ScrollViewer>
        </UI.Border>
      </SampleCard>

      <SampleCard
        automationId="GalleryCollectionsListViewSelectionSample"
        title="Selection modes"
        description="Choose a native selection mode and observe SelectedItems as the user changes the selection."
        code={`
<GalleryListView
  selectionMode={selectionMode}
  ref={selectionList}
  onSelectionChanged={() => {
    selectedCount.value = selectionList.current?.selectedItems.size ?? 0
  }}
>
  <For each={contacts} key={(contact) => contact.id}>
    {(contact) => <ContactRow contact={contact} />}
  </For>
</GalleryListView>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryCollectionsListViewSelectionStatus"
            text={selectionStatus}
          />
        }
        options={
          <GalleryComboBox
            header={<UI.TextBlock text="SelectionMode" />}
            selectedIndex={selectionModeIndex}
            onSelectedIndexChange={(index) => {
              selectionModeIndex.value = index
            }}
            minWidth={180}
          >
            {selectionModes.map(([name]) => (
              <UI.TextBlock key={name} text={name} />
            ))}
          </GalleryComboBox>
        }
      >
        <GalleryListView
          ref={selectionList}
          automationId="GalleryCollectionsListViewControl"
          maxHeight={340}
          selectionMode={computed(
            () =>
              selectionModes[selectionModeIndex.value]?.[1] ??
              ListViewSelectionMode.Single,
          )}
          onSelectionChanged={() => {
            selectionStatus.value =
              `Selected items: ${selectionList.current?.selectedItems.size ?? 0}`
            context.model.recordInteraction()
          }}
        >
          <For each={contacts} key={(contact) => contact.id}>
            {(contact) => (
              <UI.ListViewItem
                automationName={contact.name}
                horizontalContentAlignment={
                  HorizontalAlignment.Stretch
                }
              >
                <UI.StackPanel
                  padding={thickness(10, 8)}
                  spacing={2}
                >
                  <UI.TextBlock
                    {...styles.heading({
                      level: 'bodyStrong',
                    })}
                    text={contact.name}
                  />
                  <UI.TextBlock
                    foreground={theme.secondaryText}
                    text={contact.company}
                  />
                </UI.StackPanel>
              </UI.ListViewItem>
            )}
          </For>
        </GalleryListView>
      </SampleCard>

      <SampleCard
        automationId="GalleryCollectionsListViewFilterSample"
        title="Filtering"
        description="Filter by first name, last name, and company."
        code={`
const filtered = computed(() =>
  contacts.filter((contact) => contact.name.includes(filter.value)))
<GalleryListView>
  <For each={filtered} key={(contact) => contact.id}>
    {(contact) => <ContactRow contact={contact} />}
  </For>
</GalleryListView>
        `}
        output={
          <UI.TextBlock
            text={computed(
              () => `${filteredContacts.value.length} contacts`,
            )}
          />
        }
      >
        <UI.StackPanel spacing={10}>
          <UI.TextBlock
            {...styles.heading({ level: 'bodyStrong' })}
            text="Filter by..."
          />
          <UI.StackPanel
            orientation={Orientation.Horizontal}
            spacing={8}
          >
            {[
              {
                header: 'First name',
                ref: firstFilterBox,
                value: firstFilter,
                id: 'GalleryCollectionsListViewFilter',
              },
              {
                header: 'Last name',
                ref: lastFilterBox,
                value: lastFilter,
                id: 'GalleryCollectionsListViewLastFilter',
              },
              {
                header: 'Company',
                ref: companyFilterBox,
                value: companyFilter,
                id: 'GalleryCollectionsListViewCompanyFilter',
              },
            ].map((entry) => (
              <UI.TextBox
                key={entry.header}
                ref={entry.ref}
                automationId={entry.id}
                header={entry.header}
                minWidth={180}
                onTextChanged={() => {
                  const text = entry.ref.current?.text
                  if (text !== undefined) {
                    entry.value.value = text
                    context.model.recordInteraction()
                  }
                }}
              />
            ))}
          </UI.StackPanel>
          <GalleryListView
            selectionMode={ListViewSelectionMode.Single}
            maxHeight={320}
          >
            <For
              each={filteredContacts}
              key={(contact) => contact.id}
            >
              {(contact) => (
                <UI.ListViewItem
                  horizontalContentAlignment={
                    HorizontalAlignment.Stretch
                  }
                >
                  <LayoutGrid
                    padding={thickness(10, 8)}
                    columnDefinitions={[
                      gridLength.star(),
                      gridLength.auto(),
                    ]}
                  >
                    <UI.TextBlock text={contact.name} />
                    <UI.TextBlock
                      gridColumn={1}
                      foreground={theme.secondaryText}
                      text={contact.company}
                    />
                  </LayoutGrid>
                </UI.ListViewItem>
              )}
            </For>
          </GalleryListView>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GalleryCollectionsListViewMessagesSample"
        title="Messaging data logging"
        description="An inverted message list keeps the newest activity visible at the bottom."
        code={`
const messages = signal(initialMessages)
<GalleryListView>
  <For each={messages} key={(message) => message.id}>
    {(message) => <MessageRow message={message} />}
  </For>
</GalleryListView>
        `}
      >
        <UI.StackPanel spacing={10}>
          <GalleryListView
            selectionMode={ListViewSelectionMode.None}
            maxHeight={280}
            verticalContentAlignment={VerticalAlignment.Bottom}
          >
            <For each={messages} key={(message) => message.id}>
              {(message) => (
                <UI.ListViewItem
                  horizontalContentAlignment={
                    HorizontalAlignment.Stretch
                  }
                >
                  <LayoutGrid
                    padding={thickness(8)}
                    columnDefinitions={[gridLength.star()]}
                  >
                    <UI.TextBlock
                      text={message.text}
                      textWrapping={TextWrapping.Wrap}
                      verticalAlignment={VerticalAlignment.Center}
                    />
                  </LayoutGrid>
                </UI.ListViewItem>
              )}
            </For>
          </GalleryListView>
          <UI.StackPanel
            orientation={Orientation.Horizontal}
            spacing={8}
          >
            <UI.Button
              automationId="GalleryCollectionsListViewAddMessage"
              onClick={() => {
                messages.value = [
                  ...messages.value,
                  {
                    id: nextMessageId,
                    text: `Sent message ${nextMessageId}`,
                  },
                ]
                nextMessageId += 1
                scrollMessagesToEnd()
                context.model.recordInteraction()
              }}
            >
              Send Message
            </UI.Button>
            <UI.Button
              onClick={() => {
                messages.value = [
                  ...messages.value,
                  {
                    id: nextMessageId,
                    text: `Received message ${nextMessageId}`,
                  },
                ]
                nextMessageId += 1
                scrollMessagesToEnd()
                context.model.recordInteraction()
              }}
            >
              Receive Message
            </UI.Button>
          </UI.StackPanel>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GalleryCollectionsListViewImagesSample"
        title="Images"
        description="ListView items can combine images with trimmed text."
        code={`<UI.Image source={image} />`}
      >
        <GalleryListView
          width={360}
          height={220}
          horizontalAlignment={HorizontalAlignment.Left}
          selectionMode={ListViewSelectionMode.None}
        >
          {[
            {
              label: 'Mountain landscape',
              image: cliffImage,
            },
            {
              label: 'Valley landscape',
              image: valleyImage,
            },
          ].map(({ label, image }) => (
            <UI.ListViewItem key={label}>
              <UI.StackPanel
                orientation={Orientation.Horizontal}
                spacing={12}
                padding={thickness(8)}
              >
                <UI.Image
                  width={80}
                  height={60}
                  source={image}
                />
                <UI.TextBlock
                  maxWidth={220}
                  width={220}
                  verticalAlignment={VerticalAlignment.Center}
                  text={`${label} with a longer description that trims in a compact row`}
                  textTrimming={TextTrimming.CharacterEllipsis}
                  textWrapping={TextWrapping.NoWrap}
                  toolTip={`${label} with a longer description that trims in a compact row`}
                />
              </UI.StackPanel>
            </UI.ListViewItem>
          ))}
        </GalleryListView>
      </SampleCard>

      <SampleCard
        automationId="GalleryCollectionsListViewContextSample"
        title="Context menus"
        description="A contextual delete action removes the selected row."
        code={`<UI.MenuFlyoutItem text="Delete" />`}
      >
        <GalleryListView
          width={360}
          horizontalAlignment={HorizontalAlignment.Left}
          selectionMode={ListViewSelectionMode.None}
        >
          <For each={messages} key={(message) => message.id}>
            {(message) => (
              <ContextMenuRow
                context={context}
                message={message}
                onDelete={() => {
                  messages.value = messages.value.filter(
                    (item) => item.id !== message.id,
                  )
                }}
              />
            )}
          </For>
        </GalleryListView>
      </SampleCard>
    </Page>
  )
}
