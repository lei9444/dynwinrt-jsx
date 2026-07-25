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
  projectAs,
  releaseProjected,
  TextWrapping,
  UIElement,
  XamlReader,
} from '#winapp/bindings'
import { UI } from '../../gallery-ui'

export function loadNativeContent(
  xaml: string,
  validateTemplates = false,
): UIElement {
  const value = validateTemplates
    ? XamlReader.loadWithInitialTemplateValidation(xaml)
    : XamlReader.load(xaml)
  return projectAs(value, UIElement)
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
      releaseProjected(content)
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
