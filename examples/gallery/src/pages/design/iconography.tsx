import { gridLength, styles, thickness } from 'dynwinrt-jsx'
import { HorizontalAlignment, Symbol } from '#winapp/bindings'
import { type AppContext, LayoutGrid, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function IconographyPage(context: AppContext) {
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
      title="Iconography"
      subtitle="Fluent icons communicate commands and concepts quickly."
      automationId="IconographyPageHeading"
      pageId="iconography"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryIconographySample"
        title="SymbolIcon and FontIcon"
        description="Enum-backed symbols and explicit glyph strings use the native Fluent icon font."
        code={`
<UI.SymbolIcon symbol={Symbol.Home} />
<UI.FontIcon glyph={'\\uE8A5'} />
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
                <UI.SymbolIcon symbol={item.value} />
                <UI.TextBlock
                  horizontalAlignment={HorizontalAlignment.Center}
                  text={item.label}
                />
              </UI.StackPanel>
            </UI.Border>
          ))}
        </LayoutGrid>
      </SampleCard>
      <SampleCard
        automationId="GalleryIconographyFontSample"
        title="FontIcon glyphs"
        description="Explicit Segoe Fluent glyph strings cover icons outside the Symbol enumeration."
        code={`
<UI.FontIcon glyph={'\\uE8A5'} fontSize={32} />
        `}
      >
        <UI.StackPanel spacing={12}>
          <UI.FontIcon glyph={'\uE8A5'} fontSize={32} />
          <UI.TextBlock text="Document glyph" />
          <UI.FontIcon glyph={'\uE713'} fontSize={32} />
          <UI.TextBlock text="Settings glyph" />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
