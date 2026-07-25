import {
  Show,
  computed,
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  Geopoint,
  IVector_MapElement,
  MapControl,
  MapElementsLayer,
  MapIcon,
  Package,
  PasswordBox,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import { loadGalleryBitmap } from '../../gallery-assets'

function hasPackageIdentity(): boolean {
  try {
    void Package.current.id
    return true
  }
  catch {
    return false
  }
}

export function MapControlPage(context: AppContext) {
  const packaged = hasPackageIdentity()
  const map: RefObject<MapControl> = { current: null }
  const token: RefObject<PasswordBox> = { current: null }
  const screenshot = loadGalleryBitmap(
    'SampleMedia/MapExample.png',
    1200,
  )
  const status = signal(
    packaged
      ? 'MapControl is ready for an Azure Maps service token.'
      : 'MapControl unavailable: this Gallery is running without package identity.',
  )
  const configureMap = () => {
    const current = map.current
    if (!current) {
      return
    }
    const center = new Geopoint({
      latitude: 0,
      longitude: 0,
      altitude: 0,
    })
    const location = new Geopoint({
      latitude: -30.034647,
      longitude: -51.217659,
      altitude: 0,
    })
    const icon = new MapIcon()
    icon.location = location
    const layer = new MapElementsLayer()
    layer.mapElements = IVector_MapElement.create([icon])
    current.center = center
    current.zoomLevel = 1
    current.layers.append(layer)
  }
  const applyToken = () => {
    const currentMap = map.current
    const currentToken = token.current?.password ?? ''
    if (!currentMap) {
      throw new Error('MapControl is not mounted.')
    }
    if (!currentToken.trim()) {
      status.value = 'Enter an Azure Maps service token first.'
      return
    }
    currentMap.mapServiceToken = currentToken
    status.value = 'Map service token applied; tile loading requires network access.'
    context.model.recordInteraction()
  }

  return (
    <Page
      title="MapControl"
      subtitle="Displays a symbolic map of the Earth."
      automationId="MapControlPageHeading"
      pageId="map-control"
      model={context.model}
    >
      <UI.TextBlock
        text="An Azure Maps service token and network access are required for live map tiles."
      />
      <UI.Image
        automationId="GalleryMediaMapReference"
        height={320}
        source={screenshot}
      />
      <SampleCard
        automationId="GalleryMediaMapControlSample"
        title="Show a pin on a map"
        description="The original sample centers the map at the equator and adds a pin near Porto Alegre, Brazil."
        code={`const icon = new MapIcon()
icon.location = new Geopoint(position)
const layer = new MapElementsLayer()
layer.mapElements = IVector_MapElement.create([icon])
map.layers.append(layer)`}
        output={
          <UI.TextBlock
            automationId="GalleryMediaMapStatus"
            text={status}
          />
        }
        options={
          <Show when={packaged}>
            <UI.StackPanel spacing={8}>
              <UI.PasswordBox
                ref={token}
                automationId="GalleryMediaMapToken"
                minWidth={200}
                placeholderText="Map service token"
              />
              <UI.Button
                automationId="GalleryMediaMapSetToken"
                onClick={applyToken}
              >
                Set token
              </UI.Button>
            </UI.StackPanel>
          </Show>
        }
      >
        <Show
          when={packaged}
          fallback={
            <UI.InfoBar
              automationId="GalleryMediaMapUnavailable"
              isOpen
              title="MapControl unavailable"
              message="The WinUI Maps service requires package identity. The static reference image remains available in this unpackaged Gallery."
            />
          }
        >
          <UI.MapControl
            ref={map}
            automationId="GalleryMediaMapControl"
            height={400}
            onLoaded={configureMap}
          />
        </Show>
      </SampleCard>
      <UI.TextBlock
        text={computed(() => packaged
          ? 'Package identity detected.'
          : 'No package identity detected.')}
      />
    </Page>
  )
}
