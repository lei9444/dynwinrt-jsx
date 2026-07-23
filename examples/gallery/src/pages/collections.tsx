import { computed, signal, styles, thickness } from 'dynwinrt-jsx'
import { ScrollBarVisibility, StackLayout, TextWrapping } from '#winapp/bindings'
import { type AppContext, GalleryItemsRepeater, UI } from '../gallery-ui'
import { Page, SampleCard } from '../components/gallery-components'

export function CollectionsPage(context: AppContext) {
  const rows = signal(
    Array.from({ length: 500 }, (_, id) => ({
      id,
      title: `Virtual row ${id + 1}`,
      detail:
        id % 3 === 0
          ? 'This row is taller to demonstrate dynamic measurement.'
          : 'Recycled native row.',
    })),
  )
  const layout = new StackLayout()
  layout.spacing = 8
  return (
    <Page
      title="Collections and virtualization"
      subtitle="ItemsRepeater owns native realization while JSX owns keyed row state."
      automationId="CollectionsPageHeading"
      pageId="collections"
      model={context.model}
    >
      <SampleCard
        title="Native ItemsRepeater"
        description="Only rows near the viewport are realized; source mutations use one observable vector."
        code={`
<UI.ScrollViewer height={360}>
  <GalleryItemsRepeater each={rows} key={(row) => row.id} layout={layout}>
    {(row, index) => <Row row={row} index={index} />}
  </GalleryItemsRepeater>
</UI.ScrollViewer>
        `}
      >
        <UI.StackPanel spacing={12}>
          <UI.Button
            onClick={() => {
              rows.value = [...rows.value].reverse()
              context.model.recordInteraction()
            }}
          >
            Reverse 500 rows
          </UI.Button>
          <UI.ScrollViewer
            height={360}
            verticalScrollBarVisibility={
              ScrollBarVisibility.Auto
            }
          >
            <GalleryItemsRepeater
              each={rows}
              key={(row) => row.id}
              layout={layout}
              verticalCacheLength={0.5}
            >
              {(row, index) => (
                <UI.Border
                  {...styles.card({ surface: 'card' })}
                  padding={thickness(10)}
                >
                  <UI.StackPanel spacing={4}>
                    <UI.TextBlock
                      {...styles.heading({
                        level: 'bodyStrong',
                      })}
                      text={computed(
                        () =>
                          `${index.value + 1}. ${row.title}`,
                      )}
                    />
                    <UI.TextBlock
                      text={row.detail}
                      textWrapping={TextWrapping.Wrap}
                    />
                  </UI.StackPanel>
                </UI.Border>
              )}
            </GalleryItemsRepeater>
          </UI.ScrollViewer>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
