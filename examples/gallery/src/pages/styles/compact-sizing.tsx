import {
  computed,
  signal,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import { Button } from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function CompactSizingPage(context: AppContext) {
  const compact = signal(false)
  const firstButton: RefObject<Button> = { current: null }
  const nativeHeight = signal(40)

  return (
    <Page
      title="Compact Sizing"
      subtitle="Reduces control height and spacing for information-dense interfaces."
      automationId="CompactSizingPageHeading"
      pageId="compact-sizing"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStylesCompactSizingSample"
        title="Standard and compact density"
        description="Signal-backed native dimensions demonstrate a scoped compact sizing treatment."
        code={`
<UI.Button
  minHeight={computed(() => compact.value ? 28 : 40)}
  padding={computed(() => thickness(compact.value ? 6 : 12))}
/>
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryStylesCompactSizingStatus"
              text={computed(() =>
                compact.value
                  ? 'Compact sizing enabled.'
                  : 'Standard sizing enabled.',
              )}
            />
            <UI.TextBlock
              automationId="GalleryStylesCompactSizingNativeStatus"
              text={computed(
                () => `Native minimum height: ${nativeHeight.value}`,
              )}
            />
          </UI.StackPanel>
        }
        options={
          <UI.Button
            automationId="GalleryStylesCompactSizingToggle"
            onClick={() => {
              compact.value = !compact.value
              nativeHeight.value =
                firstButton.current?.minHeight ?? -1
              context.model.recordInteraction()
            }}
          >
            Toggle density
          </UI.Button>
        }
      >
        <UI.StackPanel
          spacing={computed(() => compact.value ? 4 : 12)}
        >
          {['Open', 'Save', 'Share'].map((label, index) => (
            <UI.Button
              key={label}
              {...(index === 0 ? { ref: firstButton } : {})}
              minHeight={computed(() =>
                compact.value ? 28 : 40,
              )}
              padding={computed(() =>
                thickness(compact.value ? 6 : 12),
              )}
            >
              {label}
            </UI.Button>
          ))}
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
