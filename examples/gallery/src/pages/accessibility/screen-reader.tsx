import {
  signal,
  styles,
  theme,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  AccessibilityView,
  AutomationEvents,
  AutomationHeadingLevel,
  AutomationLiveSetting,
  FrameworkElementAutomationPeer,
  HorizontalAlignment,
  Orientation,
  TextBlock,
  TextWrapping,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryListView,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import { loadGalleryBitmap } from '../../gallery-assets'
import {
  GuidanceSection,
  GuidanceText,
} from '../fundamentals/shared'

export function ScreenReaderPage(context: AppContext) {
  const announcement = signal('No announcement yet.')
  const eventStatus = signal('Live region is ready.')
  const liveRegion: RefObject<TextBlock> = { current: null }
  const inputLabel = signal<TextBlock | null>(null)
  const grapes = loadGalleryBitmap('SampleMedia/grapes.jpg', 480)
  const decorative = loadGalleryBitmap('SampleMedia/valley.jpg', 480)
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
      subtitle="Inclusive design ensures meaningful content for assistive technologies."
      automationId="ScreenReaderPageHeading"
      pageId="screen-reader"
      model={context.model}
    >
      <GuidanceText text="Screen readers such as Narrator convert UI Automation names, roles, content, and relationships into spoken output for blind and low-vision users." />

      <GuidanceSection title="Accessible names">
        <GuidanceText text="An accessible name is a short descriptive string. It should normally match the visible label because screen-reader users hear it whenever they navigate to the control." />
      </GuidanceSection>

      <SampleCard
        automationId="GalleryAccessibilityScreenReaderSample"
        title="Getting an accessible name automatically"
        description="String content, TextBox headers, and placeholders provide native accessible names without duplicate metadata."
        code={`
<UI.Button>Download survey</UI.Button>
<UI.TextBox header="Name" />
<UI.TextBox placeholderText="Nickname" />
<UI.TextBox header="Email" placeholderText="test@example.com" />
        `}
      >
        <UI.StackPanel spacing={12}>
          <UI.Button>Download survey</UI.Button>
          <UI.TextBox
            width={240}
            horizontalAlignment={HorizontalAlignment.Left}
            header="Name"
          />
          <UI.TextBox
            width={240}
            horizontalAlignment={HorizontalAlignment.Left}
            placeholderText="Nickname"
          />
          <UI.TextBox
            width={240}
            horizontalAlignment={HorizontalAlignment.Left}
            header="Email"
            placeholderText="test@example.com"
          />
          <UI.TextBlock
            foreground={theme.secondaryText}
            text="Narrator reads Download survey, Name, Nickname, and Email. When both header and placeholder exist, the header is the name and the placeholder becomes description."
            textWrapping={TextWrapping.Wrap}
          />
        </UI.StackPanel>
      </SampleCard>

      <GuidanceSection title="Setting an accessible name manually">
        <GuidanceText text="Controls without string content, such as collections and images, need an explicit accessible name that explains their purpose." />
      </GuidanceSection>

      <SampleCard
        automationId="GalleryAccessibilityManualNameSample"
        title="Name collections and images"
        description="The ListView announces its collection role as Contacts, while the image exposes concise alt text."
        code={`
<GalleryListView automationName="Contacts">...</GalleryListView>
<UI.Image automationName="Grapes" source={grapes} />
        `}
      >
        <UI.StackPanel spacing={12}>
          <GalleryListView
            width={300}
            horizontalAlignment={HorizontalAlignment.Left}
            automationName="Contacts"
          >
            {[
              'Nathan Quinn',
              'Jessica Lamber',
              'Carl Bond',
              'Jessica Russel',
            ].map((name) => (
              <UI.ListViewItem key={name}>
                {name}
              </UI.ListViewItem>
            ))}
          </GalleryListView>
          <UI.Image
            height={150}
            horizontalAlignment={HorizontalAlignment.Left}
            automationName="Grapes"
            source={grapes}
          />
        </UI.StackPanel>
      </SampleCard>

      <GuidanceSection title="Using another control as a label">
        <GuidanceText text="A visible TextBlock can label an input. Put the redundant label in the Raw UIA view so it is not announced twice." />
      </GuidanceSection>

      <SampleCard
        automationId="GalleryAccessibilityLabeledBySample"
        title="LabeledBy relationship"
        description="The TextBox receives its name from the projected TextBlock instance through AutomationProperties.LabeledBy."
        code={`
<UI.TextBlock
  ref={(value) => inputLabel.value = value}
  automationAccessibilityView={AccessibilityView.Raw}
  text="Searching Photos:"
/>
<UI.TextBox automationLabeledBy={inputLabel} />
        `}
      >
        <UI.StackPanel spacing={8}>
          <UI.TextBlock
            ref={(value) => {
              inputLabel.value = value
            }}
            automationAccessibilityView={AccessibilityView.Raw}
            text="Searching Photos:"
          />
          <UI.TextBox
            automationId="GalleryAccessibilityLabeledInput"
            width={240}
            horizontalAlignment={HorizontalAlignment.Left}
            automationLabeledBy={inputLabel}
          />
          <UI.TextBlock
            foreground={theme.secondaryText}
            text="Narrator reads this TextBox as Searching Photos."
          />
        </UI.StackPanel>
      </SampleCard>

      <GuidanceSection title="Common accessibility properties">
        <GuidanceText text="Beyond names, expose descriptions, help text, heading levels, and position in set so assistive technology can explain context and structure." />
      </GuidanceSection>

      <SampleCard
        automationId="GalleryAccessibilityDescriptionSample"
        title="Description and help text"
        description="FullDescription connects visible explanatory text to a control; HelpText explains a nuanced action or custom tooltip."
        code={`
<UI.CheckBox automationFullDescription="Deletes cached items..." />
<UI.Button automationHelpText="Launch the cancellation wizard" />
        `}
      >
        <UI.StackPanel spacing={12}>
          <UI.CheckBox
            automationFullDescription="Deletes all cached items when closing the browser. This includes cookies, images, and browsing history."
          >
            Clear cache on exit
          </UI.CheckBox>
          <UI.TextBlock
            automationAccessibilityView={AccessibilityView.Raw}
            foreground={theme.secondaryText}
            text="Deletes all cached items when closing the browser. This includes cookies, images, and browsing history."
            textWrapping={TextWrapping.Wrap}
          />
          <UI.Button
            automationHelpText="Launch the cancellation wizard"
            toolTip="Launch the cancellation wizard"
          >
            Cancel RSS subscriptions
          </UI.Button>
        </UI.StackPanel>
      </SampleCard>

      <SampleCard
        automationId="GalleryAccessibilityPositionSample"
        title="Position in set"
        description="Custom command groups can expose explicit 1-of-3 position metadata when no collection control provides it automatically."
        code={`
<UI.Button automationPositionInSet={1} automationSizeOfSet={3}>
  View
</UI.Button>
        `}
      >
        <UI.StackPanel
          orientation={Orientation.Horizontal}
          spacing={8}
        >
          {['View', 'Rename', 'Delete'].map((label, index) => (
            <UI.Button
              key={label}
              automationPositionInSet={index + 1}
              automationSizeOfSet={3}
            >
              {label}
            </UI.Button>
          ))}
        </UI.StackPanel>
      </SampleCard>

      <GuidanceSection title="Visual tree">
        <GuidanceText text="Most accessibility tools use the Control or Content UIA views. Decorative or redundant elements can be placed in the Raw view so they do not add noise." />
      </GuidanceSection>

      <SampleCard
        automationId="GalleryAccessibilityVisualTreeSample"
        title="Hide decorative content from the Content view"
        description="The image is decorative, so only the explanatory text remains in the normal screen-reader navigation view."
        code={`
<UI.Image
  automationAccessibilityView={AccessibilityView.Raw}
  source={decorative}
/>
        `}
      >
        <UI.StackPanel
          orientation={Orientation.Horizontal}
          spacing={8}
        >
          <UI.Image
            width={120}
            height={80}
            automationAccessibilityView={AccessibilityView.Raw}
            source={decorative}
          />
          <UI.TextBlock
            maxWidth={420}
            text="This image is decorative and serves no informational purpose, so it is removed from the Content UIA view."
            textWrapping={TextWrapping.Wrap}
          />
        </UI.StackPanel>
      </SampleCard>

      <GuidanceSection title="Headings and live regions">
        <GuidanceText text="Heading levels create document structure. Live regions announce important updates without moving keyboard focus." />
      </GuidanceSection>

      <SampleCard
        automationId="GalleryAccessibilityLiveRegionSample"
        title="Raise a live-region event"
        description="Updating text alone is not enough: the projected automation peer raises LiveRegionChanged after the polite region changes."
        code={`
announcement.value = 'Download completed.'
peer.raiseAutomationEvent(AutomationEvents.LiveRegionChanged)
        `}
      >
        <UI.StackPanel spacing={12}>
          <UI.TextBlock
            {...styles.heading({ level: 'subtitle' })}
            automationId="GalleryAccessibilityScreenReaderHeading"
            automationHeadingLevel={AutomationHeadingLevel.Level4}
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
