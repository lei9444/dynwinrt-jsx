import type { RouteDefinition } from 'dynwinrt-jsx'
import type { AppContext } from '../../gallery-ui'
import { DateTimeCategoryPage } from './index'
import { CalendarDatePickerPage } from './calendar-date-picker'
import { CalendarViewPage } from './calendar-view'
import { DatePickerPage } from './date-picker'
import { TimePickerPage } from './time-picker'
import { createGalleryRouteGroup } from '../route-group'

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
