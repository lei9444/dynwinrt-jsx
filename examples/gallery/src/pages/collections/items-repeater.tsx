import {
  color,
  computed,
  createCompositionOwner,
  createNativeResourceOwner,
  createSolidColorBrush,
  gridLength,
  onCleanup,
  signal,
  styles,
  theme,
  thickness,
  type RefObject,
  type ReadonlySignal,
} from 'dynwinrt-jsx'
import {
  CompositionTarget,
  ElementCompositionPreview,
  HorizontalAlignment,
  ItemsRepeaterElementClearingEventArgs,
  ItemsRepeaterElementPreparedEventArgs,
  Orientation,
  releaseProjected,
  ScrollBarVisibility,
  ScrollViewer,
  SolidColorBrush,
  StackLayout,
  TextBox,
  TextWrapping,
  UniformGridLayout,
  VerticalAlignment,
  Visibility,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  GalleryItemsRepeater,
  LayoutGrid,
  UI,
} from '../../gallery-ui'
import {
  Page,
  SampleCard,
} from '../../components/gallery-components'

interface BarItem {
  readonly id: number
  readonly length: number
  readonly maxLength: number
  readonly height: number
  readonly maxHeight: number
  readonly diameter: number
  readonly maxDiameter: number
}

interface Recipe {
  readonly id: number
  readonly name: string
  readonly ingredients: readonly string[]
}

const mixedItems = [
  64,
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  128,
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  256,
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
  512,
  'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  1024,
] as const

const colorDefinitions = [
  ['Blue', 0, 90, 158],
  ['BlueViolet', 138, 43, 226],
  ['Crimson', 220, 20, 60],
  ['DarkCyan', 0, 139, 139],
  ['DarkGoldenrod', 184, 134, 11],
  ['DarkMagenta', 139, 0, 139],
  ['DarkOliveGreen', 85, 107, 47],
  ['DarkRed', 139, 0, 0],
  ['DarkSlateBlue', 72, 61, 139],
  ['DeepPink', 255, 20, 147],
  ['IndianRed', 205, 92, 92],
  ['MediumSlateBlue', 123, 104, 238],
  ['Maroon', 128, 0, 0],
  ['MidnightBlue', 25, 25, 112],
  ['Peru', 205, 133, 63],
  ['SaddleBrown', 139, 69, 19],
  ['SteelBlue', 70, 130, 180],
  ['OrangeRed', 255, 69, 0],
  ['Firebrick', 178, 34, 34],
  ['DarkKhaki', 189, 183, 107],
] as const

function prefersDarkText(
  red: number,
  green: number,
  blue: number,
): boolean {
  const channel = (value: number) => {
    const srgb = value / 255
    return srgb <= 0.04045
      ? srgb / 12.92
      : ((srgb + 0.055) / 1.055) ** 2.4
  }
  return (
    0.2126 * channel(red) +
    0.7152 * channel(green) +
    0.0722 * channel(blue)
  ) > 0.179
}

const fruits = [
  'Apricots',
  'Bananas',
  'Grapes',
  'Strawberries',
  'Watermelon',
  'Plums',
  'Blueberries',
] as const
const vegetables = [
  'Broccoli',
  'Spinach',
  'Sweet potato',
  'Cauliflower',
  'Onion',
  'Brussels sprouts',
  'Carrots',
] as const
const grains = [
  'Rice',
  'Quinoa',
  'Pasta',
  'Bread',
  'Farro',
  'Oats',
  'Barley',
] as const
const proteins = [
  'Steak',
  'Chicken',
  'Tofu',
  'Salmon',
  'Pork',
  'Chickpeas',
  'Eggs',
] as const
const extras = [
  'Garlic',
  'Lemon',
  'Butter',
  'Lime',
  'Feta Cheese',
  'Parmesan Cheese',
  'Breadcrumbs',
] as const

function createStackLayout(
  orientation: Orientation,
  spacing: number,
) {
  const layout = new StackLayout()
  layout.orientation = orientation
  layout.spacing = spacing
  return layout
}

