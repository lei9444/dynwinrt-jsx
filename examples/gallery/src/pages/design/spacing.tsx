import {
  cornerRadius,
  signal,
  theme,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  HorizontalAlignment,
  Orientation,
  TextWrapping,
} from '#winapp/bindings'
import {
  type AppContext,
  type BorderInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import { GuidanceText } from '../fundamentals/shared'
import {
  DesignTableHeader,
  DesignTableRow,
  DesignTableScroller,
  DesignThemeImage,
} from './shared'

const spacingRows = [
  [4, 'Spacing used for compact sizing.'],
  [8, 'Spacing between UI controls, or between a control and label.'],
  [12, 'Spacing between a control and header, surface and edge text, or text sections.'],
  [16, 'Padding used in list styles and cards.'],
  [24, 'Spacing between content sections.'],
  [36, 'Padding on pages.'],
  [48, 'Spacing between page sections with a title.'],
] as const

const tableWidths = [86, 136, 520] as const

export function SpacingPage(context: AppContext) {
  const sample24: RefObject<BorderInstance> = { current: null }
  const nativeWidth = signal('Native 24epx sample width: not measured')

  return (
    <Page
      title="Spacing"
      subtitle="Thoughtful spacing design enhances readability and flow."
      automationId="SpacingPageHeading"
      pageId="spacing"
      model={context.model}
    >
      <GuidanceText text="Consistently sized spacing and gutters group an experience into separate components. These values align with rounded-corner logic and help create a cohesive, usable layout." />
      <GuidanceText text="Use a 4px grid: spacing and sizing should normally be multiples of 4 so layouts stay consistent and scale predictably." />

      <UI.ScrollView>
        <UI.StackPanel
          orientation={Orientation.Horizontal}
          spacing={36}
        >
          <UI.StackPanel spacing={12}>
            <UI.TextBlock
              horizontalAlignment={HorizontalAlignment.Center}
              text="Page with cards layout"
            />
            <DesignThemeImage
              lightPath="Design/Cards.light.png"
              darkPath="Design/Cards.dark.png"
              isDark={context.model.darkTheme}
              automationName="Example of spacing in a page with cards layout"
            />
          </UI.StackPanel>
          <UI.StackPanel spacing={12}>
            <UI.TextBlock
              horizontalAlignment={HorizontalAlignment.Center}
              text="Form layout"
            />
            <DesignThemeImage
              lightPath="Design/Dialog.light.png"
              darkPath="Design/Dialog.dark.png"
              isDark={context.model.darkTheme}
              automationName="Example of spacing in a form layout"
            />
          </UI.StackPanel>
        </UI.StackPanel>
      </UI.ScrollView>

      <SampleCard
        automationId="GalleryDesignSpacingSample"
        title="Windows spacing scale"
        description="Each visual bar uses the actual native width shown in effective pixels (epx)."
        code={`
<UI.Border width={24} />
<UI.Border padding={thickness(16)} />
        `}
        output={
          <UI.TextBlock
            automationId="GalleryDesignSpacingNativeStatus"
            text={nativeWidth}
          />
        }
      >
        <DesignTableScroller minWidth={790}>
          <DesignTableHeader
            columns={['Value', 'Visual', 'Usage']}
            widths={tableWidths}
          />
          {spacingRows.map(([value, usage], index) => (
            <DesignTableRow
              key={value}
              alternate={index % 2 === 1}
              automationId={`GalleryDesignSpacingRow${value}`}
              widths={tableWidths}
              columns={[
                <UI.TextBlock text={`${value}epx`} />,
                <UI.Border
                  {...(value === 24 ? { ref: sample24 } : {})}
                  width={value}
                  height={20}
                  background={theme.accent}
                  cornerRadius={cornerRadius(4)}
                  onLoaded={() => {
                    if (value === 24) {
                      nativeWidth.value =
                        `Native 24epx sample width: ${Math.round(sample24.current?.actualWidth ?? -1)}`
                    }
                  }}
                />,
                <UI.TextBlock
                  text={usage}
                  textWrapping={TextWrapping.Wrap}
                />,
              ]}
            />
          ))}
        </DesignTableScroller>
      </SampleCard>
    </Page>
  )
}
