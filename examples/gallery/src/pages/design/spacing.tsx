import {
  computed,
  signal,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import { StackPanel } from '#winapp/bindings'
import {
  type AppContext,
  type SliderInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function SpacingPage(context: AppContext) {
  const spacing = signal(12)
  const stack: RefObject<StackPanel> = { current: null }
  const nativeSpacing = signal(12)
  const slider: RefObject<SliderInstance> = { current: null }

  return (
    <Page
      title="Spacing"
      subtitle="Consistent padding and gaps improve readability and visual flow."
      automationId="SpacingPageHeading"
      pageId="spacing"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryDesignSpacingSample"
        title="A responsive spacing scale"
        description="One signal drives StackPanel spacing and Border padding with native Thickness values."
        code={`
<UI.StackPanel spacing={spacing}>
  <UI.Border padding={computed(() => thickness(spacing.value))} />
</UI.StackPanel>
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryDesignSpacingStatus"
              text={computed(
                () => `Spacing: ${Math.round(spacing.value)}`,
              )}
            />
            <UI.TextBlock
              automationId="GalleryDesignSpacingNativeStatus"
              text={computed(
                () =>
                  `Native spacing: ${Math.round(nativeSpacing.value)}`,
              )}
            />
          </UI.StackPanel>
        }
        options={
          <UI.Slider
            ref={slider}
            automationId="GalleryDesignSpacingValue"
            header="Spacing"
            minimum={0}
            maximum={32}
            value={12}
            onValueChanged={() => {
              const next = slider.current?.value
              if (
                next !== undefined &&
                Number.isFinite(next) &&
                next !== spacing.value
              ) {
                spacing.value = next
                nativeSpacing.value =
                  stack.current?.spacing ?? -1
                context.model.recordInteraction()
              }
            }}
          />
        }
      >
        <UI.StackPanel ref={stack} spacing={spacing}>
          {['Primary', 'Secondary', 'Tertiary'].map((label) => (
            <UI.Border
              key={label}
              padding={computed(() => thickness(spacing.value))}
            >
              <UI.TextBlock text={label} />
            </UI.Border>
          ))}
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
