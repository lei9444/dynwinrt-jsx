import {
  createFocusTarget,
  signal,
} from 'dynwinrt-jsx'
import {
  Button,
  FocusState,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function KeyboardNavigationPage(context: AppContext) {
  const target = createFocusTarget<Button>(
    FocusState.Programmatic,
  )
  const status = signal('Focus follows a predictable tab order.')

  return (
    <Page
      title="Keyboard Navigation"
      subtitle="Logical tab order, access keys, and visible focus support keyboard use."
      automationId="KeyboardNavigationPageHeading"
      pageId="keyboard-navigation"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryAccessibilityKeyboardSample"
        title="Programmatic focus and access keys"
        description="A FocusTarget retains the native button and reports whether a deliberate focus request was accepted."
        code={`
const target = createFocusTarget<Button>(FocusState.Programmatic)
<UI.Button ref={target} accessKey="T">Target</UI.Button>
target.focus()
        `}
        output={
          <UI.TextBlock
            automationId="GalleryAccessibilityKeyboardStatus"
            text={status}
          />
        }
      >
        <UI.StackPanel spacing={10}>
          <UI.Button
            automationId="GalleryAccessibilityKeyboardFirst"
            accessKey="F"
          >
            First action
          </UI.Button>
          <UI.Button
            ref={target}
            automationId="GalleryAccessibilityKeyboardTarget"
            accessKey="T"
            onGotFocus={() => {
              status.value = 'Target button received focus.'
            }}
          >
            Target action
          </UI.Button>
          <UI.Button
            automationId="GalleryAccessibilityKeyboardMoveFocus"
            onClick={() => {
              const accepted = target.focus()
              if (!accepted) {
                status.value = 'Focus request was rejected.'
              }
              context.model.recordInteraction()
            }}
          >
            Move focus to target
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
