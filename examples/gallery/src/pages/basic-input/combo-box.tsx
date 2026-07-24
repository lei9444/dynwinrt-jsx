import {
  computed,
  createFontFamily,
  signal,
} from 'dynwinrt-jsx'
import { FontFamily } from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function ComboBoxPage(context: AppContext) {
  const colors = ['Blue', 'Green', 'Red', 'Yellow']
  const fonts = [
    {
      name: 'Arial',
      family: createFontFamily(FontFamily, 'Arial'),
    },
    {
      name: 'Consolas',
      family: createFontFamily(FontFamily, 'Consolas'),
    },
    {
      name: 'Segoe UI Variable',
      family: createFontFamily(FontFamily, 'Segoe UI Variable'),
    },
  ]
  const fontSizes = [
    '8',
    '9',
    '10',
    '11',
    '12',
    '14',
    '16',
    '18',
    '20',
    '24',
    '28',
    '36',
    '48',
    '72',
  ]
  const selectedIndex = signal(0)
  const fontIndex = signal(2)
  const fontSize = signal(10)
  const validation = signal(
    'Choose a listed size or type a value greater than 8 and less than 100.',
  )

  return (
    <Page
      title="ComboBox"
      subtitle="Select from owned native items or validate editable text."
      automationId="ComboBoxPageHeading"
      pageId="combo-box"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryBasicInputComboBoxSample"
        title="Controlled selection"
        description="The ComboBox adapter synchronizes selectedIndex with a signal."
        code={`
const selectedIndex = signal(0)
<GalleryComboBox
  automationId="GalleryBasicInputComboBoxControl"
  selectedIndex={selectedIndex}
  onSelectedIndexChange={(index) => selectedIndex.value = index}
  header={<UI.TextBlock text="Color" />}
>
  <UI.TextBlock text="Blue" />
  <UI.TextBlock text="Green" />
</GalleryComboBox>
        `}
      >
        <UI.StackPanel spacing={10}>
          <GalleryComboBox
            selectedIndex={selectedIndex}
            onSelectedIndexChange={(index) => {
              selectedIndex.value = index
              context.model.recordInteraction()
            }}
            header={<UI.TextBlock text="Color" />}
            placeholderText="Pick a color"
            width={240}
          >
            {colors.map((name) => (
              <UI.TextBlock
                key={name}
                automationId={`GalleryBasicInputComboBoxItem-${name}`}
                text={name}
              />
            ))}
          </GalleryComboBox>
          <UI.TextBlock
            text={computed(
              () =>
                `Selected: ${colors[selectedIndex.value] ?? 'None'}`,
            )}
          />
        </UI.StackPanel>
      </SampleCard>
      <SampleCard
        title="Items source and display font"
        description="A collection can populate ComboBox items while the selected value updates another control."
        code={`
const fontIndex = signal(2)
<GalleryComboBox selectedIndex={fontIndex} header="Font">
  {fonts.map((font) => <UI.TextBlock key={font.name} text={font.name} />)}
</GalleryComboBox>
<UI.TextBlock fontFamily={computed(() => fonts[fontIndex.value].family)} />
        `}
      >
        <UI.StackPanel spacing={10}>
          <GalleryComboBox
            selectedIndex={fontIndex}
            onSelectedIndexChange={(index) => {
              fontIndex.value = index
              context.model.recordInteraction()
            }}
            header={<UI.TextBlock text="Font" />}
            minWidth={240}
          >
            {fonts.map((font) => (
              <UI.TextBlock key={font.name} text={font.name} />
            ))}
          </GalleryComboBox>
          <UI.TextBlock
            fontFamily={computed(
              () => fonts[fontIndex.value]?.family ?? fonts[2]!.family,
            )}
            text="You can set the font used for this text."
          />
        </UI.StackPanel>
      </SampleCard>
      <SampleCard
        title="Editable input"
        description="TextSubmitted accepts listed or custom font sizes and rejects invalid input without replacing the selected value."
        code={`
<GalleryComboBox
  isEditable
  onTextSubmitted={(sender) => validate(sender.text)}
>
  <UI.TextBlock text="12" />
  <UI.TextBlock text="16" />
</GalleryComboBox>
        `}
      >
        <UI.StackPanel spacing={10}>
          <GalleryComboBox
            isEditable
            selectedIndex={2}
            header={<UI.TextBlock text="Font size" />}
            width={240}
            onTextSubmitted={(sender, args) => {
              const size = Number(args.text)
              const valid =
                Number.isFinite(size) &&
                (
                  fontSizes.includes(String(size)) ||
                  (size > 8 && size < 100)
                )
              if (valid) {
                fontSize.value = size
                sender.text = String(size)
                validation.value = `Accepted font size: ${size}`
              }
              else {
                sender.text = String(fontSize.value)
                validation.value =
                  'The font size must be a number between 8 and 100.'
              }
              args.handled = true
              context.model.recordInteraction()
            }}
          >
            {fontSizes.map((size) => (
              <UI.TextBlock key={size} text={size} />
            ))}
          </GalleryComboBox>
          <UI.TextBlock
            fontSize={fontSize}
            text="You can set the font size used for this text."
          />
          <UI.TextBlock text={validation} />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
