import {
  computed,
  gridLength,
  signal,
  thickness,
} from 'dynwinrt-jsx'
import { Symbol } from '#winapp/bindings'
import { type AppContext, LayoutGrid, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function IconElementPage(context: AppContext) {
  const loaded = signal(0)
  return (
    <Page
      title="IconElement"
      subtitle="Represents native icon controls backed by symbols and glyphs."
      automationId="IconElementPageHeading"
      pageId="icon-element"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStylesIconElementSample"
        title="SymbolIcon and FontIcon"
        description="IconElement-derived controls can be placed directly or used as control icon properties."
        code={`
<UI.SymbolIcon symbol={Symbol.Home} />
<UI.FontIcon glyph={'\\uE8A5'} />
        `}
        output={
          <UI.TextBlock
            automationId="GalleryStylesIconElementStatus"
            text={computed(
              () => `Native icon elements loaded: ${loaded.value}`,
            )}
          />
        }
      >
        <LayoutGrid
          columnDefinitions={[
            gridLength.star(),
            gridLength.star(),
          ]}
          columnSpacing={18}
        >
          <UI.Border padding={thickness(24)}>
            <UI.StackPanel spacing={8}>
              <UI.SymbolIcon
                symbol={Symbol.Home}
                onLoaded={() => {
                  loaded.value += 1
                }}
              />
              <UI.TextBlock text="SymbolIcon" />
            </UI.StackPanel>
          </UI.Border>
          <UI.Border gridColumn={1} padding={thickness(24)}>
            <UI.StackPanel spacing={8}>
              <UI.FontIcon
                glyph={'\uE8A5'}
                fontSize={32}
                onLoaded={() => {
                  loaded.value += 1
                }}
              />
              <UI.TextBlock text="FontIcon" />
            </UI.StackPanel>
          </UI.Border>
        </LayoutGrid>
      </SampleCard>
    </Page>
  )
}
