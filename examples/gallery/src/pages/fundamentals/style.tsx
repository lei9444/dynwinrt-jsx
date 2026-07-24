import {
  computed,
  signal,
  styles,
  thickness,
} from 'dynwinrt-jsx'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function StylePage(context: AppContext) {
  const selected = signal('Standard')

  return (
    <Page
      title="Style"
      subtitle="Reusable property recipes keep native controls visually consistent."
      automationId="StylePageHeading"
      pageId="style"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStyleSample"
        title="Reusable card and button recipes"
        description="Style recipes return typed native JSX properties rather than CSS declarations."
        code={`
<UI.Border {...styles.card({ surface: 'layer' })}>
  <UI.Button {...styles.button({ variant: 'accent' })} />
</UI.Border>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryStyleStatus"
            text={computed(() => `Selected style: ${selected.value}`)}
          />
        }
      >
        <UI.Border
          {...styles.card({ surface: 'layer' })}
          padding={thickness(20)}
        >
          <UI.StackPanel spacing={12}>
            <UI.Button
              automationId="GalleryStyleStandard"
              {...styles.button({ variant: 'standard' })}
              onClick={() => {
                selected.value = 'Standard'
                context.model.recordInteraction()
              }}
            >
              Standard
            </UI.Button>
            <UI.Button
              automationId="GalleryStyleAccent"
              {...styles.button({ variant: 'accent' })}
              onClick={() => {
                selected.value = 'Accent'
                context.model.recordInteraction()
              }}
            >
              Accent
            </UI.Button>
          </UI.StackPanel>
        </UI.Border>
      </SampleCard>
    </Page>
  )
}
