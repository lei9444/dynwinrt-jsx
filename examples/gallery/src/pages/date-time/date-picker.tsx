import { signal } from 'dynwinrt-jsx'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import {
  addMonths,
  addYears,
  formatDateTime,
  toDateTime,
} from './shared'

export function DatePickerPage(context: AppContext) {
  const formattedDate = signal('Choose a date.')
  const now = new Date()

  return (
    <Page
      title="DatePicker"
      subtitle="A compact month, day, and year selector."
      automationId="DatePickerPageHeading"
      pageId="date-picker"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryDateTimeDatePickerSimpleSample"
        title="A simple DatePicker with a header"
        description="The native picker supplies month, day, and year selectors."
        code={`
<UI.DatePicker header="Pick a date" />
        `}
      >
        <UI.DatePicker
          automationId="GalleryDatePickerSimpleControl"
          header="Pick a date"
        />
      </SampleCard>
      <SampleCard
        automationId="GalleryDateTimeDatePickerFormattedSample"
        title="Formatted day with the year hidden"
        description="The initial date is two months from today and the selectable range extends five years."
        code={`
<UI.DatePicker
  date={toDateTime(addMonths(new Date(), 2))}
  minYear={toDateTime(new Date())}
  maxYear={toDateTime(addYears(new Date(), 5))}
  dayFormat="{day.integer} ({dayofweek.abbreviated})"
  yearVisible={false}
/>
        `}
        output={<UI.TextBlock text={formattedDate} />}
      >
        <UI.DatePicker
          automationId="GalleryDatePickerFormattedControl"
          date={toDateTime(addMonths(now, 2))}
          minYear={toDateTime(now)}
          maxYear={toDateTime(addYears(now, 5))}
          dayFormat="{day.integer} ({dayofweek.abbreviated})"
          yearVisible={false}
          onDateChanged={(_sender, args) => {
            formattedDate.value = formatDateTime(args.newDate)
            context.model.recordInteraction()
          }}
        />
      </SampleCard>
    </Page>
  )
}
