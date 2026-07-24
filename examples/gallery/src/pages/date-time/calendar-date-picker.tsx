import { signal } from 'dynwinrt-jsx'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import { formatDateTime } from './shared'

export function CalendarDatePickerPage(context: AppContext) {
  const selectedDate = signal('No date selected.')

  return (
    <Page
      title="CalendarDatePicker"
      subtitle="A compact text field and calendar flyout for choosing a date."
      automationId="CalendarDatePickerPageHeading"
      pageId="calendar-date-picker"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryDateTimeCalendarDatePickerSample"
        title="Header and placeholder text"
        description="The picker remains compact until the user opens its native calendar flyout."
        code={`
<UI.CalendarDatePicker
  header="Calendar"
  placeholderText="Pick a date"
  onDateChanged={(_sender, args) => {
    selectedDate.value = formatDateTime(args.newDate)
  }}
/>
        `}
        output={<UI.TextBlock text={selectedDate} />}
      >
        <UI.CalendarDatePicker
          automationId="GalleryCalendarDatePickerControl"
          header="Calendar"
          placeholderText="Pick a date"
          onDateChanged={(_sender, args) => {
            selectedDate.value = formatDateTime(args.newDate)
            context.model.recordInteraction()
          }}
        />
      </SampleCard>
    </Page>
  )
}
