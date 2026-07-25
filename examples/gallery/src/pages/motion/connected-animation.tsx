import {
  Show,
  computed,
  effect,
  onCleanup,
  signal,
  styles,
  theme,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  BasicConnectedAnimationConfiguration,
  ConnectedAnimation,
  ConnectedAnimationConfiguration,
  ConnectedAnimationService,
  DirectConnectedAnimationConfiguration,
  GravityConnectedAnimationConfiguration,
  HorizontalAlignment,
  Image,
  Orientation,
  releaseProjected,
  Stretch,
  TextWrapping,
  UniformGridLayout,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryItemsRepeater,
  UI,
} from '../../gallery-ui'
import { loadGalleryBitmap } from '../../gallery-assets'
import {
  Page,
  SampleCard,
} from '../../components/gallery-components'
import {
  MotionStatus,
  releaseMotionResources,
  useMotionSettings,
} from './shared'

interface LandscapeItem {
  readonly id: number
  readonly title: string
  readonly image: string
  readonly views: string
  readonly likes: string
  readonly description: string
}

const items: readonly LandscapeItem[] = Array.from(
  { length: 8 },
  (_, index) => ({
    id: index + 1,
    title: `Item ${index + 1}`,
    image: `SampleMedia/LandscapeImage${index + 1}.jpg`,
    views: String(240 + index * 73),
    likes: String(18 + index * 9),
    description:
      'Connected animations preserve visual continuity and help users maintain context between collection and detail views.',
  }),
)

