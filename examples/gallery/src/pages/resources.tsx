import {
  signal,
  styles,
  theme,
  thickness,
  tokens,
} from 'dynwinrt-jsx'
import { type AppContext, UI } from '../gallery-ui'
import { Page, SampleCard } from '../components/gallery-components'

export function ResourcesPage(context: AppContext) {
  const status = signal('Theme resources are resolved natively.')
  return (
    <Page
      title="Resources"
      subtitle="Reusable native values keep colors, spacing, and surfaces consistent."
      automationId="ResourcesPageHeading"
      pageId="resources"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryResourcesSample"
        title="Theme resources and design tokens"
        description="Theme references and tokens resolve to ordinary native WinUI property values."
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
            automationId="GalleryResourcesAccent"
            {...styles.button({ variant: 'accent' })}
            onClick={() => {
              status.value = 'Accent resource button invoked.'
              context.model.recordInteraction()
            }}
          >
            Accent recipe
          </UI.Button>
          <UI.TextBlock
            automationId="GalleryResourcesStatus"
            text={status}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
