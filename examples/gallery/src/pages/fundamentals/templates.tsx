import {
  For,
  computed,
  signal,
  thickness,
} from 'dynwinrt-jsx'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

interface TemplateItem {
  readonly id: number
  readonly title: string
  readonly detail: string
}

function ItemTemplate(
  props: TemplateItem & {
    readonly onRef: (value: object | null) => void
  },
) {
  return (
    <UI.Border
      ref={(value) => props.onRef(value)}
      padding={thickness(16)}
    >
      <UI.StackPanel spacing={4}>
        <UI.TextBlock fontSize={20} text={props.title} />
        <UI.TextBlock text={props.detail} />
      </UI.StackPanel>
    </UI.Border>
  )
}

export function TemplatesPage(context: AppContext) {
  let nextId = 4
  const identities = new Map<number, object>()
  const identityStatus = signal('Keyed identities are stable.')
  const items = signal<readonly TemplateItem[]>([
    { id: 1, title: 'Home', detail: 'Overview content' },
    { id: 2, title: 'Files', detail: 'Recent documents' },
    { id: 3, title: 'Settings', detail: 'App preferences' },
  ])

  return (
    <Page
      title="Templates"
      subtitle="Reusable function components define repeatable native visual structure."
      automationId="TemplatesPageHeading"
      pageId="templates"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryTemplatesSample"
        title="A keyed item template"
        description="Function components replace XAML DataTemplate markup while For preserves keyed native identity."
        code={`
<For each={items} key={(item) => item.id}>
  {(item) => <ItemTemplate {...item} />}
</For>
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryTemplatesStatus"
              text={computed(() => `Template items: ${items.value.length}`)}
            />
            <UI.TextBlock
              automationId="GalleryTemplatesIdentity"
              text={identityStatus}
            />
          </UI.StackPanel>
        }
        options={
          <UI.StackPanel spacing={10}>
            <UI.Button
              automationId="GalleryTemplatesAdd"
              onClick={() => {
                const id = nextId
                nextId += 1
                items.value = [
                  ...items.value,
                  {
                    id,
                    title: `Page ${id}`,
                    detail: 'Dynamically templated content',
                  },
                ]
                context.model.recordInteraction()
              }}
            >
              Add item
            </UI.Button>
            <UI.Button
              automationId="GalleryTemplatesReorder"
              onClick={() => {
                const previous = new Map(identities)
                items.value = [...items.value].reverse()
                identityStatus.value =
                  items.peek().every(
                    (item) =>
                      identities.get(item.id) ===
                      previous.get(item.id),
                  )
                    ? 'Keyed identity preserved.'
                    : 'Keyed identity changed.'
                context.model.recordInteraction()
              }}
            >
              Reverse items
            </UI.Button>
          </UI.StackPanel>
        }
      >
        <UI.StackPanel spacing={8}>
          <For each={items} key={(item) => item.id}>
            {(item) => (
              <ItemTemplate
                {...item}
                onRef={(value) => {
                  if (value) {
                    identities.set(item.id, value)
                  }
                  else {
                    identities.delete(item.id)
                  }
                }}
              />
            )}
          </For>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
