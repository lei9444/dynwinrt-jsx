import { signal } from 'dynwinrt-jsx'
import { type AppContext, UI } from '../../gallery-ui'
import { Page, SampleCard } from '../../components/gallery-components'
import {
  formatTimeSpan,
  timeSpanFromParts,
} from './shared'

export function TimePickerPage(context: AppContext) {
  const selectedTime = signal('Choose a time.')
  const now = new Date()
  const currentTime = timeSpanFromParts(
    now.getHours(),
    now.getMinutes(),
  )
  const updateStatus = (value: { duration: bigint }) => {
    selectedTime.value = `Selected time: ${formatTimeSpan(value)}`
    context.model.recordInteraction()
  }

  return (
    <Page
      title="TimePicker"
      subtitle="A native selector for hours and minutes."
      automationId="TimePickerPageHeading"
      pageId="time-picker"
      model={context.model}
    >
      <SampleCard
        automationId="GalleryDateTimeTimePickerSimpleSample"
        title="A simple TimePicker"
        description="Use the default regional clock and one-minute increments."
        code={`
<UI.TimePicker />
        `}
        output={<UI.TextBlock text={selectedTime} />}
      >
        <UI.TimePicker
          automationId="GalleryTimePickerSimpleControl"
          onTimeChanged={(_sender, args) => {
            updateStatus(args.newTime)
          }}
        />
      </SampleCard>
      <SampleCard
        automationId="GalleryDateTimeTimePickerIncrementSample"
        title="Header and minute increments"
        description="Restrict the minute selector to quarter-hour choices."
        code={`
<UI.TimePicker
  header="Arrival time"
  minuteIncrement={15}
/>
        `}
      >
        <UI.TimePicker
          automationId="GalleryTimePickerIncrementControl"
          header="Arrival time"
          minuteIncrement={15}
          onTimeChanged={(_sender, args) => {
            updateStatus(args.newTime)
          }}
        />
      </SampleCard>
      <SampleCard
        automationId="GalleryDateTimeTimePicker24HourSample"
        title="24-hour clock"
        description="Initialize SelectedTime to the current time and use a 24-hour clock."
        code={`
<UI.TimePicker
  clockIdentifier="24HourClock"
  header="24 hour clock"
  selectedTime={timeSpanFromParts(hours, minutes)}
/>
        `}
      >
        <UI.TimePicker
          automationId="GalleryTimePicker24HourControl"
          clockIdentifier="24HourClock"
          header="24 hour clock"
          selectedTime={currentTime}
          onTimeChanged={(_sender, args) => {
            updateStatus(args.newTime)
          }}
        />
      </SampleCard>
    </Page>
  )
}
