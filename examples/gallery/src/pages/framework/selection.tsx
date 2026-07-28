import { For, computed, signal } from 'dynwinrt-jsx'
import { HorizontalAlignment } from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  GalleryListView,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function SelectionPage(context: AppContext) {
  const options = [
    { id: 1, label: 'Low' },
    { id: 2, label: 'Normal' },
    { id: 3, label: 'High' },
  ]
  const comboIndex = signal(1)
  const listIndex = signal(0)
  return (
    <Page
      title="Selection controls"
      subtitle="Controlled adapters suppress programmatic echoes and keep the model authoritative."
      automationId="SelectionPageHeading"
      pageId="selection"
      model={context.model}
    >
      <SampleCard
        title="Controlled ComboBox"
        description="Items and header mount before the selected index is applied."
        code={`
const selectedIndex = signal(1)
<Priority
  selectedIndex={selectedIndex}
  onSelectedIndexChange={(index) => selectedIndex.value = index}
  header={<UI.TextBlock text="Priority" />}
>
  <UI.TextBlock text="Low" />
  <UI.TextBlock text="Normal" />
  <UI.TextBlock text="High" />
</Priority>
        `}
      >
        <UI.StackPanel spacing={10}>
          <GalleryComboBox
            selectedIndex={comboIndex}
            onSelectedIndexChange={(index) => {
              comboIndex.value = index
              context.model.recordInteraction()
            }}
            header={<UI.TextBlock text="Priority" />}
            width={320}
          >
            {options.map((option) => (
              <UI.TextBlock
                key={option.id}
                text={option.label}
              />
            ))}
          </GalleryComboBox>
          <UI.TextBlock
            text={computed(() =>
              `Selected: ${options[comboIndex.value]?.label ?? 'None'}`,
            )}
          />
        </UI.StackPanel>
      </SampleCard>
      <SampleCard
        automationId="GalleryControlledListViewSample"
        title="Controlled ListView"
        description="Deferred dependency-property echoes are suppressed while genuine native selection updates the model."
        code={`
<GalleryListView
  selectedIndex={listIndex}
  onSelectedIndexChange={(index) => listIndex.value = index}
>
  <For each={options} key={(item) => item.id}>
    {(item) => <UI.ListViewItem>{item.label}</UI.ListViewItem>}
  </For>
</GalleryListView>
        `}
      >
        <UI.StackPanel spacing={10}>
          <GalleryListView
            selectedIndex={listIndex}
            onSelectedIndexChange={(index) => {
              listIndex.value = index
              if (index >= 0) {
                context.model.recordInteraction()
              }
            }}
            header={<UI.TextBlock text="Choose a level" />}
            maxHeight={240}
          >
            <For each={options} key={(option) => option.id}>
              {(option) => (
                <UI.ListViewItem
                  horizontalContentAlignment={
                    HorizontalAlignment.Stretch
                  }
                >
                  <UI.TextBlock text={option.label} />
                </UI.ListViewItem>
              )}
            </For>
          </GalleryListView>
          <UI.TextBlock
            automationId="GalleryListSelectionStatus"
            text={computed(() =>
              `Selected: ${options[listIndex.value]?.label ?? 'None'}`,
            )}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
