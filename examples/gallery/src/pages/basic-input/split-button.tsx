import {
  color,
  computed,
  createSolidColorBrush,
  signal,
} from 'dynwinrt-jsx'
import { SolidColorBrush } from '#winapp/bindings'
import {
  type AppContext,
  GallerySplitButton,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

type AccentColor =
  | 'Red'
  | 'Orange'
  | 'Green'
  | 'Blue'
  | 'Violet'
  | 'Gray'

export function SplitButtonPage(context: AppContext) {
  const selectedColor = signal<AccentColor>('Green')
  const revealColor = signal<AccentColor>('Green')
  const applied = signal(0)
  const brushes = {
    Red: createSolidColorBrush(SolidColorBrush, color(220, 20, 60)),
    Orange: createSolidColorBrush(SolidColorBrush, color(255, 140, 0)),
    Green: createSolidColorBrush(SolidColorBrush, color(16, 124, 16)),
    Blue: createSolidColorBrush(SolidColorBrush, color(0, 120, 212)),
    Violet: createSolidColorBrush(SolidColorBrush, color(134, 80, 172)),
    Gray: createSolidColorBrush(SolidColorBrush, color(96, 94, 92)),
  }
  const selectedBrush = computed(() => brushes[selectedColor.value])

  const chooseColor = (color: AccentColor) => {
    selectedColor.value = color
    context.model.recordInteraction()
  }

  return (
    <Page
      title="SplitButton"
      subtitle="Combine a current primary action with a flyout of alternatives."
      automationId="SplitButtonPageHeading"
      pageId="split-button"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryBasicInputSplitButtonSample"
        title="Font color"
        description="The primary side reapplies the current color, while the flyout chooses the color used by the preview text."
        code={`
<GallerySplitButton
  content={computed(() => \`Apply \${selectedColor.value}\`)}
  onClick={() => applied.value += 1}
>
  <UI.MenuFlyout>
    <UI.MenuFlyoutItem text="Green" onClick={() => chooseColor('Green')} />
    <UI.MenuFlyoutItem text="Blue" onClick={() => chooseColor('Blue')} />
  </UI.MenuFlyout>
</GallerySplitButton>
        `}
      >
        <UI.StackPanel spacing={12}>
          <GallerySplitButton
            automationId="GalleryBasicInputSplitButtonControl"
            content={computed(
              () => `Apply ${selectedColor.value}`,
            )}
            onClick={() => {
              applied.value += 1
              context.model.recordInteraction()
            }}
          >
            <UI.MenuFlyout>
              <UI.MenuFlyoutItem
                text="Red"
                onClick={() => chooseColor('Red')}
              />
              <UI.MenuFlyoutItem
                text="Orange"
                onClick={() => chooseColor('Orange')}
              />
              <UI.MenuFlyoutItem
                text="Green"
                onClick={() => chooseColor('Green')}
              />
              <UI.MenuFlyoutItem
                automationId="GalleryBasicInputSplitBlue"
                text="Blue"
                onClick={() => chooseColor('Blue')}
              />
              <UI.MenuFlyoutItem
                text="Violet"
                onClick={() => chooseColor('Violet')}
              />
              <UI.MenuFlyoutItem
                text="Gray"
                onClick={() => chooseColor('Gray')}
              />
            </UI.MenuFlyout>
          </GallerySplitButton>
          <UI.TextBlock
            foreground={selectedBrush}
            text="Lorem ipsum dolor sit amet, consectetur adipiscing elit."
          />
          <UI.TextBlock
            text={computed(
              () =>
                `Selected color: ${selectedColor.value}; applied ${applied.value} times`,
            )}
          />
        </UI.StackPanel>
      </SampleCard>
      <SampleCard
        title="Text label with color choices"
        description="A text-labeled SplitButton exposes the same secondary choices and closes its MenuFlyout after selection."
        code={`
<GallerySplitButton content="Choose color">
  <UI.MenuFlyout>
    <UI.MenuFlyoutItem text="Red" onClick={() => revealColor.value = 'Red'} />
    <UI.MenuFlyoutItem text="Blue" onClick={() => revealColor.value = 'Blue'} />
  </UI.MenuFlyout>
</GallerySplitButton>
        `}
      >
        <UI.StackPanel spacing={12}>
          <GallerySplitButton
            content={computed(() => `Choose color: ${revealColor.value}`)}
            onClick={() => {
              context.model.recordInteraction()
            }}
          >
            <UI.MenuFlyout>
              <UI.MenuFlyoutItem
                text="Red"
                onClick={() => {
                  revealColor.value = 'Red'
                  context.model.recordInteraction()
                }}
              />
              <UI.MenuFlyoutItem
                text="Orange"
                onClick={() => {
                  revealColor.value = 'Orange'
                  context.model.recordInteraction()
                }}
              />
              <UI.MenuFlyoutItem
                text="Green"
                onClick={() => {
                  revealColor.value = 'Green'
                  context.model.recordInteraction()
                }}
              />
              <UI.MenuFlyoutItem
                text="Blue"
                onClick={() => {
                  revealColor.value = 'Blue'
                  context.model.recordInteraction()
                }}
              />
              <UI.MenuFlyoutItem
                text="Violet"
                onClick={() => {
                  revealColor.value = 'Violet'
                  context.model.recordInteraction()
                }}
              />
              <UI.MenuFlyoutItem
                text="Gray"
                onClick={() => {
                  revealColor.value = 'Gray'
                  context.model.recordInteraction()
                }}
              />
            </UI.MenuFlyout>
          </GallerySplitButton>
          <UI.TextBlock
            foreground={computed(() => brushes[revealColor.value])}
            text={computed(() => `Selected: ${revealColor.value}`)}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
