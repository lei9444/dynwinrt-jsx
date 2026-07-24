import {
  color,
  computed,
  createSolidColorBrush,
  signal,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  SolidColorBrush,
} from '#winapp/bindings'
import {
  type AppContext,
  type ToggleInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function ColorContrastPage(context: AppContext) {
  const highContrast = signal(true)
  const toggle: RefObject<ToggleInstance> = { current: null }
  const black = createSolidColorBrush(
    SolidColorBrush,
    color(0, 0, 0),
  )
  const white = createSolidColorBrush(
    SolidColorBrush,
    color(255, 255, 255),
  )
  const gray = createSolidColorBrush(
    SolidColorBrush,
    color(170, 170, 170),
  )

  return (
    <Page
      title="Color Contrast"
      subtitle="Readable foreground and background pairs support low-vision users."
      automationId="ColorContrastPageHeading"
      pageId="color-contrast"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryAccessibilityContrastSample"
        title="Compare contrast choices"
        description="The accessible preset uses a 21:1 black-and-white pair; the muted example is clearly labeled as insufficient."
        code={`
<UI.Border background={background}>
  <UI.TextBlock foreground={foreground} />
</UI.Border>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryAccessibilityContrastStatus"
            text={computed(() =>
              highContrast.value
                ? 'Contrast ratio: 21:1 (passes AAA).'
                : 'Contrast ratio: 2.3:1 (needs improvement).',
            )}
          />
        }
        options={
          <UI.ToggleSwitch
            ref={toggle}
            automationId="GalleryAccessibilityContrastToggle"
            header="Use high contrast"
            isOn
            onToggled={() => {
              highContrast.value =
                toggle.current?.isOn ?? highContrast.value
              context.model.recordInteraction()
            }}
          />
        }
      >
        <UI.Border
          automationId="GalleryAccessibilityContrastPreview"
          padding={thickness(28)}
          background={computed(() =>
            highContrast.value ? white : gray,
          )}
        >
          <UI.TextBlock
            fontSize={24}
            foreground={computed(() =>
              highContrast.value ? black : white,
            )}
            text={computed(() =>
              highContrast.value
                ? 'Accessible high-contrast text'
                : 'Low-contrast example',
            )}
          />
        </UI.Border>
      </SampleCard>
    </Page>
  )
}
