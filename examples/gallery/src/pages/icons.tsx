import { gridLength, styles, thickness } from 'dynwinrt-jsx'
import { HorizontalAlignment, Symbol } from '#winapp/bindings'
import { type AppContext, LayoutGrid, UI } from '../gallery-ui'
import { Page, SampleCard } from '../components/gallery-components'

export function IconsPage(context: AppContext) {
  const symbols = [
    { label: 'Home', value: Symbol.Home },
    { label: 'Find', value: Symbol.Find },
    { label: 'Favorite', value: Symbol.Favorite },
    { label: 'Setting', value: Symbol.Setting },
    { label: 'Accept', value: Symbol.Accept },
    { label: 'Repair', value: Symbol.Repair },
  ]
  const rows = Array.from(
    { length: Math.ceil(symbols.length / 3) },
    () => gridLength.auto(),
  )

  return (
    <Page
      title="Icons and glyphs"
      subtitle="Use enum-backed SymbolIcon values or explicit FontIcon glyph strings."
      automationId="IconsPageHeading"
      pageId="icons"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryIconsSample"
        title="SymbolIcon"
        description="Symbol enum values provide readable access to the built-in Fluent icon set."
        code={`
<UI.SymbolIcon symbol={Symbol.Home} />
<UI.SymbolIcon symbol={Symbol.Find} />
<UI.SymbolIcon symbol={Symbol.Setting} />
        `}
      >
        <LayoutGrid
          rowDefinitions={rows}
          columnDefinitions={[
            gridLength.star(),
            gridLength.star(),
            gridLength.star(),
          ]}
          rowSpacing={12}
          columnSpacing={12}
        >
          {symbols.map((item, index) => (
            <UI.Border
              key={item.label}
              {...styles.card({ surface: 'layer' })}
              gridRow={Math.floor(index / 3)}
              gridColumn={index % 3}
              padding={thickness(16)}
            >
              <UI.StackPanel spacing={8}>
                <UI.SymbolIcon
                  symbol={item.value}
                />
                <UI.TextBlock
                  horizontalAlignment={
                    HorizontalAlignment.Center
                  }
                  text={item.label}
                />
              </UI.StackPanel>
            </UI.Border>
          ))}
        </LayoutGrid>
      </SampleCard>
      <SampleCard
        title="FontIcon"
        description="Explicit glyph strings support icons that are not represented by the Symbol enum."
        code={`
<UI.FontIcon glyph={'\\uE8D4'} fontSize={32} />
<UI.FontIcon glyph={'\\uE8A5'} fontSize={32} />
        `}
      >
        <LayoutGrid
          columnDefinitions={[
            gridLength.star(),
            gridLength.star(),
            gridLength.star(),
          ]}
          columnSpacing={12}
        >
          <UI.FontIcon glyph={'\uE8D4'} fontSize={32} />
          <UI.FontIcon
            gridColumn={1}
            glyph={'\uE8A5'}
            fontSize={32}
          />
          <UI.FontIcon
            gridColumn={2}
            glyph={'\uE713'}
            fontSize={32}
          />
        </LayoutGrid>
      </SampleCard>
    </Page>
  )
}
