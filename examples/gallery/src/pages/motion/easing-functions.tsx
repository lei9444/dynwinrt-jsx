import {
  onCleanup,
  signal,
  styles,
  theme,
  type Child,
} from 'dynwinrt-jsx'
import {
  BackEase,
  BounceEase,
  CircleEase,
  CubicEase,
  DoubleAnimation,
  EasingFunctionBase,
  EasingMode,
  ElasticEase,
  ExponentialEase,
  HorizontalAlignment,
  Orientation,
  PowerEase,
  QuadraticEase,
  QuarticEase,
  QuinticEase,
  SineEase,
  Storyboard,
  TranslateTransform,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  UI,
} from '../../gallery-ui'
import {
  Page,
  SampleCard,
} from '../../components/gallery-components'
import {
  MotionStatus,
  duration,
  releaseMotionResources,
  type MotionSettings,
  useMotionSettings,
} from './shared'

function EasingPreview(props: {
  readonly automationId: string
  readonly milliseconds: number
  readonly motion: MotionSettings
  readonly easing: () => EasingFunctionBase
  readonly onAnimate: (target: number) => void
  readonly options?: Child
  readonly title: string
  readonly description: string
  readonly code: string
}) {
  const transform = new TranslateTransform()
  const animation = new DoubleAnimation()
  animation.enableDependentAnimation = true
  animation.duration = duration(props.milliseconds)
  const storyboard = new Storyboard()
  Storyboard.setTarget(animation, transform)
  Storyboard.setTargetProperty(animation, 'X')
  storyboard.children.append(animation)

  const animate = () => {
    const next = transform.x > 0 ? 0 : 200
    if (!props.motion.enabled.value) {
      storyboard.stop()
      transform.x = next
    }
    else {
      animation.from = transform.x
      animation.to = next
      animation.easingFunction = props.easing()
      storyboard.begin()
    }
    props.onAnimate(next)
  }

  onCleanup(() => {
    let firstError: unknown
    try {
      storyboard.stop()
    }
    catch (error: unknown) {
      firstError = error
    }
    try {
      releaseMotionResources([
        storyboard,
        animation,
        transform,
      ])
    }
    catch (error: unknown) {
      firstError ??= error
    }
    if (firstError !== undefined) {
      throw firstError
    }
  })

  return (
    <SampleCard
      title={props.title}
      description={props.description}
      code={props.code}
      options={props.options}
    >
      <UI.StackPanel orientation={Orientation.Horizontal} spacing={16}>
        <UI.Button
          automationId={props.automationId}
          onClick={animate}
        >
          Animate
        </UI.Button>
        <UI.Rectangle
          width={50}
          height={50}
          fill={theme.accent}
          renderTransform={transform}
          horizontalAlignment={HorizontalAlignment.Left}
        />
      </UI.StackPanel>
    </SampleCard>
  )
}

