import {
  signal,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  PasswordRevealMode,
} from '#winapp/bindings'
import {
  type AppContext,
  type PasswordBoxInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function PasswordBoxPage(context: AppContext) {
  const passwordBox: RefObject<PasswordBoxInstance> = {
    current: null,
  }
  const status = signal('No password entered.')

  return (
    <Page
      title="PasswordBox"
      subtitle="Captures secret text with configurable reveal behavior."
      automationId="PasswordBoxPageHeading"
      pageId="password-box"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryPasswordBoxSample"
        title="A password field with peek reveal"
        description="The sample reports only password length and never exposes secret content."
        code={`
<UI.PasswordBox
  passwordRevealMode={PasswordRevealMode.Peek}
  onPasswordChanged={() => reportLength()}
/>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryPasswordBoxStatus"
            text={status}
          />
        }
      >
        <UI.PasswordBox
          ref={passwordBox}
          automationId="GalleryPasswordBoxInput"
          width={420}
          header="Password"
          placeholderText="Enter a password"
          maxLength={32}
          passwordRevealMode={PasswordRevealMode.Peek}
          onPasswordChanged={() => {
            const length =
              passwordBox.current?.password.length ?? 0
            status.value =
              length === 0
                ? 'No password entered.'
                : `${length} password characters`
            context.model.recordInteraction()
          }}
        />
      </SampleCard>
    </Page>
  )
}