function createBar(
  id: number,
  length: number,
  maxLength = 425,
): BarItem {
  return {
    id,
    length,
    maxLength,
    height: length / 4,
    maxHeight: maxLength / 4,
    diameter: length / 6,
    maxDiameter: maxLength / 6,
  }
}

function createRecipes(count: number): readonly Recipe[] {
  return Array.from({ length: count }, (_, id) => {
    const ingredients = [
      fruits[id % fruits.length]!,
      vegetables[(id * 3) % vegetables.length]!,
      grains[(id * 5) % grains.length]!,
      proteins[(id * 2) % proteins.length]!,
      ...Array.from(
        { length: id % 4 },
        (_, extraIndex) =>
          extras[(id + extraIndex) % extras.length]!,
      ),
    ]
    return {
      id,
      name: `Recipe ${id}`,
      ingredients,
    }
  })
}

function BarVisual(props: {
  readonly item: BarItem
  readonly layoutIndex: ReadonlySignal<number>
}) {
  const visibleWhen = (index: number) =>
    computed(() =>
      props.layoutIndex.value === index
        ? Visibility.Visible
        : Visibility.Collapsed,
    )

  return (
    <LayoutGrid automationName={`Bar ${props.item.id}`}>
      <UI.Border
        visibility={visibleWhen(0)}
        width={props.item.maxLength}
        height={24}
        background={theme.subtleFill}
      >
        <UI.Rectangle
          width={props.item.length}
          height={24}
          horizontalAlignment={HorizontalAlignment.Left}
          fill={theme.accent}
        />
      </UI.Border>

      <UI.Border
        visibility={visibleWhen(1)}
        width={48}
        height={props.item.maxHeight}
        background={theme.subtleFill}
      >
        <UI.Rectangle
          width={48}
          height={props.item.height}
          verticalAlignment={VerticalAlignment.Top}
          fill={theme.accent}
        />
      </UI.Border>

      <LayoutGrid
        visibility={visibleWhen(2)}
        width={props.item.maxDiameter}
        height={props.item.maxDiameter}
      >
        <UI.Ellipse
          width={props.item.maxDiameter}
          height={props.item.maxDiameter}
          horizontalAlignment={HorizontalAlignment.Center}
          verticalAlignment={VerticalAlignment.Center}
          fill={theme.subtleFill}
        />
        <UI.Ellipse
          width={props.item.diameter}
          height={props.item.diameter}
          horizontalAlignment={HorizontalAlignment.Center}
          verticalAlignment={VerticalAlignment.Center}
          fill={theme.accent}
        />
      </LayoutGrid>
    </LayoutGrid>
  )
}

