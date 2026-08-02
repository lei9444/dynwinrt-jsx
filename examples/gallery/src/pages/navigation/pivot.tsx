import {
  computed,
  signal,
  thickness,
  type RefObject,
} from 'dynwinrt-jsx'
import {
  Pivot,
  PropertyValue,
  TextWrapping,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  GalleryPivot,
  type ToggleInstance,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'

const sections = [
  {
    name: 'All',
    description: 'All messages appear in this view.',
  },
  {
    name: 'Unread',
    description: 'Messages that still need attention.',
  },
  {
    name: 'Flagged',
    description: 'Messages saved for follow-up.',
  },
  {
    name: 'Urgent',
    description: 'Time-sensitive messages and alerts.',
  },
] as const

export function PivotPage(context: AppContext) {
  const selectedIndex = signal(0)
  const controlledStatus = signal('Not captured.')
  const locked = signal(false)
  const pivot: RefObject<Pivot> = { current: null }
  const lockToggle: RefObject<ToggleInstance> = { current: null }
  let selectionEvents = 0

  return (
    <Page
      title="Pivot"
      subtitle="Presents information from different sources in a tabbed view."
      automationId="PivotPageHeading"
      pageId="pivot"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryPivotSample"
        title="A basic Pivot"
        description="Pivot remains available for existing apps, though SelectorBar is preferred for new Windows 11 experiences."
        code={`
<GalleryPivot
  title={PropertyValue.createString('EMAIL')}
  selectedIndex={selectedIndex}
  onSelectedIndexChange={(index) => {
    selectedIndex.value = index
  }}
>
  <UI.PivotItem header="All">...</UI.PivotItem>
  <UI.PivotItem header="Unread">...</UI.PivotItem>
</GalleryPivot>
        `}
        output={
          <UI.StackPanel spacing={4}>
            <UI.TextBlock
              automationId="GalleryPivotStatus"
              text={computed(
                () =>
                  `Selected: ${
                    sections[selectedIndex.value]?.name ?? 'None'
                  }`,
              )}
            />
            <UI.TextBlock
              automationId="GalleryPivotControlledStatus"
              text={controlledStatus}
            />
          </UI.StackPanel>
        }
        options={
          <UI.StackPanel spacing={10}>
            <GalleryComboBox
              automationId="GalleryPivotSelectedIndex"
              header={<UI.TextBlock text="Selected section" />}
              selectedIndex={selectedIndex}
              onSelectedIndexChange={(index) => {
                selectedIndex.value = index
                context.model.recordInteraction()
              }}
              width={180}
            >
              {sections.map((section) => (
                <UI.TextBlock
                  key={section.name}
                  text={section.name}
                />
              ))}
            </GalleryComboBox>
            <UI.ToggleSwitch
              ref={lockToggle}
              automationId="GalleryPivotLocked"
              header="IsLocked"
              onToggled={() => {
                const next =
                  lockToggle.current?.isOn ?? locked.value
                if (next !== locked.value) {
                  locked.value = next
                  context.model.recordInteraction()
                }
              }}
            />
            <UI.Button
              automationId="GalleryPivotProgrammaticUrgent"
              onClick={() => {
                selectedIndex.value = 3
              }}
            >
              Select Urgent from Signal
            </UI.Button>
            <UI.Button
              automationId="GalleryPivotRapidSelection"
              onClick={() => {
                selectedIndex.value = 1
                selectedIndex.value = 3
                selectedIndex.value = 0
              }}
            >
              Rapidly settle on All
            </UI.Button>
            <UI.Button
              automationId="GalleryPivotCaptureControlled"
              onClick={() => {
                controlledStatus.value =
                  `signal=${selectedIndex.peek()};native=${
                    pivot.current?.selectedIndex ?? -99
                  };events=${selectionEvents}`
              }}
            >
              Capture controlled state
            </UI.Button>
          </UI.StackPanel>
        }
      >
        <GalleryPivot
          ref={pivot}
          automationId="GalleryPivotControl"
          title={PropertyValue.createString('EMAIL')}
          minHeight={280}
          selectedIndex={selectedIndex}
          isLocked={locked}
          onSelectedIndexChange={(next) => {
            selectionEvents += 1
            if (
              next !== selectedIndex.value
            ) {
              selectedIndex.value = next
              context.model.recordInteraction()
            }
          }}
        >
          {sections.map((section) => (
            <UI.PivotItem
              key={section.name}
              automationId={`GalleryPivot${section.name}`}
              header={section.name}
            >
              <UI.Border padding={thickness(24)}>
                <UI.TextBlock
                  fontSize={20}
                  text={section.description}
                  textWrapping={TextWrapping.Wrap}
                />
              </UI.Border>
            </UI.PivotItem>
          ))}
        </GalleryPivot>
      </SampleCard>
    </Page>
  )
}
