import {
  computed,
  createCompositionOwner,
  effect,
  onCleanup,
  signal,
  styles,
  theme,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  CompositionTarget,
  Ellipse,
  Grid,
  HorizontalAlignment,
  ICompositionAnimationBase,
  Orientation,
  Popup,
  Rectangle,
  releaseProjected,
  TextBlock,
  TextWrapping,
  UIElement,
  VerticalAlignment,
} from '#winapp/bindings'
import {
  type AppContext,
  type ButtonInstance,
  type SliderInstance,
  UI,
} from '../../gallery-ui'
import {
  Page,
  SampleCard,
} from '../../components/gallery-components'
import {
  MotionStatus,
  timeSpan,
  useMotionSettings,
} from './shared'

const lorem =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'

export function AnimationInteropPage(context: AppContext) {
  const motion = useMotionSettings()
  const animations = createCompositionOwner({
    releaseProjected,
  })
  const compositor = animations.ownProjected(
    CompositionTarget.getCompositorForCurrentThread(),
  )
  const dampingIndex = signal(2)
  const period = signal(50)
  const radius = signal(200)
  const fontSize = signal(12)
  const textMargin = signal(0)
  const springResult = signal('Spring scale target: 1.0')
  const springButton: RefObject<ButtonInstance> = { current: null }
  const periodSlider: RefObject<SliderInstance> = { current: null }
  const radiusSlider: RefObject<SliderInstance> = { current: null }
  const fontSizeSlider: RefObject<SliderInstance> = { current: null }
  const textMarginSlider: RefObject<SliderInstance> = { current: null }
  const springTargets = new Map<UIElement, number>()
  const spring = animations.ownCloseable(
    compositor.createSpringVector3Animation(),
  )
  spring.target = 'Scale'
  const springBase = animations.ownProjected(
    spring.as(ICompositionAnimationBase),
  )

  const inverseSource: RefObject<Rectangle> = { current: null }
  const inverseTarget: RefObject<Ellipse> = { current: null }
  let inverseAnimation:
    ReturnType<typeof compositor.createExpressionAnimation> | null = null

  const stackedButtons: Array<ButtonInstance | null> =
    Array.from({ length: 4 }, () => null)
  const stackedAnimations: Array<
    ReturnType<typeof compositor.createExpressionAnimation>
  > = []

  const circlePanel: RefObject<Grid> = { current: null }
  const circleButtons: Array<ButtonInstance | null> =
    Array.from({ length: 8 }, () => null)
  const circleAnimations: Array<
    ReturnType<typeof compositor.createExpressionAnimation>
  > = []

  const popupTarget: RefObject<TextBlock> = { current: null }
  const popup: RefObject<Popup> = { current: null }
  let popupAnimation:
    ReturnType<typeof compositor.createExpressionAnimation> | null = null

  const dampingRatios = [0.2, 0.4, 0.6, 0.8] as const
  const requireMounted = <T,>(
    ref: RefObject<T>,
    label: string,
  ): T => {
    if (!ref.current) {
      throw new Error(`${label} is not mounted.`)
    }
    return ref.current
  }
  const requireStackedButton = (index: number) => {
    const button = stackedButtons[index]
    if (!button) {
      throw new Error(`Stacked button ${index + 1} is not mounted.`)
    }
    return button
  }
  const updateSpring = (finalValue: number) => {
    spring.finalValue = {
      x: finalValue,
      y: finalValue,
      z: finalValue,
    }
    spring.dampingRatio =
      dampingRatios[dampingIndex.value] ?? 0.6
    spring.period = timeSpan(period.value)
  }
  updateSpring(1)

  const startSpring = (
    element: UIElement,
    finalValue: number,
  ) => {
    springTargets.set(element, finalValue)
    if (!motion.enabled.value) {
      animations.stop(element, springBase)
      element.scale = {
        x: finalValue,
        y: finalValue,
        z: finalValue,
      }
      return
    }
    updateSpring(finalValue)
    animations.start(element, springBase)
  }

  const setupInverseAnimation = () => {
    if (
      inverseAnimation ||
      !inverseSource.current ||
      !inverseTarget.current
    ) {
      return
    }
    inverseAnimation = animations.ownCloseable(
      compositor.createExpressionAnimation(
        'Vector3(1/scaleElement.Scale.X, 1/scaleElement.Scale.Y, 1)',
      ),
    )
    inverseAnimation.target = 'Scale'
    inverseAnimation.setExpressionReferenceParameter(
      'scaleElement',
      inverseSource.current,
    )
    animations.start(
      inverseTarget.current,
      inverseAnimation,
    )
  }

  const setupStackedAnimations = () => {
    if (
      stackedAnimations.length > 0 ||
      stackedButtons.some((button) => !button)
    ) {
      return
    }
    for (let index = 1; index < stackedButtons.length; index += 1) {
      const above = stackedButtons[index - 1]!
      const current = stackedButtons[index]!
      const animation = animations.ownCloseable(
        compositor.createExpressionAnimation(
          '(above.Scale.Y - 1) * 50 + above.Translation.Y % (50 * index)',
        ),
      )
      animation.target = 'Translation.Y'
      animation.setExpressionReferenceParameter('above', above)
      animation.setScalarParameter('index', index)
      stackedAnimations.push(animation)
      animations.start(current, animation)
    }
  }

  const setupCircleAnimations = () => {
    if (
      circleAnimations.length > 0 ||
      !circlePanel.current ||
      circleButtons.some((button) => !button)
    ) {
      return
    }
    const expression =
      'Vector3((source.ActualSize.X / 2) * cos(.02 * (source.ActualSize.X / 2) + ((2 * Pi)/total)*index) + (source.ActualSize.X / 2), (source.ActualSize.X / 2) * sin(.02 * (source.ActualSize.X / 2) + ((2 * Pi)/total)*index), 0)'
    circleButtons.forEach((button, index) => {
      const animation = animations.ownCloseable(
        compositor.createExpressionAnimation(expression),
      )
      animation.target = 'Translation'
      animation.setScalarParameter('index', index + 1)
      animation.setScalarParameter(
        'total',
        circleButtons.length,
      )
      animation.setExpressionReferenceParameter(
        'source',
        circlePanel.current!,
      )
      circleAnimations.push(animation)
      animations.start(button!, animation)
    })
  }

  const setupPopupAnimation = () => {
    if (
      popupAnimation ||
      !popupTarget.current ||
      !popup.current
    ) {
      return
    }
    const xamlRoot =
      popupTarget.current.xamlRoot ??
      context.window.content?.xamlRoot
    if (!xamlRoot) {
      return
    }
    popup.current.xamlRoot = xamlRoot
    popupAnimation = animations.ownCloseable(
      compositor.createExpressionAnimation(
        'Vector3(source.ActualOffset.X + source.ActualSize.X, source.ActualOffset.Y + source.ActualSize.Y / 2 - 25, 0)',
      ),
    )
    popupAnimation.target = 'Translation'
    popupAnimation.setExpressionReferenceParameter(
      'source',
      popupTarget.current,
    )
    animations.start(popup.current, popupAnimation)
    popup.current.isOpen = true
  }

  effect(() => {
    if (!motion.enabled.value) {
      for (const [target, finalValue] of springTargets) {
        animations.stop(target, springBase)
        target.scale = {
          x: finalValue,
          y: finalValue,
          z: finalValue,
        }
      }
    }
  })

  onCleanup(() => {
    inverseAnimation = null
    popupAnimation = null
    springTargets.clear()
  })

  return (
    <Page
      title="Animation interop"
      subtitle="XAML and Composition interop allows you to animate elements using expressions, natural animations, and more."
      automationId="AnimationInteropPageHeading"
      pageId="animation-interop"
      model={context.model}
    >
      <MotionStatus
        automationId="GalleryMotionAnimationInteropStatus"
        settings={motion}
      />
      <UI.TextBlock
        automationId="GalleryMotionAnimationInteropResult"
        text={springResult}
      />

      <SampleCard
        title="Use a natural motion composition animation on a UIElement"
        description="Hover over the button to animate its scale. Change the spring damping ratio and period."
        code={`const compositor = CompositionTarget.getCompositorForCurrentThread()
const spring = compositor.createSpringVector3Animation()
spring.target = 'Scale'
spring.finalValue = { x: 1.5, y: 1.5, z: 1.5 }
spring.dampingRatio = 0.6
spring.period = { duration: 500000n }
button.startAnimation(spring)`}
        options={
          <UI.StackPanel spacing={12}>
            <UI.TextBlock text="Damping Ratio" />
            <UI.StackPanel orientation={Orientation.Horizontal} spacing={8}>
              {dampingRatios.map((value, index) => (
                <UI.RadioButton
                  key={value}
                  content={String(value)}
                  isChecked={computed(
                    () => dampingIndex.value === index,
                  )}
                  onChecked={() => {
                    dampingIndex.value = index
                  }}
                />
              ))}
            </UI.StackPanel>
            <UI.Slider
              ref={periodSlider}
              header="Period (in ms)"
              minimum={25}
              maximum={200}
              stepFrequency={25}
              tickFrequency={25}
              value={period}
              onValueChanged={() => {
                period.value = requireMounted(
                  periodSlider,
                  'Spring period slider',
                ).value
              }}
            />
          </UI.StackPanel>
        }
      >
        <UI.StackPanel spacing={12}>
          <UI.TextBlock text="Hover over the button to animate its scale." />
          <UI.Button
            ref={(value) => {
              if (!value && springButton.current) {
                animations.stopAll(springButton.current)
              }
              springButton.current = value
            }}
            automationId="GalleryMotionAnimationInteropSpring"
            width={100}
            height={50}
            onClick={() => {
              const target =
                springResult.value === 'Spring scale target: 1.0'
                  ? 1.5
                  : 1
              startSpring(
                requireMounted(springButton, 'Spring button'),
                target,
              )
              springResult.value =
                `Spring scale target: ${target.toFixed(1)}`
              context.model.recordInteraction()
            }}
            onPointerEntered={() =>
              startSpring(
                requireMounted(springButton, 'Spring button'),
                1.5,
              )}
            onPointerExited={() =>
              startSpring(
                requireMounted(springButton, 'Spring button'),
                1,
              )}
          >
            Item
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        title="ExpressionAnimation on an Ellipse element"
        description="Hover over the square. The circle scale is inversely related to the square scale."
        code={`const animation = compositor.createExpressionAnimation(
  'Vector3(1/scaleElement.Scale.X, 1/scaleElement.Scale.Y, 1)',
)
animation.target = 'Scale'
animation.setExpressionReferenceParameter('scaleElement', rectangle)
ellipse.startAnimation(animation)`}
      >
        <UI.StackPanel height={200} spacing={8}>
          <UI.TextBlock text="Hover over the square to animate its scale. Notice that the ellipse also animates." />
          <UI.Grid>
            <UI.Rectangle
              ref={(value) => {
                if (!value && inverseSource.current) {
                  animations.stopAll(inverseSource.current)
                }
                inverseSource.current = value
                setupInverseAnimation()
              }}
              width={50}
              height={50}
              fill={theme.accent}
              horizontalAlignment={HorizontalAlignment.Left}
              onPointerEntered={() =>
                startSpring(
                  requireMounted(inverseSource, 'Scale rectangle'),
                  1.5,
                )}
              onPointerExited={() =>
                startSpring(
                  requireMounted(inverseSource, 'Scale rectangle'),
                  1,
                )}
            />
            <UI.Ellipse
              ref={(value) => {
                if (!value && inverseTarget.current) {
                  animations.stopAll(inverseTarget.current)
                }
                inverseTarget.current = value
                setupInverseAnimation()
              }}
              width={50}
              height={50}
              margin={thickness(120, 0, 0, 0)}
              fill={theme.accent}
              horizontalAlignment={HorizontalAlignment.Left}
            />
          </UI.Grid>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        title="Driving several related animations together using ExpressionAnimation"
        description="Hover over any button. Each following button moves as a function of the previous button's scale and translation."
        code={`animation.expression =
  '(above.Scale.Y - 1) * 50 + above.Translation.Y % (50 * index)'
animation.target = 'Translation.Y'
animation.setExpressionReferenceParameter('above', previousButton)
animation.setScalarParameter('index', index)
button.startAnimation(animation)`}
      >
        <UI.StackPanel spacing={8}>
          {stackedButtons.map((_, index) => (
            <UI.Button
              key={index}
              ref={(value) => {
                if (!value && stackedButtons[index]) {
                  animations.stopAll(stackedButtons[index]!)
                }
                stackedButtons[index] = value
                setupStackedAnimations()
              }}
              width={100}
              height={50}
              onPointerEntered={() =>
                startSpring(requireStackedButton(index), 1.5)}
              onPointerExited={() =>
                startSpring(requireStackedButton(index), 1)}
            >
              {`Item ${index + 1}`}
            </UI.Button>
          ))}
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        title="Reference ActualSize in ExpressionAnimations to make novel layouts based on size"
        description="Eight buttons are positioned around a circle. Change the radius to resize the layout while the expressions remain live."
        code={`animation.expression =
  'Vector3(radius*cos(theta)+radius, radius*sin(theta), 0)'
animation.setScalarParameter('index', index + 1)
animation.setScalarParameter('total', 8)
animation.setExpressionReferenceParameter('source', layoutPanel)
button.startAnimation(animation)`}
        options={
          <UI.Slider
            ref={radiusSlider}
            header="Change radius"
            minimum={200}
            maximum={400}
            value={radius}
            onValueChanged={() => {
              radius.value = requireMounted(
                radiusSlider,
                'Circle radius slider',
              ).value
            }}
          />
        }
      >
        <UI.Grid
          ref={(value) => {
            circlePanel.current = value
            setupCircleAnimations()
          }}
          width={radius}
          height={radius}
          margin={thickness(12)}
        >
          {circleButtons.map((_, index) => (
            <UI.Button
              key={index}
              ref={(value) => {
                if (!value && circleButtons[index]) {
                  animations.stopAll(circleButtons[index]!)
                }
                circleButtons[index] = value
                setupCircleAnimations()
              }}
              automationName={`Button ${index}`}
              content="Button"
              verticalAlignment={VerticalAlignment.Center}
            />
          ))}
        </UI.Grid>
      </SampleCard>

      <SampleCard
        title="Reference ActualOffset and ActualSize in ExpressionAnimations to position elements relative to each other"
        description="The popup remains right-aligned and vertically centered to text whose size changes."
        code={`animation.expression =
  'Vector3(source.ActualOffset.X + source.ActualSize.X, source.ActualOffset.Y + source.ActualSize.Y / 2 - 25, 0)'
animation.target = 'Translation'
animation.setExpressionReferenceParameter('source', popupTarget)
popup.startAnimation(animation)
popup.isOpen = true`}
        options={
          <UI.StackPanel minWidth={170} spacing={12}>
            <UI.Slider
              ref={fontSizeSlider}
              header="Change font size"
              minimum={12}
              maximum={24}
              value={fontSize}
              onValueChanged={() => {
                fontSize.value = requireMounted(
                  fontSizeSlider,
                  'Popup font size slider',
                ).value
              }}
            />
            <UI.Slider
              ref={textMarginSlider}
              header="Change text margin"
              minimum={0}
              maximum={100}
              value={textMargin}
              onValueChanged={() => {
                textMargin.value = requireMounted(
                  textMarginSlider,
                  'Popup margin slider',
                ).value
              }}
            />
          </UI.StackPanel>
        }
      >
        <UI.StackPanel spacing={12}>
          <UI.TextBlock
            text="This sample positions a popup relative to a block of text that has variable layout size based on font size."
            textWrapping={TextWrapping.Wrap}
          />
          <UI.Grid horizontalAlignment={HorizontalAlignment.Left}>
            <UI.TextBlock
              ref={(value) => {
                popupTarget.current = value
                setupPopupAnimation()
              }}
              onLoaded={setupPopupAnimation}
              automationId="GalleryMotionAnimationInteropPopupTarget"
              width={300}
              margin={computed(() =>
                thickness(textMargin.value))}
              fontSize={fontSize}
              text={lorem}
              textWrapping={TextWrapping.WrapWholeWords}
            />
            <UI.Popup
              ref={(value) => {
                if (!value && popup.current) {
                  popup.current.isOpen = false
                  animations.stopAll(popup.current)
                }
                popup.current = value
                setupPopupAnimation()
              }}
              margin={thickness(5)}
            >
              <UI.Border
                minWidth={50}
                minHeight={50}
                maxWidth={200}
                padding={thickness(6)}
                background={theme.cardBackground}
                borderBrush={theme.cardStroke}
                borderThickness={thickness(2)}
              >
                <UI.TextBlock
                  text="I am always right aligned center to the target."
                  textWrapping={TextWrapping.WrapWholeWords}
                />
              </UI.Border>
            </UI.Popup>
          </UI.Grid>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
