import { computed, signal } from 'dynwinrt-jsx'
import { InfoBarSeverity } from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  GalleryInfoBar,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

const severities = [
  { name: 'Informational', value: InfoBarSeverity.Informational },
  { name: 'Success', value: InfoBarSeverity.Success },
  { name: 'Warning', value: InfoBarSeverity.Warning },
  { name: 'Error', value: InfoBarSeverity.Error },
] as const

const shortMessage = 'A short essential app message.'
const longMessage =
  'A long essential app message for your users to be informed of, acknowledge, or take action on. Lorem ipsum dolor sit amet, consectetur adipiscing elit.'

export function InfoBarPage(context: AppContext) {
  const severityIndex = signal(0)
  const firstOpen = signal(true)
  const messageIndex = signal(1)
  const actionIndex = signal(0)
  const actionStatus = signal('No action selected.')
  const thirdOpen = signal(true)
  const iconVisible = signal(true)
  const closable = signal(true)
  const severity = computed(
    () => severities[severityIndex.value]?.value ??
      InfoBarSeverity.Informational,
  )
  const message = computed(
    () => messageIndex.value === 0 ? shortMessage : longMessage,
  )
  const action = computed(() => {
    if (actionIndex.value === 1) {
      return (
        <UI.Button
          automationId="GalleryInfoBarActionButton"
          onClick={() => {
            actionStatus.value = 'Action button selected.'
            context.model.recordInteraction()
          }}
        >
          Action
        </UI.Button>
      )
    }
    if (actionIndex.value === 2) {
      return (
        <UI.HyperlinkButton
          automationId="GalleryInfoBarActionLink"
          onClick={() => {
            actionStatus.value = 'Informational link selected.'
            context.model.recordInteraction()
          }}
        >
          Informational link
        </UI.HyperlinkButton>
      )
    }
    return null
  })

  return (
    <Page
      title="InfoBar"
      subtitle="An inline message for information, success, warning, or error states."
      automationId="InfoBarPageHeading"
      pageId="info-bar"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryStatusInfoBarSeveritySample"
        title="Change InfoBar severity and open state"
        description="Choose a semantic severity and reopen the InfoBar after it closes."
        code={`
<UI.InfoBar
  title="Title"
  message="Essential app message..."
  severity={severity}
  isOpen={isOpen}
/>
        `}
        options={
          <UI.StackPanel spacing={12}>
            <UI.CheckBox
              automationId="GalleryInfoBarFirstOpen"
              isChecked={firstOpen}
              onChecked={() => {
                if (!firstOpen.value) {
                  firstOpen.value = true
                  context.model.recordInteraction()
                }
              }}
              onUnchecked={() => {
                if (firstOpen.value) {
                  firstOpen.value = false
                  context.model.recordInteraction()
                }
              }}
            >
              Is Open
            </UI.CheckBox>
            <GalleryComboBox
              automationId="GalleryInfoBarSeverity"
              header={<UI.TextBlock text="Severity" />}
              selectedIndex={severityIndex}
              onSelectedIndexChange={(index) => {
                if (index !== severityIndex.value) {
                  severityIndex.value = index
                  firstOpen.value = true
                  context.model.recordInteraction()
                }
              }}
              width={180}
            >
              {severities.map((item) => (
                <UI.TextBlock key={item.name} text={item.name} />
              ))}
            </GalleryComboBox>
          </UI.StackPanel>
        }
      >
        <UI.InfoBar
          automationId="GalleryInfoBarSeverityControl"
          title="Title"
          message="Essential app message for your users to be informed of, acknowledge, or take action on."
          severity={severity}
          isOpen={firstOpen}
          onClosed={() => {
            firstOpen.value = false
          }}
        />
      </SampleCard>
      <SampleCard
        automationId="GalleryStatusInfoBarActionSample"
        title="Change message length and action button"
        description="Use a short or long message with no action, a Button, or a HyperlinkButton."
        code={`
<GalleryInfoBar
  title="Title"
  message={message}
  isOpen
  action={<UI.Button>Action</UI.Button>}
/>
        `}
        output={
          <UI.TextBlock
            automationId="GalleryInfoBarActionStatus"
            text={actionStatus}
          />
        }
        options={
          <UI.StackPanel spacing={12}>
            <GalleryComboBox
              automationId="GalleryInfoBarMessageLength"
              header={<UI.TextBlock text="Message Length" />}
              selectedIndex={messageIndex}
              onSelectedIndexChange={(index) => {
                if (index !== messageIndex.value) {
                  messageIndex.value = index
                  context.model.recordInteraction()
                }
              }}
              width={180}
            >
              <UI.TextBlock text="Short" />
              <UI.TextBlock text="Long" />
            </GalleryComboBox>
            <GalleryComboBox
              automationId="GalleryInfoBarActionType"
              header={<UI.TextBlock text="Action Button" />}
              selectedIndex={actionIndex}
              onSelectedIndexChange={(index) => {
                if (index !== actionIndex.value) {
                  actionIndex.value = index
                  context.model.recordInteraction()
                }
              }}
              width={180}
            >
              <UI.TextBlock text="None" />
              <UI.TextBlock text="Button" />
              <UI.TextBlock text="Hyperlink" />
            </GalleryComboBox>
          </UI.StackPanel>
        }
      >
        <GalleryInfoBar
          automationId="GalleryInfoBarActionControl"
          title="Title"
          message={message}
          isOpen
          action={action}
        />
      </SampleCard>
      <SampleCard
        automationId="GalleryStatusInfoBarDisplaySample"
        title="Configure close and icon visibility"
        description="Toggle the open, icon, and close affordance properties independently."
        code={`
<UI.InfoBar
  title="Title"
  message="Essential app message..."
  isOpen={isOpen}
  isIconVisible={iconVisible}
  isClosable={closable}
/>
        `}
        options={
          <UI.StackPanel spacing={8}>
            <UI.CheckBox
              automationId="GalleryInfoBarDisplayOpen"
              isChecked={thirdOpen}
              onChecked={() => {
                if (!thirdOpen.value) {
                  thirdOpen.value = true
                  context.model.recordInteraction()
                }
              }}
              onUnchecked={() => {
                if (thirdOpen.value) {
                  thirdOpen.value = false
                  context.model.recordInteraction()
                }
              }}
            >
              Is Open
            </UI.CheckBox>
            <UI.CheckBox
              automationId="GalleryInfoBarIconVisible"
              isChecked={iconVisible}
              onChecked={() => {
                if (!iconVisible.value) {
                  iconVisible.value = true
                  context.model.recordInteraction()
                }
              }}
              onUnchecked={() => {
                if (iconVisible.value) {
                  iconVisible.value = false
                  context.model.recordInteraction()
                }
              }}
            >
              Is Icon Visible
            </UI.CheckBox>
            <UI.CheckBox
              automationId="GalleryInfoBarClosable"
              isChecked={closable}
              onChecked={() => {
                if (!closable.value) {
                  closable.value = true
                  context.model.recordInteraction()
                }
              }}
              onUnchecked={() => {
                if (closable.value) {
                  closable.value = false
                  context.model.recordInteraction()
                }
              }}
            >
              Is Closable
            </UI.CheckBox>
          </UI.StackPanel>
        }
      >
        <UI.InfoBar
          automationId="GalleryInfoBarDisplayControl"
          title="Title"
          message="Essential app message for your users to be informed of, acknowledge, or take action on."
          isOpen={thirdOpen}
          isIconVisible={iconVisible}
          isClosable={closable}
          onClosed={() => {
            thirdOpen.value = false
          }}
        />
      </SampleCard>
    </Page>
  )
}
