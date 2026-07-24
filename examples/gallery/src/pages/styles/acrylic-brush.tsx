import {
  color,
  computed,
  signal,
  thickness,
} from 'dynwinrt-jsx'
import { AcrylicBrush } from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function AcrylicBrushPage(context: AppContext) {
  const fallback = signal(false)
  const nativeStatus = signal('Native fallback: off')
  const brush = new AcrylicBrush()
  brush.tintColor = color(0, 120, 212)
  brush.fallbackColor = color(32, 32, 32)
  brush.tintOpacity = 0.7

  return (
    <Page
      title="AcrylicBrush"
      subtitle="Applies a translucent, tinted material to panel backgrounds."
      automationId="AcrylicBrushPageHeading"
      pageId="acrylic-brush"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStylesAcrylicSample"
        title="Acrylic material with fallback"
        description="The brush exposes native tint, opacity, fallback color, and fallback mode."
        code={`
const acrylic = new AcrylicBrush()
acrylic.tintColor = color(0, 120, 212)
acrylic.tintOpacity = .7
<UI.Border background={acrylic} />
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryStylesAcrylicStatus"
              text={computed(() =>
                fallback.value
                  ? 'Solid fallback enabled.'
                  : 'Acrylic material enabled.',
              )}
            />
            <UI.TextBlock
              automationId="GalleryStylesAcrylicNativeStatus"
              text={nativeStatus}
            />
          </UI.StackPanel>
        }
        options={
          <UI.Button
            automationId="GalleryStylesAcrylicToggle"
            onClick={() => {
              fallback.value = !fallback.value
              brush.alwaysUseFallback = fallback.value
              nativeStatus.value =
                `Native fallback: ${brush.alwaysUseFallback ? 'on' : 'off'}`
              context.model.recordInteraction()
            }}
          >
            Toggle fallback
          </UI.Button>
        }
      >
        <UI.Border
          automationId="GalleryStylesAcrylicPreview"
          height={180}
          padding={thickness(28)}
          background={brush}
        >
          <UI.TextBlock
            fontSize={24}
            text="Acrylic surface"
          />
        </UI.Border>
      </SampleCard>
    </Page>
  )
}
