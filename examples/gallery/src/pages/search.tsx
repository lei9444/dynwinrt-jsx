import { For, Show, computed } from 'dynwinrt-jsx'
import { type AppContext, UI } from '../gallery-ui'
import { Card, Page, PageLink } from '../components/gallery-components'

export function SearchPage(context: AppContext) {
  return (
    <Page
      title="Search results"
      subtitle={computed(() =>
        `${context.model.searchResults.value.length} results for "${context.model.searchQuery.value}"`,
      )}
      automationId="GallerySearchHeading"
    >
      <Show
        when={computed(
          () => context.model.searchResults.value.length > 0,
        )}
        fallback={
          <Card>
            <UI.TextBlock text="No results match your search." />
          </Card>
        }
      >
        <For
          each={context.model.searchResults}
          key={(page) => page.id}
        >
          {(page) => (
            <PageLink
              page={page}
              model={context.model}
            />
          )}
        </For>
      </Show>
    </Page>
  )
}
