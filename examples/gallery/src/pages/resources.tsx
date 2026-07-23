import { styles, theme, thickness, tokens } from 'dynwinrt-jsx'
import { type AppContext, UI } from '../gallery-ui'
import { Page, SampleCard } from '../components/gallery-components'

export function ResourcesPage(context: AppContext) {
  return (
    <Page
      title="Resources and styling"
      subtitle="Native theme resources combine with typed tokens and recipes."
      automationId="ResourcesPageHeading"
      pageId="resources"
      model={context.model}
    >
      <SampleCard
        title="Typed style recipes"
        description="Recipes produce ordinary native JSX props and can accept signals."
        code={`
<UI.Border {...styles.card({ surface: 'layer' })}>
  <UI.TextBlock {...styles.heading({ level: 'subtitle' })} />
</UI.Border>
        `}
      >
        <UI.StackPanel spacing={12}>
          <UI.Border
            {...styles.card({ surface: 'card' })}
            padding={thickness(tokens.spacing.lg)}
          >
            <UI.TextBlock
              {...styles.heading({ level: 'subtitle' })}
              text="Default surface"
            />
          </UI.Border>
          <UI.Border
            {...styles.card({ surface: 'layer' })}
            padding={thickness(tokens.spacing.lg)}
          >
            <UI.TextBlock
              foreground={theme.secondaryText}
              text="Layer surface using a native theme resource"
            />
          </UI.Border>
          <UI.Button
            {...styles.button({ variant: 'accent' })}
          >
            Accent recipe
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
