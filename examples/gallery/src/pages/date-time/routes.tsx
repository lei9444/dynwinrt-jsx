import { createLazyComponent } from 'dynwinrt-jsx'
import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { createGalleryRouteGroup } from '../route-group'

const DateTimeCategoryPage = createLazyComponent(
  () => (require('./index') as typeof import('./index')).DateTimeCategoryPage,
)

const CalendarDatePickerPage = createLazyComponent(
  () => (require('./calendar-date-picker') as typeof import('./calendar-date-picker')).CalendarDatePickerPage,
)

const CalendarViewPage = createLazyComponent(
  () => (require('./calendar-view') as typeof import('./calendar-view')).CalendarViewPage,
)

const DatePickerPage = createLazyComponent(
  () => (require('./date-picker') as typeof import('./date-picker')).DatePickerPage,
)

const TimePickerPage = createLazyComponent(
  () => (require('./time-picker') as typeof import('./time-picker')).TimePickerPage,
)

export function createDateTimeRoutes(
  context: AppContext,
): readonly RouteDefinition[] {
  return createGalleryRouteGroup(context, {
    id: 'category-date-time',
    path: '/date-time',
    renderIndex: (value) => <DateTimeCategoryPage {...value} />,
    pages: [
      { id: 'calendar-date-picker', render: (value) => <CalendarDatePickerPage {...value} /> },
      { id: 'calendar-view', render: (value) => <CalendarViewPage {...value} /> },
      { id: 'date-picker', render: (value) => <DatePickerPage {...value} /> },
      { id: 'time-picker', render: (value) => <TimePickerPage {...value} /> },
    ],
  })
}
