import {
  computed,
  onCleanup,
  signal,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  Border,
  Grid,
  ThemeShadow,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function ThemeShadowPage(context: AppContext) {
  const receiver: RefObject<Grid> = { current: null }
  const surface: RefObject<Border> = { current: null }
  const elevation = signal(32)
  const nativeElevation = signal(32)
  const receiverCount = signal(0)
  const shadow = new ThemeShadow()
  let connected = false
  const connect = () => {
    const target = receiver.current
    if (target && !connected) {
      shadow.receivers.append(target)
      connected = true
      receiverCount.value = shadow.receivers.size
    }
  }
  onCleanup(() => {
    shadow.receivers.clear()
    connected = false
    receiverCount.value = 0
  })

  return (
    <Page
      title="ThemeShadow"
      subtitle="Adds a depth-aware shadow to UI elements using system lighting."
      automationId="ThemeShadowPageHeading"
      pageId="theme-shadow"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStylesThemeShadowSample"
        title="Elevated card shadow"
        description="ThemeShadow casts onto a receiver and responds to the surface Z translation."
        code={`
const shadow = new ThemeShadow()
surface.shadow = shadow
surface.translation = { x: 0, y: 0, z: 32 }
shadow.receivers.append(receiver)
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryStylesThemeShadowStatus"
              text={computed(
                () => `Elevation: ${elevation.value}`,
              )}
            />
            <UI.TextBlock
              automationId="GalleryStylesThemeShadowNativeStatus"
              text={computed(
                () =>
                `Native elevation: ${nativeElevation.value}; receivers: ${receiverCount.value}`,
              )}
            />
          </UI.StackPanel>
        }
        options={
          <UI.Button
            automationId="GalleryStylesThemeShadowToggle"
            onClick={() => {
              elevation.value =
                elevation.value === 32 ? 8 : 32
              nativeElevation.value =
                surface.current?.translation.z ?? -1
              context.model.recordInteraction()
            }}
          >
            Toggle elevation
          </UI.Button>
        }
      >
        <UI.Grid
          width={360}
          height={240}
          padding={thickness(36)}
        >
          <UI.Grid ref={receiver} onLoaded={connect} />
          <UI.Border
            ref={surface}
            automationId="GalleryStylesThemeShadowControl"
            width={200}
            height={140}
            padding={thickness(20)}
            shadow={shadow}
            translation={computed(() => ({
              x: 0,
              y: 0,
              z: elevation.value,
            }))}
            onLoaded={connect}
          >
            <UI.TextBlock text="Elevated surface" />
          </UI.Border>
        </UI.Grid>
      </SampleCard>
    </Page>
  )
}
