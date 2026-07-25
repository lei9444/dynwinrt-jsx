import {
  styles,
  thickness,
  tokens,
  onCleanup,
  type Child,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  AutomationHeadingLevel,
  ContentControl,
  HorizontalAlignment,
  TextWrapping,
  XamlReader,
} from '#winapp/bindings'
import { DynWinRtValue } from '@microsoft/dynwinrt'
import { UI } from '../../gallery-ui'

function loadExpected<T>(
  xaml: string,
  label: string,
  predicate: (value: unknown) => value is T,
  validateTemplates = false,
): T {
  const value = validateTemplates
    ? XamlReader.loadWithInitialTemplateValidation(xaml)
    : XamlReader.load(xaml)
  if (!predicate(value)) {
    throw new TypeError(`XamlReader did not return a ${label}.`)
  }
  return value
}

export function loadNativeContent(
  xaml: string,
  validateTemplates = false,
): DynWinRtValue {
  return loadExpected(
    xaml,
    'DynWinRtValue object tree',
    (value): value is DynWinRtValue =>
      value instanceof DynWinRtValue,
    validateTemplates,
  )
}

export function NativeXamlPreview(props: {
  readonly xaml: string
  readonly automationId?: string
}) {
  const host: RefObject<ContentControl> = { current: null }
  let mountedHost: ContentControl | null = null
  const content = loadNativeContent(props.xaml, true)
  onCleanup(() => {
    let firstError: unknown
    try {
      if (mountedHost) {
        mountedHost.content = null
      }
    }
    catch (error: unknown) {
      firstError = error
    }
    try {
      content.release()
    }
    catch (error: unknown) {
      firstError ??= error
    }
    if (firstError !== undefined) {
      throw firstError
    }
  })
  return (
    <UI.ContentControl
      ref={(value) => {
        host.current = value
        if (value) {
          mountedHost = value
        }
      }}
      {...(props.automationId
        ? { automationId: props.automationId }
        : {})}
      content={content}
      horizontalContentAlignment={HorizontalAlignment.Stretch}
    />
  )
}

export function GuidanceSection(props: {
  readonly title?: string
  readonly children: Child
}) {
  return (
    <UI.StackPanel spacing={tokens.spacing.md}>
      {props.title ? (
        <UI.TextBlock
          {...styles.heading({ level: 'subtitle' })}
          automationHeadingLevel={AutomationHeadingLevel.Level2}
          text={props.title}
        />
      ) : null}
      {props.children}
    </UI.StackPanel>
  )
}

export function GuidanceText(props: {
  readonly text: string
}) {
  return (
    <UI.TextBlock
      text={props.text}
      textWrapping={TextWrapping.Wrap}
    />
  )
}

export function BulletList(props: {
  readonly items: readonly string[]
}) {
  return (
    <UI.StackPanel spacing={tokens.spacing.sm}>
      {props.items.map((item) => (
        <UI.TextBlock
          key={item}
          margin={thickness(8, 0, 0, 0)}
          text={`• ${item}`}
          textWrapping={TextWrapping.Wrap}
        />
      ))}
    </UI.StackPanel>
  )
}
