import {
  computed,
  signal,
  theme,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  HorizontalAlignment,
  ListView,
  Orientation,
  ParallaxView,
  ScrollView,
  Stretch,
  TextWrapping,
  VerticalAlignment,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryListView,
  UI,
} from '../../gallery-ui'
import { galleryPages } from '../../gallery-data'
import { loadGalleryBitmap } from '../../gallery-assets'
import {
  Page,
  SampleCard,
} from '../../components/gallery-components'
import {
  MotionStatus,
  useMotionSettings,
} from './shared'

export function ParallaxViewPage(context: AppContext) {
  const motion = useMotionSettings()
  const listView: RefObject<ListView> = { current: null }
  const listParallax: RefObject<ParallaxView> = { current: null }
  const scrollView: RefObject<ScrollView> = { current: null }
  const scrollParallax: RefObject<ParallaxView> = { current: null }
  const requestedShift = signal(500)
  const shiftResult = signal('Parallax vertical shift applied: 500')
  const verticalShift = computed(() =>
    motion.enabled.value ? requestedShift.value : 0)
  const applyShift = () => {
    requestedShift.value =
      requestedShift.value === 500 ? 250 : 500
    const applied = motion.enabled.value
      ? requestedShift.value
      : 0
    if (listParallax.current) {
      listParallax.current.verticalShift = applied
    }
    if (scrollParallax.current) {
      scrollParallax.current.verticalShift = applied
    }
    shiftResult.value =
      `Parallax vertical shift applied: ${applied}`
    context.model.recordInteraction()
  }
  const connectList = () => {
    if (listView.current && listParallax.current) {
      listParallax.current.source = listView.current
    }
  }
  const connectScroll = () => {
    if (scrollView.current && scrollParallax.current) {
      scrollParallax.current.source = scrollView.current
    }
  }
  const rectangleBrushes = [
    'SystemFillColorAttentionBrush',
    'SystemFillColorCautionBrush',
    'SystemFillColorCriticalBrush',
    'SystemFillColorSuccessBrush',
    'AccentFillColorDefaultBrush',
    'CardBackgroundFillColorSecondaryBrush',
  ] as const

  return (
    <Page
      title="ParallaxView"
      subtitle="A container control that provides the parallax effect when scrolling."
      automationId="ParallaxViewPageHeading"
      pageId="parallax-view"
      model={context.model}
    >
      <MotionStatus
        automationId="GalleryMotionParallaxStatus"
        settings={motion}
      />
      <UI.StackPanel
        orientation={Orientation.Horizontal}
        spacing={8}
      >
        <UI.Button
          automationId="GalleryMotionParallaxApplyShift"
          onClick={applyShift}
        >
          Change parallax distance
        </UI.Button>
        <UI.TextBlock
          automationId="GalleryMotionParallaxResult"
          text={shiftResult}
        />
      </UI.StackPanel>

      <SampleCard
        title="Parallax on a ListView"
        description="Scroll the translucent ListView while ParallaxView moves the cliff image at a different vertical rate."
        code={`<UI.ParallaxView
  ref={parallax}
  source={listView}
  verticalShift={500}
>
  <UI.Image source={cliff} />
</UI.ParallaxView>
<GalleryListView ref={listView}>...</GalleryListView>`}
      >
        <UI.Grid height={650}>
          <UI.ParallaxView
            ref={(value) => {
              listParallax.current = value
              connectList()
            }}
            verticalShift={verticalShift}
            horizontalAlignment={HorizontalAlignment.Left}
            verticalAlignment={VerticalAlignment.Top}
          >
            <UI.Image
              width={900}
              height={1150}
              source={loadGalleryBitmap(
                'SampleMedia/cliff.jpg',
                1100,
              )}
              stretch={Stretch.UniformToFill}
            />
          </UI.ParallaxView>
          <GalleryListView
            ref={(value) => {
              listView.current = value
              connectList()
            }}
            automationName="all samples"
            background={theme.ref('SmokeFillColorDefaultBrush')}
            horizontalAlignment={HorizontalAlignment.Stretch}
            verticalAlignment={VerticalAlignment.Top}
            header={
              <UI.TextBlock
                maxWidth={280}
                padding={thickness(12)}
                horizontalAlignment={HorizontalAlignment.Center}
                fontSize={28}
                foreground={theme.ref(
                  'TextOnAccentFillColorPrimaryBrush',
                )}
                text="Scroll the list to see parallaxing of image"
                textWrapping={TextWrapping.WrapWholeWords}
              />
            }
          >
            {galleryPages.slice(0, 45).map((page) => (
              <UI.TextBlock
                key={page.id}
                padding={thickness(8)}
                foreground={theme.ref(
                  'TextOnAccentFillColorPrimaryBrush',
                )}
                text={page.title}
              />
            ))}
          </GalleryListView>
        </UI.Grid>
      </SampleCard>

      <SampleCard
        title="Parallax with a ScrollView"
        description="Scroll the colored rectangles while the background image moves through the same native ParallaxView source relationship."
        code={`parallax.source = scrollView
parallax.verticalShift = animationsEnabled ? 500 : 0`}
      >
        <UI.Grid height={650}>
          <UI.ParallaxView
            ref={(value) => {
              scrollParallax.current = value
              connectScroll()
            }}
            verticalShift={verticalShift}
            horizontalAlignment={HorizontalAlignment.Left}
            verticalAlignment={VerticalAlignment.Top}
          >
            <UI.Image
              width={900}
              height={1150}
              source={loadGalleryBitmap(
                'SampleMedia/cliff.jpg',
                1100,
              )}
              stretch={Stretch.UniformToFill}
            />
          </UI.ParallaxView>
          <UI.TextBlock
            maxWidth={280}
            horizontalAlignment={HorizontalAlignment.Center}
            verticalAlignment={VerticalAlignment.Top}
            fontSize={28}
            foreground={theme.ref(
              'TextOnAccentFillColorPrimaryBrush',
            )}
            text="Scroll the rectangles to see parallaxing of image"
            textWrapping={TextWrapping.WrapWholeWords}
          />
          <UI.ScrollView
            ref={(value) => {
              scrollView.current = value
              connectScroll()
            }}
            width={150}
            horizontalAlignment={HorizontalAlignment.Left}
          >
            <UI.StackPanel>
              {Array.from({ length: 19 }, (_, index) => (
                <UI.Rectangle
                  key={index}
                  height={150}
                  fill={theme.ref(
                    rectangleBrushes[
                      index % rectangleBrushes.length
                    ]!,
                  )}
                />
              ))}
            </UI.StackPanel>
          </UI.ScrollView>
        </UI.Grid>
      </SampleCard>
    </Page>
  )
}