export function ItemsRepeaterPage(context: AppContext) {
  const nativeResources = createNativeResourceOwner({
    releaseProjected,
  })
  const recipeFilterBox:
    RefObject<InstanceType<typeof TextBox>> = {
      current: null,
    }
  let nextBarId = 4
  const bars = signal<readonly BarItem[]>([
    createBar(1, 300),
    createBar(2, 25),
    createBar(3, 175),
  ])
  const layoutIndex = signal(0)
  const verticalLayout = nativeResources.ownProjected(
    createStackLayout(Orientation.Vertical, 8),
  )
  const horizontalLayout = nativeResources.ownProjected(
    createStackLayout(Orientation.Horizontal, 8),
  )
  const uniformLayout = nativeResources.ownProjected(
    new UniformGridLayout(),
  )
  uniformLayout.minRowSpacing = 8
  uniformLayout.minColumnSpacing = 8
  const layouts = [
    verticalLayout,
    horizontalLayout,
    uniformLayout,
  ] as const

  const virtualNumbers = signal(
    Array.from({ length: 500 }, (_, value) => value),
  )
  const virtualLayoutIndex = signal(1)
  const virtualUniformLayout = nativeResources.ownProjected(
    new UniformGridLayout(),
  )
  virtualUniformLayout.minItemWidth = 108
  virtualUniformLayout.minItemHeight = 108
  virtualUniformLayout.minRowSpacing = 12
  virtualUniformLayout.minColumnSpacing = 12
  const virtualStackLayout = nativeResources.ownProjected(
    createStackLayout(Orientation.Vertical, 12),
  )
  const virtualLayouts = [
    virtualUniformLayout,
    virtualStackLayout,
  ] as const

  const mixedLayout = nativeResources.ownProjected(
    new UniformGridLayout(),
  )
  mixedLayout.minItemWidth = 200
  mixedLayout.minItemHeight = 200
  mixedLayout.minRowSpacing = 8
  mixedLayout.minColumnSpacing = 8

  const categoryLayout = nativeResources.ownProjected(
    createStackLayout(Orientation.Vertical, 12),
  )
  const categories = [
    {
      id: 'fruits',
      title: 'Fruits',
      items: fruits,
      layout: nativeResources.ownProjected(
        createStackLayout(Orientation.Horizontal, 0),
      ),
    },
    {
      id: 'vegetables',
      title: 'Vegetables',
      items: vegetables,
      layout: nativeResources.ownProjected(
        createStackLayout(Orientation.Horizontal, 0),
      ),
    },
    {
      id: 'grains',
      title: 'Grains',
      items: grains,
      layout: nativeResources.ownProjected(
        createStackLayout(Orientation.Horizontal, 0),
      ),
    },
    {
      id: 'proteins',
      title: 'Proteins',
      items: proteins,
      layout: nativeResources.ownProjected(
        createStackLayout(Orientation.Horizontal, 0),
      ),
    },
  ] as const

  const blackTextBrush = nativeResources.ownProjected(
    createSolidColorBrush(
      SolidColorBrush,
      color(0, 0, 0),
    ),
  )
  const whiteTextBrush = nativeResources.ownProjected(
    createSolidColorBrush(
      SolidColorBrush,
      color(255, 255, 255),
    ),
  )
  const swatches = colorDefinitions.map(
    ([name, red, green, blue]) => ({
      name,
      brush: nativeResources.ownProjected(
        createSolidColorBrush(
          SolidColorBrush,
          color(red, green, blue),
        ),
      ),
      foreground: prefersDarkText(red, green, blue)
        ? blackTextBrush
        : whiteTextBrush,
    }),
  )
  const selectedColorName = signal(swatches[0]!.name)
  const selectedColorBrush = signal(swatches[0]!.brush)
  const animatedLayout = nativeResources.ownProjected(
    createStackLayout(Orientation.Vertical, 0),
  )
  const animatedScrollViewer:
    RefObject<InstanceType<typeof ScrollViewer>> = {
      current: null,
    }
  const animations = createCompositionOwner({
    releaseProjected,
  })
  const compositor = animations.ownProjected(
    CompositionTarget.getCompositorForCurrentThread(),
  )
  const animatedElements = new Map<
    string,
    {
      readonly visual: ReturnType<
        typeof ElementCompositionPreview.getElementVisual
      >
      readonly scale: ReturnType<
        typeof compositor.createExpressionAnimation
      >
      readonly center: ReturnType<
        typeof compositor.createExpressionAnimation
      >
    }
  >()
  let scrollVisual:
    ReturnType<
      typeof ElementCompositionPreview.getElementVisual
    > | null = null
  let scrollProperties:
    ReturnType<
      typeof ElementCompositionPreview
        .getScrollViewerManipulationPropertySet
    > | null = null

  const prepareAnimatedElement = (
    args: ItemsRepeaterElementPreparedEventArgs,
  ) => {
    const scrollViewer = animatedScrollViewer.current
    if (!scrollViewer) {
      return
    }
    const element = args.element
    const key = String(
      Reflect.get(element, '_obj') ?? element,
    )
    try {
      const previous = animatedElements.get(key)
      if (previous) {
        animations.stopAll(previous.visual)
        animations.release(previous.scale)
        animations.release(previous.center)
        animations.release(previous.visual)
        animatedElements.delete(key)
      }
      scrollVisual ??= animations.ownProjected(
        ElementCompositionPreview.getElementVisual(scrollViewer),
      )
      scrollProperties ??= animations.ownProjected(
        ElementCompositionPreview
          .getScrollViewerManipulationPropertySet(scrollViewer),
      )
      const visual = animations.ownProjected(
        ElementCompositionPreview.getElementVisual(element),
      )
      const scale = animations.ownCloseable(
        compositor.createExpressionAnimation(
          '1 - Abs((scrollVisual.Size.Y / 2 - scrollProperties.Translation.Y) - (item.Offset.Y + item.Size.Y / 2)) * (0.25 / (scrollVisual.Size.Y / 2))',
        ),
      )
      scale.setReferenceParameter('scrollVisual', scrollVisual)
      scale.setReferenceParameter(
        'scrollProperties',
        scrollProperties,
      )
      scale.setReferenceParameter('item', visual)
      const center = animations.ownCloseable(
        compositor.createExpressionAnimation(
          'Vector3(item.Size.X / 2, item.Size.Y / 2, 0)',
        ),
      )
      center.setReferenceParameter('item', visual)
      animations.startProperty(visual, 'Scale.X', scale)
      animations.startProperty(visual, 'Scale.Y', scale)
      animations.startProperty(visual, 'CenterPoint', center)
      animatedElements.set(key, {
        visual,
        scale,
        center,
      })
    }
    finally {
      releaseProjected(element)
    }
  }

  const clearAnimatedElement = (
    args: ItemsRepeaterElementClearingEventArgs,
  ) => {
    const element = args.element
    const key = String(
      Reflect.get(element, '_obj') ?? element,
    )
    try {
      const state = animatedElements.get(key)
      if (!state) {
        return
      }
      animations.stopAll(state.visual)
      animations.release(state.scale)
      animations.release(state.center)
      animations.release(state.visual)
      animatedElements.delete(key)
    }
    finally {
      releaseProjected(element)
    }
  }
  onCleanup(() => {
    animatedElements.clear()
    scrollVisual = null
    scrollProperties = null
  })

  const recipes = createRecipes(1000)
  const recipeFilter = signal('')
  const sortDescending = signal(false)
  const filteredRecipes = computed(() => {
    const query = recipeFilter.value.trim().toLowerCase()
    const filtered = query
      ? recipes.filter((recipe) =>
        recipe.ingredients.some((ingredient) =>
          ingredient.toLowerCase().includes(query),
        ),
      )
      : recipes
    return [...filtered].sort((left, right) => {
      const difference =
        left.ingredients.length - right.ingredients.length
      return sortDescending.value ? -difference : difference
    })
  })
  const recipeLayout = nativeResources.ownProjected(
    new UniformGridLayout(),
  )
  recipeLayout.minItemWidth = 200
  recipeLayout.minItemHeight = 108
  recipeLayout.minRowSpacing = 12
  recipeLayout.minColumnSpacing = 12

  return (
    <Page
      title="ItemsRepeater"
      subtitle="Create flexible virtualized layouts without built-in selection or interaction policy."
      automationId="ItemsRepeaterPageHeading"
      pageId="items-repeater"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryCollectionsItemsRepeaterSample"
        title="Basic, non-interactive items"
        description="Add and remove bars, then switch both layout and item visual between horizontal bars, vertical bars, and circles."
        code={`
<GalleryItemsRepeater
  each={bars}
  key={(bar) => bar.id}
  layout={computed(() => layouts[layoutIndex.value])}
>
  {(bar) => <BarVisual bar={bar} layoutIndex={layoutIndex} />}
</GalleryItemsRepeater>
        `}
        options={
          <UI.StackPanel spacing={12}>
            <UI.Button
              automationId="GalleryCollectionsRepeaterAdd"
              minWidth={150}
              onClick={() => {
                const id = nextBarId
                nextBarId += 1
                const length = 25 + ((id * 137) % 400)
                bars.value = [
                  ...bars.value,
                  createBar(id, length),
                ]
                context.model.recordInteraction()
              }}
            >
              Add Item
            </UI.Button>
            <UI.Button
              minWidth={150}
              isEnabled={computed(() => bars.value.length > 0)}
              onClick={() => {
                if (bars.value.length === 0) {
                  return
                }
                bars.value = bars.value.slice(1)
                context.model.recordInteraction()
              }}
            >
              Remove Item
            </UI.Button>
            <GalleryComboBox
              header={<UI.TextBlock text="Layout" />}
              selectedIndex={layoutIndex}
              onSelectedIndexChange={(index) => {
                layoutIndex.value = index
                context.model.recordInteraction()
              }}
              minWidth={220}
            >
              <UI.TextBlock text="StackLayout - Vertical" />
              <UI.TextBlock text="StackLayout - Horizontal" />
              <UI.TextBlock text="UniformGridLayout" />
            </GalleryComboBox>
          </UI.StackPanel>
        }
      >
        <UI.ScrollViewer
          maxHeight={500}
          horizontalScrollBarVisibility={ScrollBarVisibility.Auto}
          verticalScrollBarVisibility={ScrollBarVisibility.Auto}
        >
          <GalleryItemsRepeater
            each={bars}
            key={(bar) => bar.id}
            layout={computed(
              () => layouts[layoutIndex.value] ?? verticalLayout,
            )}
            maxWidth={computed(() => {
              if (layoutIndex.value === 0) {
                return 437
              }
              if (layoutIndex.value === 2) {
                return 540
              }
              return 6000
            })}
            horizontalAlignment={HorizontalAlignment.Left}
          >
            {(bar) => (
              <BarVisual
                item={bar}
                layoutIndex={layoutIndex}
              />
            )}
          </GalleryItemsRepeater>
        </UI.ScrollViewer>
      </SampleCard>

      <SampleCard
        automationId="GalleryCollectionsVirtualizedRepeaterSample"
        title="Virtualizing 500 scrollable items"
        description="The projected source contains 500 keyed items, while ItemsRepeater realizes only the viewport and cache region."
        code={`
<GalleryItemsRepeater
  each={numbers}
  key={(number) => number}
  layout={layout}
>
  {(number) => <NumberTile value={number} />}
</GalleryItemsRepeater>
        `}
        options={
          <UI.StackPanel spacing={12}>
            <GalleryComboBox
              header={<UI.TextBlock text="Layout" />}
              selectedIndex={virtualLayoutIndex}
              onSelectedIndexChange={(index) => {
                virtualLayoutIndex.value = index
                context.model.recordInteraction()
              }}
              minWidth={210}
            >
              <UI.TextBlock text="Uniform grid" />
              <UI.TextBlock text="Stack layout" />
            </GalleryComboBox>
            <UI.Button
              automationId="GalleryCollectionsRepeaterReverse"
              onClick={() => {
                virtualNumbers.value =
                  [...virtualNumbers.value].reverse()
                context.model.recordInteraction()
              }}
            >
              Reverse 500 items
            </UI.Button>
          </UI.StackPanel>
        }
      >
        <UI.ScrollViewer
          height={400}
          padding={thickness(0, 0, 16, 0)}
          verticalScrollBarVisibility={ScrollBarVisibility.Auto}
        >
          <GalleryItemsRepeater
            each={virtualNumbers}
            key={(number) => number}
            layout={computed(
              () =>
                virtualLayouts[virtualLayoutIndex.value] ??
                virtualStackLayout,
            )}
            verticalCacheLength={0.5}
            margin={thickness(0, 0, 12, 0)}
            horizontalAlignment={HorizontalAlignment.Stretch}
          >
            {(number) => (
              <UI.Border
                width={computed(() =>
                  virtualLayoutIndex.value === 0 ? 108 : 480,
                )}
                minHeight={computed(() =>
                  virtualLayoutIndex.value === 0 ? 108 : 56,
                )}
                padding={thickness(12)}
                background={
                  number % 2 === 0
                    ? theme.controlFillSecondary
                    : theme.accent
                }
              >
                <UI.TextBlock
                  horizontalAlignment={HorizontalAlignment.Center}
                  verticalAlignment={VerticalAlignment.Center}
                  foreground={
                    number % 2 === 0
                      ? theme.primaryText
                      : theme.textOnAccent
                  }
                  text={String(number)}
                />
              </UI.Border>
            )}
          </GalleryItemsRepeater>
        </UI.ScrollViewer>
      </SampleCard>

      <SampleCard
        title="Mixed-type collection"
        description="A type-aware element factory gives integers and strings distinct visuals in the same UniformGridLayout."
        code={`
<GalleryItemsRepeater each={mixedItems} layout={mixedLayout}>
  {(item) => typeof item === 'number'
    ? <IntegerTemplate value={item} />
    : <StringTemplate value={item} />}
</GalleryItemsRepeater>
        `}
      >
        <UI.StackPanel spacing={12}>
          <UI.TextBlock
            text="This ItemsRepeater displays both integer and string items, choosing the visual from each item's runtime type."
            textWrapping={TextWrapping.Wrap}
          />
          <GalleryItemsRepeater
            each={mixedItems}
            key={(item, index) =>
              `${typeof item}:${String(item)}:${index}`
            }
            layout={mixedLayout}
            margin={thickness(0, 0, 12, 0)}
            horizontalAlignment={HorizontalAlignment.Stretch}
          >
            {(item) => (
              <UI.Border
                minWidth={200}
                minHeight={200}
                margin={thickness(10)}
                padding={thickness(10)}
                background={
                  typeof item === 'string'
                    ? theme.accent
                    : theme.controlFillSecondary
                }
              >
                <UI.TextBlock
                  {...styles.heading({
                    level:
                      typeof item === 'number'
                        ? 'title'
                        : 'bodyStrong',
                  })}
                  horizontalAlignment={HorizontalAlignment.Center}
                  verticalAlignment={VerticalAlignment.Center}
                  foreground={
                    typeof item === 'string'
                      ? theme.textOnAccent
                      : theme.primaryText
                  }
                  text={String(item)}
                  textWrapping={TextWrapping.Wrap}
                />
              </UI.Border>
            )}
          </GalleryItemsRepeater>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        title="Nested ItemsRepeaters"
        description="The outer vertical repeater owns category rows, while every category owns an independent horizontal repeater."
        code={`
<GalleryItemsRepeater each={categories} layout={verticalLayout}>
  {(category) => (
    <GalleryItemsRepeater
      each={category.items}
      layout={horizontalLayout}
    />
  )}
</GalleryItemsRepeater>
        `}
      >
        <UI.ScrollViewer
          horizontalScrollBarVisibility={ScrollBarVisibility.Auto}
          verticalScrollBarVisibility={ScrollBarVisibility.Disabled}
        >
          <GalleryItemsRepeater
            each={categories}
            key={(category) => category.id}
            layout={categoryLayout}
            verticalAlignment={VerticalAlignment.Top}
          >
            {(category) => (
              <UI.StackPanel spacing={0}>
                <UI.TextBlock
                  {...styles.heading({ level: 'title' })}
                  padding={thickness(8)}
                  text={category.title}
                />
                <GalleryItemsRepeater
                  each={category.items}
                  key={(item) => item}
                  layout={category.layout}
                >
                  {(item) => (
                    <UI.Border
                      margin={thickness(10)}
                      padding={thickness(10)}
                      background={theme.accent}
                    >
                      <UI.TextBlock
                        foreground={theme.textOnAccent}
                        text={item}
                      />
                    </UI.Border>
                  )}
                </GalleryItemsRepeater>
              </UI.StackPanel>
            )}
          </GalleryItemsRepeater>
        </UI.ScrollViewer>
      </SampleCard>

      <SampleCard
        title="Scrolling content display"
        description="The original focusable color list, center-weighted composition scaling, and linked preview are preserved."
        code={`
<GalleryItemsRepeater each={colors} layout={stackLayout}>
  {(color) => (
    <UI.Button onClick={() => selected.value = color.brush}>
      {color.name}
    </UI.Button>
  )}
</GalleryItemsRepeater>
        `}
      >
        <LayoutGrid
          columnDefinitions={[
            gridLength.star(),
            gridLength.star(),
          ]}
        >
          <UI.ScrollViewer
            ref={animatedScrollViewer}
            width={250}
            height={175}
            horizontalAlignment={HorizontalAlignment.Left}
          >
            <GalleryItemsRepeater
              each={swatches}
              key={(swatch) => swatch.name}
              layout={animatedLayout}
              onElementPrepared={(_sender, args) => {
                prepareAnimatedElement(args)
              }}
              onElementClearing={(_sender, args) => {
                clearAnimatedElement(args)
              }}
            >
              {(swatch) => (
                <UI.Button
                  horizontalAlignment={HorizontalAlignment.Stretch}
                  automationName={computed(() =>
                    selectedColorName.value === swatch.name
                      ? `${swatch.name}, selected`
                      : swatch.name,
                  )}
                  background={swatch.brush}
                  foreground={swatch.foreground}
                  onClick={() => {
                    selectedColorName.value = swatch.name
                    selectedColorBrush.value = swatch.brush
                    context.model.recordInteraction()
                  }}
                >
                  {swatch.name}
                </UI.Button>
              )}
            </GalleryItemsRepeater>
          </UI.ScrollViewer>
          <UI.Rectangle
            gridColumn={1}
            width={150}
            height={150}
            margin={thickness(10, 0, 0, 0)}
            automationName="ColorRectangle"
            fill={selectedColorBrush}
            stroke={theme.primaryText}
            strokeThickness={1}
          />
        </LayoutGrid>
      </SampleCard>

      <SampleCard
        title="Content-heavy virtualized layout"
        description="Filter and sort a 1,000-recipe keyed source while the available UniformGridLayout keeps realization bounded."
        code={`
const filtered = computed(() =>
  recipes
    .filter(matchesIngredient)
    .sort(compareIngredientCount))

<GalleryItemsRepeater
  each={filtered}
  key={(recipe) => recipe.id}
  layout={uniformGridLayout}
/>
        `}
        output={
          <UI.TextBlock
            text={computed(
              () => `${filteredRecipes.value.length} results`,
            )}
          />
        }
        options={
          <UI.StackPanel spacing={10}>
            <UI.TextBox
              ref={recipeFilterBox}
              width={200}
              horizontalAlignment={HorizontalAlignment.Left}
              header="Filter by ingredient..."
              placeholderText="For example: lemon"
              text={recipeFilter}
              onTextChanged={() => {
                const text = recipeFilterBox.current?.text
                if (text !== undefined) {
                  recipeFilter.value = text
                  context.model.recordInteraction()
                }
              }}
            />
            <UI.TextBlock text="Sort by number of ingredients" />
            <UI.Button
              onClick={() => {
                sortDescending.value = false
                context.model.recordInteraction()
              }}
            >
              Least to most
            </UI.Button>
            <UI.Button
              onClick={() => {
                sortDescending.value = true
                context.model.recordInteraction()
              }}
            >
              Most to least
            </UI.Button>
          </UI.StackPanel>
        }
      >
        <UI.ScrollViewer
          height={600}
          verticalScrollBarVisibility={ScrollBarVisibility.Auto}
        >
          <GalleryItemsRepeater
            each={filteredRecipes}
            key={(recipe) => recipe.id}
            layout={recipeLayout}
            verticalCacheLength={0.5}
          >
            {(recipe) => (
              <UI.Border
                width={200}
                margin={thickness(5)}
                borderBrush={theme.cardStroke}
                borderThickness={thickness(1)}
                background={theme.cardBackground}
              >
                <UI.StackPanel>
                  <UI.Border
                    height={75}
                    margin={thickness(8)}
                    background={
                      swatches[recipe.id % swatches.length]!.brush
                    }
                    opacity={0.8}
                  >
                    <UI.TextBlock
                      fontSize={35}
                      horizontalAlignment={HorizontalAlignment.Center}
                      verticalAlignment={VerticalAlignment.Center}
                      foreground={
                        swatches[recipe.id % swatches.length]!
                          .foreground
                      }
                      text={String(recipe.id)}
                    />
                  </UI.Border>
                  <UI.TextBlock
                    {...styles.heading({ level: 'title' })}
                    margin={thickness(15, 0, 10, 0)}
                    text={recipe.name}
                    textWrapping={TextWrapping.Wrap}
                  />
                  <UI.TextBlock
                    margin={thickness(15, 0, 15, 15)}
                    foreground={theme.secondaryText}
                    text={`\n${recipe.ingredients.join('\n')}`}
                    textWrapping={TextWrapping.Wrap}
                  />
                </UI.StackPanel>
              </UI.Border>
            )}
          </GalleryItemsRepeater>
        </UI.ScrollViewer>
      </SampleCard>
    </Page>
  )
}
