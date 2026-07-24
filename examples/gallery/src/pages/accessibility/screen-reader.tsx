import {
  signal,
  styles,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  AutomationEvents,
  AutomationHeadingLevel,
  AutomationLiveSetting,
  FrameworkElementAutomationPeer,
  TextBlock,
} from '#winapp/bindings'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

export function ScreenReaderPage(context: AppContext) {
  const announcement = signal('No announcement yet.')
  const eventStatus = signal('Live region is ready.')
  const liveRegion: RefObject<TextBlock> = { current: null }
  const announce = () => {
    announcement.value = 'Download completed.'
    const element = liveRegion.current
    if (!element) {
      throw new Error('Screen reader live region is not mounted.')
    }
    const peer =
      FrameworkElementAutomationPeer.fromElement(element) ??
      FrameworkElementAutomationPeer.createPeerForElement(
        element,
      )
    peer.raiseAutomationEvent(
      AutomationEvents.LiveRegionChanged,
    )
    eventStatus.value = 'LiveRegionChanged raised.'
  }

  return (
    <Page
      title="Screen Reader"
      subtitle="Automation names, help text, headings, and live regions expose meaning."
      automationId="ScreenReaderPageHeading"
      pageId="screen-reader"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryAccessibilityScreenReaderSample"
        title="Meaningful automation metadata"
        description="The visible heading has a semantic level, the action has a descriptive name and help text, and updates use a polite live region."
        code={`
<UI.TextBlock automationHeadingLevel={AutomationHeadingLevel.Level2} />
<UI.Button
  automationName="Announce download complete"
  automationHelpText="Updates the polite live region"
/>
<UI.TextBlock automationLiveSetting={AutomationLiveSetting.Polite} />
        `}
      >
        <UI.StackPanel spacing={12}>
          <UI.TextBlock
            {...styles.heading({ level: 'subtitle' })}
            automationId="GalleryAccessibilityScreenReaderHeading"
            automationHeadingLevel={
              AutomationHeadingLevel.Level4
            }
            text="Download status"
          />
          <UI.Button
            automationId="GalleryAccessibilityScreenReaderAction"
            automationName="Complete download"
            automationHelpText="Updates the polite download status live region"
            onClick={() => {
              announce()
              context.model.recordInteraction()
            }}
          >
            Complete download
          </UI.Button>
          <UI.TextBlock
            ref={liveRegion}
            automationId="GalleryAccessibilityScreenReaderLive"
            automationLiveSetting={AutomationLiveSetting.Polite}
            text={announcement}
          />
          <UI.TextBlock
            automationId="GalleryAccessibilityScreenReaderEventStatus"
            text={eventStatus}
          />
        </UI.StackPanel>
      </SampleCard>
    </Page>
  )
}
