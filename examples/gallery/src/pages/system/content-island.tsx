import {
  onCleanup,
  signal,
  theme,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  ChildSiteLink,
  ContentIsland,
  ElementCompositionPreview,
  HorizontalAlignment,
  Orientation,
  Rectangle,
  TextWrapping,
  type CompositionColorBrush,
  type ContainerVisual,
  type SpriteVisual,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

interface IslandResources {
  readonly host: Rectangle
  readonly placement: ContainerVisual
  readonly site: ChildSiteLink
  readonly island: ContentIsland
  readonly root: ContainerVisual
  readonly sprite: SpriteVisual
  readonly brush: CompositionColorBrush
  readonly removeLayoutUpdated: () => void
}

function formatNativeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message
  }
  return String(error)
}

function isAlreadyClosedError(error: unknown): boolean {
  const message = formatNativeError(error)
  return message.includes('0x80000013') ||
    message.includes('already been closed / disposed')
}

function translationMatrix(x: number, y: number) {
  return {
    m11: 1, m12: 0, m13: 0, m14: 0,
    m21: 0, m22: 1, m23: 0, m24: 0,
    m31: 0, m32: 0, m33: 1, m34: 0,
    m41: x, m42: y, m43: 0, m44: 1,
  }
}

function detachPlacementVisual(element: Rectangle) {
  // The generated declaration omits the native API's nullable Visual parameter.
  ElementCompositionPreview.setElementChildVisual(element, null!)
}

