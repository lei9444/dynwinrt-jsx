import { For, Show, computed, signal, styles } from 'dynwinrt-jsx'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function SignalsPage(context: AppContext) {
  const count = signal(0)
  const showDetails = signal(true)
  const rows = signal([
    { id: 1, label: 'First native row' },
    { id: 2, label: 'Second native row' },
  ])
  return (
    <Page
      title="Signals and control flow"
      subtitle="Fine-grained updates target native properties and child ranges."
      automationId="SignalsPageHeading"
      pageId="signals"
      model={context.model}
    >
      <SampleCard
        title="Signal-backed native properties"
        description="Updating the signal changes only the TextBlock text."
        code={`
const count = signal(0)
<UI.TextBlock text={computed(() => \`Count: \${count.value}\`)} />
<UI.Button onClick={() => count.value += 1}>Increment</UI.Button>
        `}
      >
        <UI.StackPanel spacing={12}>
          <UI.TextBlock
            {...styles.heading({ level: 'subtitle' })}
            text={computed(() => `Count: ${count.value}`)}
          />
          <UI.Button
            {...styles.button({ variant: 'accent' })}
            onClick={() => {
              count.value += 1
              context.model.recordInteraction()
            }}
          >
            Increment
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>
      <SampleCard
        title="Show and keyed For"
        description="Branches own their cleanup and keyed rows preserve native identity."
        code={`
<Show when={showDetails} fallback={<UI.TextBlock text="Hidden" />}>
  <For each={rows} key={(row) => row.id}>
    {(row, index) => <UI.TextBlock text={computed(() =>
      \`\${index.value + 1}. \${row.label}\`
    )} />}
  </For>
</Show>
        `}
      >
        <UI.StackPanel spacing={10}>
          <UI.Button
            onClick={() => {
              showDetails.value = !showDetails.value
              context.model.recordInteraction()
            }}
          >
            Toggle rows
          </UI.Button>
          <UI.Button
            onClick={() => {
              rows.value = [...rows.value].reverse()
              context.model.recordInteraction()
            }}
          >
            Reverse rows
          </UI.Button>
          <Show
            when={showDetails}
            fallback={<UI.TextBlock text="Rows hidden" />}
          >
            <For each={rows} key={(row) => row.id}>
              {(row, index) => (
                <UI.TextBlock
                  text={computed(
                    () => `${index.value + 1}. ${row.label}`,
                  )}
                />
              )}
            </For>
          </Show>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
