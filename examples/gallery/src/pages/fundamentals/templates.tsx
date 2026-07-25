import {
  Show,
  computed,
  cornerRadius,
  signal,
  styles,
  theme,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  HorizontalAlignment,
  Orientation,
  Symbol,
  TextWrapping,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  type TextBoxInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import {
  BulletList,
  GuidanceSection,
  GuidanceText,
} from './shared'

const options = ['Option 1', 'Option 2', 'Option 3'] as const
const layoutItems = Array.from(
  { length: 20 },
  (_, index) => `Item ${String(index + 1).padStart(2, '0')}`,
)

function CustomTextBox(props: {
  readonly input: RefObject<TextBoxInstance>
}) {
  return (
    <UI.StackPanel spacing={8}>
      <UI.TextBlock text="Enter text here" />
      <UI.Border
        minWidth={200}
        background={theme.cardBackground}
        borderBrush={theme.accent}
        borderThickness={thickness(2)}
        cornerRadius={cornerRadius(4)}
      >
        <UI.StackPanel
          margin={thickness(4)}
          orientation={Orientation.Horizontal}
          spacing={4}
        >
          <UI.SymbolIcon symbol={Symbol.Edit} />
          <UI.TextBox
            ref={props.input}
            automationId="GalleryTemplatesCustomTextBox"
            padding={thickness(8)}
            minWidth={240}
            placeholderText="Type here"
          />
        </UI.StackPanel>
      </UI.Border>
    </UI.StackPanel>
  )
}

function ComboOption(props: {
  readonly text: string
}) {
  return (
    <UI.StackPanel
      orientation={Orientation.Horizontal}
      spacing={8}
    >
      <UI.Ellipse
        width={8}
        height={8}
        fill={theme.accent}
      />
      <UI.TextBlock text={props.text} />
    </UI.StackPanel>
  )
}

function LayoutItem(props: {
  readonly text: string
}) {
  return (
    <UI.Border
      {...styles.card({ surface: 'layer' })}
      width={96}
      height={44}
      margin={thickness(4)}
    >
      <UI.TextBlock
        text={props.text}
        horizontalAlignment={HorizontalAlignment.Center}
      />
    </UI.Border>
  )
}

export function TemplatesPage(context: AppContext) {
  const customTextInput: RefObject<TextBoxInstance> = {
    current: null,
  }
  const selectedOption = signal(0)
  const wrapLayout = signal(true)

  return (
    <Page
      title="Templates"
      subtitle="Customize controls' visuals, item layouts, and data presentation."
      automationId="TemplatesPageHeading"
      pageId="templates"
      model={context.model}
    >
      <GuidanceSection>
        <GuidanceText text="Templates can be defined at application, page, or control scope. Their placement depends on how broadly the visual structure should be reused." />
        <BulletList
          items={[
            'ControlTemplate customizes the visual structure of one control.',
            'DataTemplate changes how individual data items are displayed.',
            'ItemsPanelTemplate defines how a collection of items is arranged.',
          ]}
        />
        <GuidanceText text="dynwinrt-jsx expresses these structures as typed components and child composition, keeping the native controls and behavior explicit in TSX." />
      </GuidanceSection>

      <SampleCard
        automationId="GalleryTemplatesSample"
        title="Customize a TextBox visual structure"
        description="A reusable TSX component composes the header, border, edit icon, and native TextBox while retaining normal text input behavior."
        code={`
function CustomTextBox() {
  return (
    <UI.StackPanel>
      <UI.TextBlock text="Enter text here" />
      <UI.Border>
        <UI.StackPanel orientation={Orientation.Horizontal}>
          <UI.SymbolIcon symbol={Symbol.Edit} />
          <UI.TextBox />
        </UI.StackPanel>
      </UI.Border>
    </UI.StackPanel>
  )
}
        `}
      >
        <CustomTextBox input={customTextInput} />
      </SampleCard>

      <SampleCard
        automationId="GalleryTemplatesDataTemplateSample"
        title="Customize ComboBox items with a data template component"
        description="Each data value is mapped to the same dot-and-label component before being added to the native ComboBox items collection."
        code={`
function ComboOption({ text }) {
  return (
    <UI.StackPanel orientation={Orientation.Horizontal}>
      <UI.Ellipse fill={theme.accent} />
      <UI.TextBlock text={text} />
    </UI.StackPanel>
  )
}

<GalleryComboBox>
  {options.map((text) => <ComboOption text={text} />)}
</GalleryComboBox>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryTemplatesSelectedOption"
            text={computed(
              () => `Selected: ${options[selectedOption.value] ?? options[0]}`,
            )}
          />
        }
      >
        <GalleryComboBox
          automationId="GalleryTemplatesComboBox"
          header="Options"
          selectedIndex={selectedOption}
          onSelectedIndexChange={(index) => {
            selectedOption.value = index
            context.model.recordInteraction()
          }}
        >
          {options.map((text) => (
            <ComboOption key={text} text={text} />
          ))}
        </GalleryComboBox>
      </SampleCard>

      <SampleCard
        automationId="GalleryTemplatesItemsPanelSample"
        title="Switch the collection items panel"
        description="The same 20 item components are arranged by either a wrapping panel or a vertical StackPanel."
        code={`
<Show when={wrapLayout} fallback={
  <UI.StackPanel>{items.map(renderItem)}</UI.StackPanel>
}>
  <UI.VariableSizedWrapGrid>{items.map(renderItem)}</UI.VariableSizedWrapGrid>
</Show>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryTemplatesLayoutStatus"
            text={computed(() =>
              wrapLayout.value
                ? 'Items panel: WrapGrid'
                : 'Items panel: StackPanel',
            )}
          />
        }
        options={
          <UI.StackPanel spacing={8}>
            <UI.RadioButton
              automationId="GalleryTemplatesWrapGrid"
              groupName="templates-items-panel"
              isChecked={wrapLayout}
              onChecked={() => {
                if (!wrapLayout.value) {
                  wrapLayout.value = true
                  context.model.recordInteraction()
                }
              }}
            >
              WrapGrid
            </UI.RadioButton>
            <UI.RadioButton
              automationId="GalleryTemplatesStackPanel"
              groupName="templates-items-panel"
              isChecked={computed(() => !wrapLayout.value)}
              onChecked={() => {
                if (wrapLayout.value) {
                  wrapLayout.value = false
                  context.model.recordInteraction()
                }
              }}
            >
              StackPanel
            </UI.RadioButton>
          </UI.StackPanel>
        }
      >
        <UI.StackPanel spacing={8}>
          <UI.ScrollView
            height={260}
            horizontalContentAlignment={HorizontalAlignment.Stretch}
          >
            <Show
              when={wrapLayout}
              fallback={
                <UI.StackPanel
                  automationId="GalleryTemplatesStackLayout"
                  spacing={4}
                >
                  {layoutItems.map((item) => (
                    <LayoutItem key={item} text={item} />
                  ))}
                </UI.StackPanel>
              }
            >
              <UI.VariableSizedWrapGrid
                automationId="GalleryTemplatesWrapLayout"
                itemWidth={104}
                itemHeight={52}
                maximumRowsOrColumns={4}
                orientation={Orientation.Horizontal}
              >
                {layoutItems.map((item) => (
                  <LayoutItem key={item} text={item} />
                ))}
              </UI.VariableSizedWrapGrid>
            </Show>
          </UI.ScrollView>
          <UI.TextBlock
            foreground={theme.secondaryText}
            text="The panel choice changes layout, not the item component."
            textWrapping={TextWrapping.Wrap}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
