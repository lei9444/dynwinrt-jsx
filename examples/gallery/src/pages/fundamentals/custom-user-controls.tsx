import {
  computed,
  signal,
  styles,
  theme,
  type RefObject,
  type Signal,
} from 'dynwinrt-jsx'
import {
  AutomationLiveSetting,
  HorizontalAlignment,
  Orientation,
  TextWrapping,
  Visibility,
} from '#winapp/bindings'
import {
  type AppContext,
  type PasswordBoxInstance,
  type TextBoxInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import {
  BulletList,
  GuidanceSection,
  GuidanceText,
} from './shared'

type CounterMode = 'Increment' | 'Decrement'

function CounterControl(props: {
  readonly mode: CounterMode
  readonly count: Signal<number>
  readonly automationId: string
  readonly onInteraction: () => void
}) {
  const direction = props.mode === 'Increment' ? 1 : -1
  const action = props.mode === 'Increment'
    ? 'Increase'
    : 'Decrease'
  return (
    <UI.StackPanel
      horizontalAlignment={HorizontalAlignment.Left}
      spacing={8}
    >
      <UI.TextBlock
        automationId={`${props.automationId}Value`}
        automationLiveSetting={AutomationLiveSetting.Polite}
        automationName="Counter value"
        fontSize={20}
        text={computed(() => String(props.count.value))}
        horizontalAlignment={HorizontalAlignment.Center}
      />
      <UI.Button
        automationId={props.automationId}
        automationName={`${action} counter`}
        minWidth={100}
        horizontalAlignment={HorizontalAlignment.Center}
        onClick={() => {
          props.count.value += direction
          props.onInteraction()
        }}
      >
        {action}
      </UI.Button>
    </UI.StackPanel>
  )
}

export function CustomUserControlsPage(context: AppContext) {
  const incrementCount = signal(0)
  const decrementCount = signal(0)
  const password = signal('')
  const passwordBox: RefObject<PasswordBoxInstance> = {
    current: null,
  }
  const temperatureInput: RefObject<TextBoxInstance> = {
    current: null,
  }
  const temperatureText = signal('')
  const temperatureResult = signal('')
  const passwordHasMinimumLength = computed(
    () => password.value.length >= 8,
  )
  const passwordHasUppercase = computed(
    () => /[A-Z]/.test(password.value),
  )
  const passwordHasNumber = computed(
    () => /\d/.test(password.value),
  )
  const passwordIsValid = computed(
    () =>
      passwordHasMinimumLength.value &&
      passwordHasUppercase.value &&
      passwordHasNumber.value,
  )
  const passwordValidation = computed(() => {
    if (!password.value) {
      return ''
    }
    if (passwordIsValid.value) {
      return '✓ Password is valid'
    }
    const messages: string[] = []
    if (!passwordHasUppercase.value) {
      messages.push('✕ Missing uppercase')
    }
    if (!passwordHasNumber.value) {
      messages.push('✕ Missing number')
    }
    if (!passwordHasMinimumLength.value) {
      messages.push('✕ Too short!')
    }
    return messages.join('\n')
  })

  return (
    <Page
      title="Custom & User Controls"
      subtitle="Create reusable UI components with custom functionality and appearance."
      automationId="CustomUserControlsPageHeading"
      pageId="custom-user-controls"
      model={context.model}
    >
      <GuidanceSection title="Custom (templated) control">
        <GuidanceText text="A custom control is a reusable component derived from Control. It encapsulates behavior and supports templating, styling, and theming." />
        <BulletList
          items={[
            'Define a reusable default visual structure and theme-aware resources.',
            'Keep behavior and UI logic encapsulated so the control can be reused across applications.',
            'Expose bindable properties for state that callers need to read or control.',
          ]}
        />
        <GuidanceText text="In dynwinrt-jsx, a function component owns the corresponding native subtree, signals, events, and cleanup scope." />
      </GuidanceSection>

      <SampleCard
        automationId="GalleryCustomControlsSample"
        title="Counter controls with increment and decrement modes"
        description="Two reusable component instances share the same implementation but own independent state and action behavior."
        code={`
<CounterControl mode="Increment" count={incrementCount} />
<CounterControl mode="Decrement" count={decrementCount} />
        `}
        output={
          <UI.TextBlock
            automationId="GalleryCustomControlStatus"
            text={computed(
              () =>
                `Increment count: ${incrementCount.value}; Decrement count: ${decrementCount.value}`,
            )}
          />
        }
      >
        <UI.StackPanel
          orientation={Orientation.Horizontal}
          spacing={24}
        >
          <CounterControl
            mode="Increment"
            count={incrementCount}
            automationId="GalleryCustomControlIncrement"
            onInteraction={() => context.model.recordInteraction()}
          />
          <CounterControl
            mode="Decrement"
            count={decrementCount}
            automationId="GalleryCustomControlDecrement"
            onInteraction={() => context.model.recordInteraction()}
          />
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GalleryCustomValidatedPasswordSample"
        title="A custom password control with validation"
        description="The component combines a native PasswordBox, validation rules, a polite live region, and a bindable validity signal."
        code={`
const isValid = computed(() =>
  password.value.length >= 8 &&
  /[A-Z]/.test(password.value) &&
  /\\d/.test(password.value))

<UI.Button isEnabled={isValid}>Submit</UI.Button>
        `}
      >
        <UI.StackPanel spacing={8}>
          <UI.PasswordBox
            ref={passwordBox}
            automationId="GalleryCustomPasswordInput"
            width={240}
            horizontalAlignment={HorizontalAlignment.Left}
            header="Password"
            placeholderText="Enter password..."
            onPasswordChanged={() => {
              password.value =
                passwordBox.current?.password ?? ''
              context.model.recordInteraction()
            }}
          />
          <UI.TextBlock
            automationId="GalleryCustomPasswordValidation"
            automationLiveSetting={AutomationLiveSetting.Polite}
            foreground={computed(() =>
              passwordIsValid.value
                ? theme.systemSuccess
                : theme.systemCritical,
            )}
            text={passwordValidation}
            textWrapping={TextWrapping.Wrap}
            visibility={computed(() =>
              password.value
                ? Visibility.Visible
                : Visibility.Collapsed,
            )}
          />
          <UI.Button
            automationId="GalleryCustomPasswordSubmit"
            width={240}
            horizontalAlignment={HorizontalAlignment.Left}
            isEnabled={passwordIsValid}
            {...styles.button({ variant: 'accent' })}
          >
            Submit
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>

      <GuidanceSection title="UserControl">
        <GuidanceText text="A UserControl combines existing controls and logic into a cohesive reusable unit. It is useful when the behavior is composition-oriented rather than a new templated control contract." />
      </GuidanceSection>

      <SampleCard
        automationId="GalleryCustomTemperatureSample"
        title="Temperature converter UserControl"
        description="The component groups input, command, and result controls into one reusable conversion workflow."
        code={`
function TemperatureConverterControl() {
  const input = signal('')
  const result = signal('')
  return <UI.StackPanel>...</UI.StackPanel>
}
        `}
        output={
          <UI.TextBlock
            automationId="GalleryCustomTemperatureStatus"
            text={computed(() =>
              temperatureResult.value || 'Enter a Celsius value.',
            )}
          />
        }
      >
        <UI.StackPanel spacing={8}>
          <UI.TextBox
            ref={temperatureInput}
            automationId="GalleryCustomTemperatureInput"
            width={200}
            horizontalAlignment={HorizontalAlignment.Left}
            header="Enter Temperature in Celsius"
            placeholderText="Celsius"
            onTextChanged={() => {
              temperatureText.value =
                temperatureInput.current?.text ?? ''
            }}
          />
          <UI.Button
            automationId="GalleryCustomTemperatureConvert"
            width={200}
            horizontalAlignment={HorizontalAlignment.Left}
            isEnabled={computed(
              () => Boolean(temperatureText.value.trim()),
            )}
            onClick={() => {
              const celsius = Number(temperatureText.value)
              temperatureResult.value = Number.isFinite(celsius)
                ? `Fahrenheit: ${(celsius * 9 / 5 + 32).toFixed(2)}°F`
                : 'Invalid input!'
              context.model.recordInteraction()
            }}
          >
            Convert to Fahrenheit
          </UI.Button>
          <UI.TextBlock
            fontWeight={{ weight: 600 }}
            text={temperatureResult}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