export function ContentIslandPage(context: AppContext) {
  const host: RefObject<Rectangle> = { current: null }
  const status = signal(
    'ContentIsland capability has not been exercised.',
  )
  let resources: IslandResources | undefined

  const releaseResources = () => {
    const owned = resources
    resources = undefined
    if (!owned) {
      return
    }
    const failures: unknown[] = []
    const releases: ReadonlyArray<readonly [string, () => void]> = [
      ['LayoutUpdated subscription', owned.removeLayoutUpdated],
      ['ChildSiteLink', () => owned.site.close()],
      ['XAML placement attachment', () => detachPlacementVisual(owned.host)],
      ['ContentIsland root child', () => owned.root.children.remove(owned.sprite)],
      ['ContentIsland', () => owned.island.close()],
      ['SpriteVisual', () => owned.sprite.close()],
      ['CompositionColorBrush', () => owned.brush.close()],
      ['ContentIsland root visual', () => owned.root.close()],
      ['placement visual', () => owned.placement.close()],
    ]
    for (const [label, release] of releases) {
      try {
        release()
      }
      catch (error) {
        if (!isAlreadyClosedError(error)) {
          failures.push(
            new Error(`${label} cleanup failed: ${formatNativeError(error)}`),
          )
        }
      }
    }
    if (failures.length > 0) {
      throw failures[0]
    }
  }

  onCleanup(releaseResources)

  const createIsland = () => {
    const partialReleases: Array<() => void> = []
    try {
      releaseResources()
      const element = host.current
      if (!element) {
        throw new Error('The ContentIsland placement element is not loaded.')
      }
      const compositor = ElementCompositionPreview
        .getElementVisual(element)
        .compositor
      const size = element.actualSize
      if (size.x <= 0 || size.y <= 0) {
        throw new Error('The placement element has no arranged size.')
      }
      const placement = compositor.createContainerVisual()
      partialReleases.push(() => placement.close())
      ElementCompositionPreview.setElementChildVisual(element, placement)
      partialReleases.push(() => detachPlacementVisual(element))
      const root = compositor.createContainerVisual()
      partialReleases.push(() => root.close())
      const sprite = compositor.createSpriteVisual()
      const brush = compositor.createColorBrush({
        a: 255,
        r: 0,
        g: 120,
        b: 212,
      })
      partialReleases.push(() => brush.close())
      partialReleases.push(() => sprite.close())
      root.size = size
      placement.size = size
      sprite.size = size
      sprite.brush = brush
      root.children.insertAtTop(sprite)

      const island = ContentIsland.create(root)
      partialReleases.push(() => island.close())
      partialReleases.push(() => root.children.remove(sprite))
      const site = ChildSiteLink.create(
        element.xamlRoot.contentIsland,
        placement,
      )
      partialReleases.push(() => site.close())
      const updatePlacement = () => {
        const current = host.current
        if (!current || site.isClosed) {
          return
        }
        const currentSize = current.actualSize
        const transform = current.transformToVisual(
          current.xamlRoot.content,
        )
        const point = transform.transformPoint({ x: 0, y: 0 })
        placement.size = currentSize
        root.size = currentSize
        sprite.size = currentSize
        site.actualSize = currentSize
        site.localToParentTransformMatrix =
          translationMatrix(point.x, point.y)
      }
      const removeLayoutUpdated = element.onLayoutUpdated(
        updatePlacement,
      )
      partialReleases.push(removeLayoutUpdated)
      resources = {
        host: element,
        placement,
        site,
        island,
        root,
        sprite,
        brush,
        removeLayoutUpdated,
      }
      partialReleases.length = 0
      updatePlacement()
      site.connect(island)
      status.value =
        `ContentIsland connected (id ${island.id}); ChildSiteLink and composition resources are owned by this page.`
      context.model.recordInteraction()
    }
    catch (error) {
      let partialCleanupError: unknown
      for (const release of partialReleases.reverse()) {
        try {
          release()
        }
        catch (cleanupError) {
          if (!isAlreadyClosedError(cleanupError)) {
            partialCleanupError ??= cleanupError
          }
        }
      }
      try {
        releaseResources()
      }
      catch (cleanupError) {
        status.value =
          `ContentIsland unavailable: ${formatNativeError(error)} Cleanup also failed: ${formatNativeError(cleanupError)}`
        return
      }
      if (partialCleanupError !== undefined) {
        status.value =
          `ContentIsland unavailable: ${formatNativeError(error)} Cleanup also failed: ${formatNativeError(partialCleanupError)}`
        return
      }
      status.value =
        `ContentIsland unavailable: ${formatNativeError(error)}`
    }
  }

  return (
    <Page
      title="ContentIsland"
      subtitle="Create a native ContentIsland and connect it to a XAML placement visual through an owned ChildSiteLink."
      automationId="ContentIslandPageHeading"
      pageId="content-island"
      model={context.model}
    >
      <UI.InfoBar
        isOpen
        isClosable={false}
        title="Hosting requirements"
        message="The sample runs on the Gallery's WinUI STA and dispatcher. A real ContentIsland is connected only when XamlRoot.ContentIsland, composition, and ChildSiteLink are available."
      />
      <SampleCard
        automationId="GallerySystemContentIslandSample"
        title="Host composition content"
        description="The blue surface is produced by a child composition tree connected through ContentIsland and ChildSiteLink, not by a success-shaped fallback."
        code={`const compositor =
  ElementCompositionPreview.getElementVisual(host).compositor
const placement = compositor.createContainerVisual()
ElementCompositionPreview.setElementChildVisual(host, placement)
const root = compositor.createContainerVisual()
const island = ContentIsland.create(root)
const site = ChildSiteLink.create(host.xamlRoot.contentIsland, placement)
site.connect(island)`}
        output={
          <UI.TextBlock
            automationId="GallerySystemContentIslandStatus"
            text={status}
            textWrapping={TextWrapping.Wrap}
          />
        }
      >
        <UI.StackPanel spacing={12}>
          <UI.Rectangle
            ref={host}
            automationId="GallerySystemContentIslandHost"
            automationName="ContentIsland placement surface"
            width={360}
            height={220}
            horizontalAlignment={HorizontalAlignment.Left}
            fill={theme.cardBackground}
            stroke={theme.controlStroke}
            strokeThickness={1}
          />
          <UI.StackPanel
            orientation={Orientation.Horizontal}
            spacing={8}
            horizontalAlignment={HorizontalAlignment.Left}
          >
            <UI.Button
              automationId="GallerySystemContentIslandCreate"
              onClick={createIsland}
            >
              Create ContentIsland
            </UI.Button>
            <UI.Button
              automationId="GallerySystemContentIslandRelease"
              onClick={() => {
                try {
                  releaseResources()
                }
                catch (error) {
                  status.value =
                    `ContentIsland cleanup failed: ${formatNativeError(error)}`
                  return
                }
                status.value = 'ContentIsland resources released.'
              }}
            >
              Release ContentIsland
            </UI.Button>
          </UI.StackPanel>
          <UI.TextBlock
            margin={thickness(0, 4, 0, 0)}
            text="Navigating away also unsubscribes LayoutUpdated, detaches and closes the placement visual, and releases the ChildSiteLink, ContentIsland, child visuals, and brush."
            textWrapping={TextWrapping.Wrap}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