export function ConnectedAnimationPage(context: AppContext) {
  const motion = useMotionSettings()
  const service = ConnectedAnimationService.getForCurrentView()
  const connectedResult = signal('Connected destination: list')
  interface ActiveAnimation {
    readonly animation: ConnectedAnimation
    unsubscribe: (() => void) | null
  }
  const activeAnimations = new Map<string, ActiveAnimation>()
  const configurations = [
    null,
    new GravityConnectedAnimationConfiguration(),
    new DirectConnectedAnimationConfiguration(),
    new BasicConnectedAnimationConfiguration(),
  ] as const
  const configurationIndex = signal(0)

  const releaseAnimation = (
    key: string,
    animation: ConnectedAnimation,
    cancel: boolean,
    completed = false,
  ) => {
    const active = activeAnimations.get(key)
    if (!active || active.animation !== animation) {
      return
    }
    activeAnimations.delete(key)
    let firstError: unknown
    if (!completed && active.unsubscribe) {
      try {
        active.unsubscribe()
      }
      catch (error: unknown) {
        firstError = error
      }
    }
    active.unsubscribe = null
    if (cancel) {
      try {
        animation.cancel()
      }
      catch (error: unknown) {
        firstError ??= error
      }
    }
    try {
      releaseProjected(animation)
    }
    catch (error: unknown) {
      firstError ??= error
    }
    if (firstError !== undefined) {
      throw firstError
    }
  }
  const trackAnimation = (
    key: string,
    animation: ConnectedAnimation,
  ) => {
    const previous = activeAnimations.get(key)
    if (previous) {
      releaseAnimation(key, previous.animation, true)
    }
    const active: ActiveAnimation = {
      animation,
      unsubscribe: null,
    }
    activeAnimations.set(key, active)
    try {
      active.unsubscribe = animation.onceCompleted(() => {
        releaseAnimation(key, animation, false, true)
      })
    }
    catch (error: unknown) {
      if (activeAnimations.get(key) === active) {
        activeAnimations.delete(key)
      }
      throw error
    }
    return animation
  }
  const releaseAllAnimations = () => {
    let firstError: unknown
    for (const [key, active] of [...activeAnimations]) {
      try {
        releaseAnimation(key, active.animation, true)
      }
      catch (error: unknown) {
        firstError ??= error
      }
    }
    if (firstError !== undefined) {
      throw firstError
    }
  }
  const prepare = (
    key: string,
    source: Image,
    configuration:
      | ConnectedAnimationConfiguration
      | null = null,
  ) => {
    if (!motion.enabled.value) {
      return null
    }
    let animation: ConnectedAnimation | null = null
    try {
      animation = service.prepareToAnimate(key, source)
      if (configuration) {
        animation.configuration = configuration
      }
      return trackAnimation(key, animation)
    }
    catch (error: unknown) {
      if (animation && !activeAnimations.has(key)) {
        let firstError: unknown = error
        try {
          animation.cancel()
        }
        catch (cleanupError: unknown) {
          firstError ??= cleanupError
        }
        try {
          releaseProjected(animation)
        }
        catch (cleanupError: unknown) {
          firstError ??= cleanupError
        }
        throw firstError
      }
      throw error
    }
  }
  const start = (
    key: string,
    destination: Image,
  ) => {
    if (!motion.enabled.value) {
      const active = activeAnimations.get(key)
      if (active) {
        releaseAnimation(key, active.animation, true)
      }
      return false
    }
    const tracked = activeAnimations.get(key)
    const animation =
      tracked?.animation ?? service.getAnimation(key)
    if (!animation) {
      return false
    }
    if (!tracked) {
      try {
        trackAnimation(key, animation)
      }
      catch (error: unknown) {
        try {
          animation.cancel()
        }
        catch {
          // Preserve the completion-registration failure.
        }
        try {
          releaseProjected(animation)
        }
        catch {
          // Preserve the completion-registration failure.
        }
        throw error
      }
    }
    let started: boolean
    try {
      started = animation.tryStart(destination)
    }
    catch (error: unknown) {
      try {
        releaseAnimation(key, animation, true)
      }
      catch {
        // Preserve the start failure.
      }
      throw error
    }
    if (!started) {
      releaseAnimation(key, animation, true)
    }
    return started
  }

  const listSelection = signal<LandscapeItem | null>(null)
  const listImages = new Map<number, Image>()
  const listDetailImage: RefObject<Image> = { current: null }
  let listBackPending = false
  let listBackItemId: number | null = null

  const cardSelection = signal<LandscapeItem | null>(null)
  const cardImages = new Map<number, Image>()
  const cardDetailImage: RefObject<Image> = { current: null }

  const simpleSecondPage = signal(false)
  const simpleFirst: RefObject<Image> = { current: null }
  const simpleSecond: RefObject<Image> = { current: null }
  let simplePendingKey: string | null = null

  const repeaterSelection = signal<LandscapeItem | null>(null)
  const repeaterItems = signal(items)
  const repeaterImages = new Map<number, Image>()
  const repeaterDetailImage: RefObject<Image> = { current: null }
  let repeaterBackPending = false
  let repeaterBackItemId: number | null = null
  const repeaterLayout = new UniformGridLayout()
  repeaterLayout.minItemWidth = 150
  repeaterLayout.minItemHeight = 120
  repeaterLayout.minColumnSpacing = 8
  repeaterLayout.minRowSpacing = 8

  effect(() => {
    if (!motion.enabled.value) {
      releaseAllAnimations()
    }
  })

  onCleanup(() => {
    let firstError: unknown
    try {
      releaseAllAnimations()
    }
    catch (error: unknown) {
      firstError = error
    }
    try {
      releaseMotionResources([
        ...configurations.filter(Boolean),
        repeaterLayout,
      ])
    }
    catch (error: unknown) {
      firstError ??= error
    }
    try {
      releaseProjected(service)
    }
    catch (error: unknown) {
      firstError ??= error
    }
    if (firstError !== undefined) {
      throw firstError
    }
  })

  const selectedConfiguration = () =>
    configurations[configurationIndex.value] ?? null

  return (
    <Page
      title="Connected Animation"
      subtitle="Connected animations continue elements during page navigation and help the user maintain their context between views."
      automationId="ConnectedAnimationPageHeading"
      pageId="connected-animation"
      model={context.model}
    >
      <MotionStatus
        automationId="GalleryMotionConnectedAnimationStatus"
        settings={motion}
      />
      <UI.TextBlock
        automationId="GalleryMotionConnectedAnimationResult"
        text={connectedResult}
      />

      <SampleCard
        title="A connected animation between a list page and a detail page"
        description="Select an item to connect its image into a detail view. Go back to connect the image to the matching list item."
        code={`const animation = service.prepareToAnimate(
  'ForwardConnectedAnimation',
  sourceImage,
)
route.value = 'detail'

// Destination onLoaded:
service.getAnimation('ForwardConnectedAnimation')
  ?.tryStart(destinationImage, [coordinatedPanel])`}
      >
        <Show
          when={computed(() => listSelection.value !== null)}
          fallback={
            <UI.StackPanel spacing={8}>
              {items.map((item) => (
                <UI.Button
                  key={item.id}
                  horizontalAlignment={HorizontalAlignment.Stretch}
                  onClick={() => {
                    const source = listImages.get(item.id)
                    if (source) {
                      prepare('motion-list-forward', source)
                    }
                    listSelection.value = item
                    context.model.recordInteraction()
                  }}
                >
                  <UI.StackPanel orientation={Orientation.Horizontal} spacing={12}>
                    <UI.Image
                      ref={(value) => {
                        if (value) {
                          listImages.set(item.id, value)
                          if (
                            listBackPending &&
                            listBackItemId === item.id
                          ) {
                            start('motion-list-back', value)
                            listBackPending = false
                            listBackItemId = null
                          }
                        }
                        else {
                          listImages.delete(item.id)
                        }
                      }}
                      width={150}
                      height={90}
                      source={loadGalleryBitmap(item.image, 300)}
                      stretch={Stretch.UniformToFill}
                    />
                    <UI.StackPanel spacing={3}>
                      <UI.TextBlock
                        {...styles.heading({ level: 'bodyStrong' })}
                        text={item.title}
                      />
                      <UI.TextBlock
                        text={`Views: ${item.views} · Likes: ${item.likes}`}
                      />
                    </UI.StackPanel>
                  </UI.StackPanel>
                </UI.Button>
              ))}
            </UI.StackPanel>
          }
        >
          <UI.StackPanel spacing={16}>
            <UI.Button
              onClick={() => {
                if (listDetailImage.current) {
                  prepare(
                    'motion-list-back',
                    listDetailImage.current,
                    configurations[2],
                  )
                }
                listBackItemId = listSelection.value?.id ?? null
                listBackPending = true
                listSelection.value = null
              }}
            >
              Go Back
            </UI.Button>
            <UI.Image
              ref={listDetailImage}
              maxHeight={320}
              source={computed(() =>
                loadGalleryBitmap(
                  listSelection.value?.image ??
                    items[0]!.image,
                  700,
                ))}
              stretch={Stretch.Uniform}
              onLoaded={(sender) => {
                start('motion-list-forward', sender as Image)
              }}
            />
            <UI.TextBlock
              {...styles.heading({ level: 'subtitle' })}
              text={computed(
                () => listSelection.value?.title ?? '',
              )}
            />
            <UI.TextBlock
              text={computed(
                () => listSelection.value?.description ?? '',
              )}
              textWrapping={TextWrapping.Wrap}
            />
          </UI.StackPanel>
        </Show>
      </SampleCard>

      <SampleCard
        title="A connected animation between elements on the same page"
        description="Open a card without navigating away. The source remains in the grid while its image connects into the overlay."
        code={`const animation = service.prepareToAnimate(
  'forwardAnimation',
  sourceImage,
)
selected.value = item
animation.tryStart(destinationImage)`}
      >
        <UI.Grid>
          <UI.StackPanel orientation={Orientation.Horizontal} spacing={8}>
            {items.slice(0, 4).map((item) => (
              <UI.Button
                key={item.id}
                onClick={() => {
                  const source = cardImages.get(item.id)
                  if (source) {
                    prepare('motion-card-forward', source)
                  }
                  cardSelection.value = item
                }}
              >
                <UI.StackPanel spacing={6}>
                  <UI.Image
                    ref={(value) => {
                      if (value) {
                        cardImages.set(item.id, value)
                      }
                      else {
                        cardImages.delete(item.id)
                      }
                    }}
                    width={150}
                    height={110}
                    source={loadGalleryBitmap(item.image, 300)}
                    stretch={Stretch.UniformToFill}
                  />
                  <UI.TextBlock text={item.title} />
                </UI.StackPanel>
              </UI.Button>
            ))}
          </UI.StackPanel>
          <Show when={computed(() => cardSelection.value !== null)}>
            <UI.Border
              padding={thickness(20)}
              background={theme.ref('SmokeFillColorDefaultBrush')}
              horizontalAlignment={HorizontalAlignment.Stretch}
            >
              <UI.StackPanel
                width={420}
                padding={thickness(16)}
                spacing={12}
                background={theme.cardBackground}
                horizontalAlignment={HorizontalAlignment.Center}
              >
                <UI.Button
                  horizontalAlignment={HorizontalAlignment.Right}
                  onClick={() => {
                    const item = cardSelection.value
                    if (
                      item &&
                      cardDetailImage.current
                    ) {
                      prepare(
                        'motion-card-back',
                        cardDetailImage.current,
                        configurations[2],
                      )
                      cardSelection.value = null
                      const destination = cardImages.get(item.id)
                      if (destination) {
                        start('motion-card-back', destination)
                      }
                      else {
                        const active =
                          activeAnimations.get('motion-card-back')
                        if (active) {
                          releaseAnimation(
                            'motion-card-back',
                            active.animation,
                            true,
                          )
                        }
                      }
                    }
                    else {
                      cardSelection.value = null
                    }
                  }}
                >
                  Close
                </UI.Button>
                <UI.Image
                  ref={cardDetailImage}
                  height={260}
                  source={computed(() =>
                    loadGalleryBitmap(
                      cardSelection.value?.image ??
                        items[0]!.image,
                      600,
                    ))}
                  stretch={Stretch.UniformToFill}
                  onLoaded={(sender) => {
                    start('motion-card-forward', sender as Image)
                  }}
                />
                <UI.TextBlock
                  {...styles.heading({ level: 'subtitle' })}
                  text={computed(
                    () => cardSelection.value?.title ?? '',
                  )}
                />
              </UI.StackPanel>
            </UI.Border>
          </Show>
        </UI.Grid>
      </SampleCard>

      <SampleCard
        title="A simple connected animation"
        description="Navigate between two views and compare Default, Gravity, Direct, and Basic connected-animation configurations."
        code={`const animation = service.prepareToAnimate(
  'ForwardConnectedAnimation',
  source,
)
animation.configuration =
  new GravityConnectedAnimationConfiguration()
page.value = 2

// Destination onLoaded:
service.getAnimation('ForwardConnectedAnimation')
  ?.tryStart(destination)`}
        options={
          <UI.StackPanel spacing={12}>
            <UI.Button
              automationId="GalleryMotionConnectedNavigate"
              horizontalAlignment={HorizontalAlignment.Stretch}
              onClick={() => {
                const destination = simpleSecondPage.value
                  ? 'page 1'
                  : 'page 2'
                const source = simpleSecondPage.value
                  ? simpleSecond.current
                  : simpleFirst.current
                simplePendingKey = simpleSecondPage.value
                  ? 'motion-simple-back'
                  : 'motion-simple-forward'
                if (source) {
                  prepare(
                    simplePendingKey,
                    source,
                    selectedConfiguration(),
                  )
                }
                simpleSecondPage.value =
                  !simpleSecondPage.value
                connectedResult.value =
                  `Connected destination: ${destination}`
                context.model.recordInteraction()
              }}
            >
              Navigate
            </UI.Button>
            <UI.TextBlock text="Configurations" />
            <UI.StackPanel spacing={4}>
              {['Default', 'Gravity', 'Direct', 'Basic'].map(
                (name, index) => (
                  <UI.RadioButton
                    key={name}
                    groupName="MotionConnectedAnimationConfiguration"
                    content={name}
                    isChecked={computed(
                      () =>
                        configurationIndex.value === index,
                    )}
                    onChecked={() => {
                      configurationIndex.value = index
                    }}
                  />
                ),
              )}
            </UI.StackPanel>
          </UI.StackPanel>
        }
      >
        <Show
          when={simpleSecondPage}
          fallback={
            <UI.StackPanel spacing={12}>
              <UI.TextBlock
                {...styles.heading({ level: 'subtitle' })}
                text="Sample page 1"
              />
              <UI.Image
                ref={simpleFirst}
                width={420}
                height={260}
                source={loadGalleryBitmap(items[2]!.image, 700)}
                stretch={Stretch.UniformToFill}
                onLoaded={(sender) => {
                  if (simplePendingKey === 'motion-simple-back') {
                    start(simplePendingKey, sender as Image)
                    simplePendingKey = null
                  }
                }}
              />
            </UI.StackPanel>
          }
        >
          <UI.StackPanel spacing={12}>
            <UI.TextBlock
              {...styles.heading({ level: 'subtitle' })}
              text="Sample page 2"
            />
            <UI.Image
              ref={simpleSecond}
              width={260}
              height={380}
              source={loadGalleryBitmap(items[2]!.image, 700)}
              stretch={Stretch.UniformToFill}
              onLoaded={(sender) => {
                if (simplePendingKey === 'motion-simple-forward') {
                  start(simplePendingKey, sender as Image)
                  simplePendingKey = null
                }
              }}
            />
          </UI.StackPanel>
        </Show>
      </SampleCard>

      <SampleCard
        title="Connected animation with ItemsRepeater"
        description="ItemsRepeater has no built-in connected-animation methods, so the source and destination are passed directly to ConnectedAnimationService."
        code={`service.prepareToAnimate(
  'ForwardConnectedAnimation',
  realizedImage,
)
selected.value = item

service.getAnimation('ForwardConnectedAnimation')
  ?.tryStart(detailImage)`}
      >
        <Show
          when={computed(
            () => repeaterSelection.value !== null,
          )}
          fallback={
            <UI.ScrollViewer height={400}>
              <GalleryItemsRepeater
                each={repeaterItems}
                key={(item) => item.id}
                layout={repeaterLayout}
              >
                {(item) => (
                  <UI.Button
                    onClick={() => {
                      const source =
                        repeaterImages.get(item.id)
                      if (source) {
                        prepare(
                          'motion-repeater-forward',
                          source,
                        )
                      }
                      repeaterSelection.value = item
                    }}
                  >
                    <UI.StackPanel spacing={6}>
                      <UI.Image
                        ref={(value) => {
                          if (value) {
                            repeaterImages.set(
                              item.id,
                              value,
                            )
                            if (
                              repeaterBackPending &&
                              repeaterBackItemId === item.id
                            ) {
                              start(
                                'motion-repeater-back',
                                value,
                              )
                              repeaterBackPending = false
                              repeaterBackItemId = null
                            }
                          }
                          else {
                            repeaterImages.delete(item.id)
                          }
                        }}
                        width={150}
                        height={100}
                        source={loadGalleryBitmap(
                          item.image,
                          300,
                        )}
                        stretch={Stretch.UniformToFill}
                      />
                      <UI.TextBlock text={item.title} />
                    </UI.StackPanel>
                  </UI.Button>
                )}
              </GalleryItemsRepeater>
            </UI.ScrollViewer>
          }
        >
          <UI.StackPanel spacing={12}>
            <UI.Button
              onClick={() => {
                if (repeaterDetailImage.current) {
                  prepare(
                    'motion-repeater-back',
                    repeaterDetailImage.current,
                    configurations[2],
                  )
                }
                repeaterBackItemId =
                  repeaterSelection.value?.id ?? null
                repeaterBackPending = true
                repeaterSelection.value = null
              }}
            >
              Go Back
            </UI.Button>
            <UI.Image
              ref={repeaterDetailImage}
              height={320}
              source={computed(() =>
                loadGalleryBitmap(
                  repeaterSelection.value?.image ??
                    items[0]!.image,
                  700,
                ))}
              stretch={Stretch.UniformToFill}
              onLoaded={(sender) => {
                start('motion-repeater-forward', sender as Image)
              }}
            />
          </UI.StackPanel>
        </Show>
      </SampleCard>
    </Page>
  )
}
