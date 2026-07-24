import { computed, signal } from 'dynwinrt-jsx'
import {
  CalendarViewSelectionMode,
  VerticalAlignment,
} from '#winapp/bindings'
import {
  type AppContext,
  GalleryComboBox,
  UI,
} from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import {
  calendarIdentifiers,
  calendarLanguages,
  formatDateTime,
} from './shared'

const selectionModes = [
  {
    name: 'None',
    value: CalendarViewSelectionMode.None,
  },
  {
    name: 'Single',
    value: CalendarViewSelectionMode.Single,
  },
  {
    name: 'Multiple',
    value: CalendarViewSelectionMode.Multiple,
  },
] as const

export function CalendarViewPage(context: AppContext) {
  const groupLabelsVisible = signal(true)
  const outOfScopeEnabled = signal(true)
  const selectionModeIndex = signal(1)
  const calendarIdentifierIndex = signal(0)
  const languageIndex = signal(0)
  const selectionStatus = signal('No dates selected.')
  const configurationStatus = computed(
    () =>
      `Group labels: ${groupLabelsVisible.value ? 'on' : 'off'}; ` +
      `out-of-scope dates: ${outOfScopeEnabled.value ? 'on' : 'off'}.`,
  )
  const selectionMode = computed(
    () =>
      selectionModes[selectionModeIndex.value]?.value ??
      CalendarViewSelectionMode.Single,
  )
  const calendarIdentifier = computed(
    () =>
      calendarIdentifiers[calendarIdentifierIndex.value] ??
      calendarIdentifiers[0],
  )
  const language = computed(
    () =>
      calendarLanguages[languageIndex.value]?.[1] ??
      calendarLanguages[0][1],
  )

  return (
    <Page
      title="CalendarView"
      subtitle="A large calendar that supports localization and single or multiple selection."
      automationId="CalendarViewPageHeading"
      pageId="calendar-view"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryDateTimeCalendarViewSample"
        title="A basic calendar view"
        description="Change selection behavior, calendar system, language, group labels, and out-of-scope dates."
        code={`
<UI.CalendarView
  selectionMode={selectionMode}
  isGroupLabelVisible={groupLabelsVisible}
  isOutOfScopeEnabled={outOfScopeEnabled}
  language={language}
  calendarIdentifier={calendarIdentifier}
/>
        `}
        output={<UI.TextBlock text={selectionStatus} />}
        options={
          <UI.StackPanel spacing={12}>
            <UI.CheckBox
              automationId="GalleryCalendarViewGroupLabels"
              isChecked={groupLabelsVisible}
              onChecked={() => {
                if (!groupLabelsVisible.value) {
                  groupLabelsVisible.value = true
                  context.model.recordInteraction()
                }
              }}
              onUnchecked={() => {
                if (groupLabelsVisible.value) {
                  groupLabelsVisible.value = false
                  context.model.recordInteraction()
                }
              }}
            >
              IsGroupLabelVisible
            </UI.CheckBox>
            <UI.CheckBox
              automationId="GalleryCalendarViewOutOfScope"
              isChecked={outOfScopeEnabled}
              onChecked={() => {
                if (!outOfScopeEnabled.value) {
                  outOfScopeEnabled.value = true
                  context.model.recordInteraction()
                }
              }}
              onUnchecked={() => {
                if (outOfScopeEnabled.value) {
                  outOfScopeEnabled.value = false
                  context.model.recordInteraction()
                }
              }}
            >
              IsOutOfScopeEnabled
            </UI.CheckBox>
            <GalleryComboBox
              automationId="GalleryCalendarViewSelectionMode"
              header={<UI.TextBlock text="SelectionMode" />}
              selectedIndex={selectionModeIndex}
              onSelectedIndexChange={(index) => {
                selectionModeIndex.value = index
                context.model.recordInteraction()
              }}
              width={220}
            >
              {selectionModes.map((mode) => (
                <UI.TextBlock key={mode.name} text={mode.name} />
              ))}
            </GalleryComboBox>
            <GalleryComboBox
              automationId="GalleryCalendarViewIdentifier"
              header={<UI.TextBlock text="CalendarIdentifier" />}
              selectedIndex={calendarIdentifierIndex}
              onSelectedIndexChange={(index) => {
                calendarIdentifierIndex.value = index
                context.model.recordInteraction()
              }}
              width={220}
            >
              {calendarIdentifiers.map((identifier) => (
                <UI.TextBlock
                  key={identifier}
                  text={identifier}
                />
              ))}
            </GalleryComboBox>
            <GalleryComboBox
              automationId="GalleryCalendarViewLanguage"
              header={<UI.TextBlock text="Language" />}
              selectedIndex={languageIndex}
              onSelectedIndexChange={(index) => {
                languageIndex.value = index
                context.model.recordInteraction()
              }}
              width={220}
            >
              {calendarLanguages.map(([name, code]) => (
                <UI.TextBlock
                  key={code}
                  text={name}
                />
              ))}
            </GalleryComboBox>
            <UI.TextBlock
              automationId="GalleryCalendarViewConfiguration"
              text={configurationStatus}
            />
          </UI.StackPanel>
        }
      >
        <UI.CalendarView
          automationId="GalleryCalendarViewControl"
          verticalAlignment={VerticalAlignment.Top}
          selectionMode={selectionMode}
          isGroupLabelVisible={groupLabelsVisible}
          isOutOfScopeEnabled={outOfScopeEnabled}
          language={language}
          calendarIdentifier={calendarIdentifier}
          onSelectedDatesChanged={(sender, args) => {
            const added = args.addedDates.toArray()
            const removed = args.removedDates.toArray()
            const lastAdded = added.at(-1)
            selectionStatus.value = lastAdded
              ? `${sender.selectedDates.length} selected; added ${formatDateTime(lastAdded)}.`
              : `${sender.selectedDates.length} selected; removed ${removed.length} date(s).`
            context.model.recordInteraction()
          }}
        />
      </SampleCard>
    </Page>
  )
}