export function EasingFunctionsPage(context: AppContext) {
  const motion = useMotionSettings()
  const standardResult = signal('Standard easing target: 0')
  const accelerateExponent = signal(4.5)
  const decelerateExponent = signal(7)
  const easingIndex = signal(0)
  const easingModeIndex = signal(0)
  const standard = new CircleEase()
  standard.easingMode = EasingMode.EaseInOut
  const accelerate = new ExponentialEase()
  accelerate.easingMode = EasingMode.EaseIn
  const decelerate = new ExponentialEase()
  decelerate.easingMode = EasingMode.EaseOut
  const namedEasings = [
    ['BackEase', new BackEase()],
    ['BounceEase', new BounceEase()],
    ['CircleEase', new CircleEase()],
    ['CubicEase', new CubicEase()],
    ['ElasticEase', new ElasticEase()],
    ['ExponentialEase', new ExponentialEase()],
    ['PowerEase', new PowerEase()],
    ['QuadraticEase', new QuadraticEase()],
    ['QuarticEase', new QuarticEase()],
    ['QuinticEase', new QuinticEase()],
    ['SineEase', new SineEase()],
  ] as const
  const easingModes = [
    EasingMode.EaseOut,
    EasingMode.EaseIn,
    EasingMode.EaseInOut,
  ] as const

  onCleanup(() => {
    releaseMotionResources([
      standard,
      accelerate,
      decelerate,
      ...namedEasings.map((entry) => entry[1]),
    ])
  })

  return (
    <Page
      title="Easing Functions"
      subtitle="Easing is a way to manipulate the velocity of an object as it animates."
      automationId="EasingFunctionsPageHeading"
      pageId="easing-functions"
      model={context.model}
    >
      <MotionStatus
        automationId="GalleryMotionEasingStatus"
        settings={motion}
      />
      <UI.TextBlock
        automationId="GalleryMotionEasingResult"
        text={standardResult}
      />
      <UI.StackPanel spacing={4}>
        <UI.TextBlock text="• Use the Standard easing function for animating general property changes." />
        <UI.TextBlock text="• Use the Accelerate easing function to animate objects that are exiting the scene." />
        <UI.TextBlock text="• Use the Decelerate easing function to animate objects that are entering the scene." />
      </UI.StackPanel>

      <EasingPreview
        title="Standard Easing Function"
        description="CircleEase with EaseInOut provides a balanced curve for general property changes."
        automationId="GalleryMotionEasingAnimate"
        milliseconds={500}
        motion={motion}
        easing={() => standard}
        onAnimate={(target) => {
          standardResult.value = `Standard easing target: ${target}`
          context.model.recordInteraction()
        }}
        code={`const easing = new CircleEase()
easing.easingMode = EasingMode.EaseInOut
animation.easingFunction = easing
storyboard.begin()`}
      />

      <EasingPreview
        title="Accelerate Easing Function"
        description="ExponentialEase with EaseIn accelerates an object as it exits the scene."
        automationId="GalleryMotionEasingAccelerate"
        milliseconds={150}
        motion={motion}
        easing={() => {
          accelerate.exponent = accelerateExponent.value
          return accelerate
        }}
        onAnimate={() => context.model.recordInteraction()}
        code={`const easing = new ExponentialEase()
easing.easingMode = EasingMode.EaseIn
easing.exponent = ${accelerateExponent.value}
animation.easingFunction = easing`}
        options={
          <UI.NumberBox
            automationName="Accelerate easing exponent"
            header="Exponent"
            value={accelerateExponent}
            onValueChanged={(sender) => {
              accelerateExponent.value = Number.isNaN(sender.value)
                ? 0
                : sender.value
            }}
          />
        }
      />

      <EasingPreview
        title="Decelerate Easing Function"
        description="ExponentialEase with EaseOut decelerates an object as it enters the scene."
        automationId="GalleryMotionEasingDecelerate"
        milliseconds={300}
        motion={motion}
        easing={() => {
          decelerate.exponent = decelerateExponent.value
          return decelerate
        }}
        onAnimate={() => context.model.recordInteraction()}
        code={`const easing = new ExponentialEase()
easing.easingMode = EasingMode.EaseOut
easing.exponent = ${decelerateExponent.value}
animation.easingFunction = easing`}
        options={
          <UI.NumberBox
            automationName="Decelerate easing exponent"
            header="Exponent"
            value={decelerateExponent}
            onValueChanged={(sender) => {
              decelerateExponent.value = Number.isNaN(sender.value)
                ? 0
                : sender.value
            }}
          />
        }
      />

      <EasingPreview
        title="Other XAML Easing Functions"
        description="Compare the standard WinUI easing curves with EaseOut, EaseIn, or EaseInOut interpolation."
        automationId="GalleryMotionEasingOther"
        milliseconds={500}
        motion={motion}
        easing={() => {
          const easing =
            namedEasings[easingIndex.value]?.[1] ??
            namedEasings[0]![1]
          easing.easingMode =
            easingModes[easingModeIndex.value] ??
            EasingMode.EaseOut
          return easing
        }}
        onAnimate={() => context.model.recordInteraction()}
        code={`const easing = new ${namedEasings[easingIndex.value]?.[0] ?? 'BackEase'}()
easing.easingMode = EasingMode.${
  ['EaseOut', 'EaseIn', 'EaseInOut'][
    easingModeIndex.value
  ] ?? 'EaseOut'
}
animation.easingFunction = easing
storyboard.begin()`}
        options={
          <UI.StackPanel spacing={12}>
            <GalleryComboBox
              automationName="Easing type"
              selectedIndex={easingIndex}
              onSelectedIndexChange={(index) => {
                easingIndex.value = index
              }}
            >
              {namedEasings.map(([name]) => (
                <UI.TextBlock key={name} text={name} />
              ))}
            </GalleryComboBox>
            <UI.StackPanel spacing={4}>
              {['EaseOut', 'EaseIn', 'EaseInOut'].map(
                (name, index) => (
                  <UI.RadioButton
                    key={name}
                    groupName="MotionEasingMode"
                    content={name}
                    isChecked={easingModeIndex.value === index}
                    onChecked={() => {
                      easingModeIndex.value = index
                    }}
                  />
                ),
              )}
            </UI.StackPanel>
          </UI.StackPanel>
        }
      />
    </Page>
  )
}
