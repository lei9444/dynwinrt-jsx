import {
  For,
  computed,
  gridLength,
  signal,
  styles,
  theme,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  HorizontalAlignment,
  ListView,
  ListViewSelectionMode,
  TextBox,
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

interface Contact {
  readonly id: number
  readonly name: string
  readonly company: string
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
  const filterBox:
    RefObject<InstanceType<typeof TextBox>> = {
      current: null,
    }
  const messageBox:
    RefObject<InstanceType<typeof TextBox>> = {
      current: null,
    }
  const selectionModeIndex = signal(1)
  const selectionStatus = signal('Selected items: 0')
  const filter = signal('')
  const filteredContacts = computed(() => {
    const query = filter.value.trim().toLowerCase()
    if (!query) {
      return contacts
    }
    return contacts.filter((contact) =>
      `${contact.name} ${contact.company}`
        .toLowerCase()
        .includes(query),
    )
  })
  let nextMessageId = 4
  const messages = signal([
    { id: 1, text: 'ListView keeps native item containers.' },
    { id: 2, text: 'Signals update only the changed collection range.' },
    { id: 3, text: 'Add or delete a message below.' },
  ])
  const messageText = signal('')

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
        title="Filter a collection"
        description="Text input derives a filtered signal and keyed For updates the native list without recreating unchanged rows."
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
          <UI.TextBox
            ref={filterBox}
            automationId="GalleryCollectionsListViewFilter"
            header="Filter contacts"
            placeholderText="Name or company"
            text={filter}
            onTextChanged={() => {
              const text = filterBox.current?.text
              if (text !== undefined) {
                filter.value = text
                context.model.recordInteraction()
              }
            }}
          />
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
        title="Live list updates"
        description="Appending and deleting messages updates the keyed native collection while each row retains its own identity."
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
                    columnDefinitions={[
                      gridLength.star(),
                      gridLength.auto(),
                    ]}
                    columnSpacing={8}
                  >
                    <UI.TextBlock
                      text={message.text}
                      textWrapping={TextWrapping.Wrap}
                      verticalAlignment={VerticalAlignment.Center}
                    />
                    <UI.Button
                      gridColumn={1}
                      automationName={`Delete ${message.text}`}
                      onClick={() => {
                        messages.value = messages.value.filter(
                          (item) => item.id !== message.id,
                        )
                        context.model.recordInteraction()
                      }}
                    >
                      Delete
                    </UI.Button>
                  </LayoutGrid>
                </UI.ListViewItem>
              )}
            </For>
          </GalleryListView>
          <LayoutGrid
            columnDefinitions={[
              gridLength.star(),
              gridLength.auto(),
            ]}
            columnSpacing={8}
          >
            <UI.TextBox
              ref={messageBox}
              automationId="GalleryCollectionsListViewMessageText"
              placeholderText="Type a message"
              text={messageText}
              onTextChanged={() => {
                const text = messageBox.current?.text
                if (text !== undefined) {
                  messageText.value = text
                }
              }}
            />
            <UI.Button
              gridColumn={1}
              automationId="GalleryCollectionsListViewAddMessage"
              onClick={() => {
                const text = messageText.value.trim()
                if (!text) {
                  return
                }
                messages.value = [
                  ...messages.value,
                  { id: nextMessageId, text },
                ]
                nextMessageId += 1
                messageText.value = ''
                context.model.recordInteraction()
              }}
            >
              Send
            </UI.Button>
          </LayoutGrid>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
