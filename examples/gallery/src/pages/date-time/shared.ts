import type { DateTime } from '#winapp/bindings/DatePicker'
import type { TimeSpan } from '#winapp/bindings/TimePicker'

const ticksPerMillisecond = 10_000n
const windowsEpochTicks = 116_444_736_000_000_000n
const ticksPerMinute = 600_000_000n

export const calendarIdentifiers = [
  'GregorianCalendar',
  'HebrewCalendar',
  'HijriCalendar',
  'JapaneseCalendar',
  'JulianCalendar',
  'KoreanCalendar',
  'PersianCalendar',
  'TaiwaneseCalendar',
  'ThaiCalendar',
  'UmAlQuraCalendar',
] as const

export const calendarLanguages = [
  ['English', 'en'],
  ['Arabic', 'ar'],
  ['Afrikaans', 'af'],
  ['Albanian', 'sq'],
  ['Amharic', 'am'],
  ['Armenian', 'hy'],
  ['Assamese', 'as'],
  ['Azerbaijani', 'az'],
  ['Basque', 'eu'],
  ['Belarusian', 'be'],
  ['Bangla', 'bn'],
  ['Bosnian', 'bs'],
  ['Bulgarian', 'bg'],
  ['Catalan', 'ca'],
  ['Chinese (Simplified)', 'zh'],
  ['Croatian', 'hr'],
  ['Czech', 'cs'],
  ['Danish', 'da'],
  ['Dari', 'prs'],
  ['Dutch', 'nl'],
  ['Estonian', 'et'],
  ['Filipino', 'fil'],
  ['Finnish', 'fi'],
  ['French', 'fr'],
  ['Galician', 'gl'],
  ['Georgian', 'ka'],
  ['German', 'de'],
  ['Greek', 'el'],
  ['Gujarati', 'gu'],
  ['Hausa', 'ha'],
  ['Hebrew', 'he'],
  ['Hindi', 'hi'],
  ['Hungarian', 'hu'],
  ['Icelandic', 'is'],
  ['Indonesian', 'id'],
  ['Irish', 'ga'],
  ['isiXhosa', 'xh'],
  ['isiZulu', 'zu'],
  ['Italian', 'it'],
  ['Japanese', 'ja'],
  ['Kannada', 'kn'],
  ['Kazakh', 'kk'],
  ['Khmer', 'km'],
  ['Kinyarwanda', 'rw'],
  ['KiSwahili', 'sw'],
  ['Konkani', 'kok'],
  ['Korean', 'ko'],
  ['Lao', 'lo'],
  ['Latvian', 'lv'],
  ['Lithuanian', 'lt'],
  ['Luxembourgish', 'lb'],
  ['Macedonian', 'mk'],
  ['Malay', 'ms'],
  ['Malayalam', 'ml'],
  ['Maltese', 'mt'],
  ['Maori', 'mi'],
  ['Marathi', 'mr'],
  ['Nepali', 'ne'],
  ['Norwegian', 'nb'],
  ['Odia', 'or'],
  ['Persian', 'fa'],
  ['Polish', 'pl'],
  ['Portuguese', 'pt'],
  ['Punjabi', 'pa'],
  ['Quechua', 'quz'],
  ['Romanian', 'ro'],
  ['Russian', 'ru'],
  ['Serbian (Latin)', 'sr'],
  ['Sesotho sa Leboa', 'nso'],
  ['Setswana', 'tn'],
  ['Sinhala', 'si'],
  ['Slovak', 'sk'],
  ['Slovenian', 'sl'],
  ['Spanish', 'es'],
  ['Swedish', 'sv'],
  ['Tamil', 'ta'],
  ['Telugu', 'te'],
  ['Thai', 'th'],
  ['Tigrinya', 'ti'],
  ['Turkish', 'tr'],
  ['Ukrainian', 'uk'],
  ['Urdu', 'ur'],
  ['Uzbek (Latin)', 'uz'],
  ['Vietnamese', 'vi'],
  ['Welsh', 'cy'],
  ['Wolof', 'wo'],
] as const

export function toDateTime(value: Date): DateTime {
  const milliseconds = value.getTime()
  if (!Number.isFinite(milliseconds)) {
    throw new RangeError('Date must contain a valid time value.')
  }
  return {
    universalTime:
      BigInt(Math.trunc(milliseconds)) * ticksPerMillisecond +
      windowsEpochTicks,
  }
}

export function fromDateTime(value: DateTime): Date {
  return new Date(
    Number(
      (value.universalTime - windowsEpochTicks) /
      ticksPerMillisecond,
    ),
  )
}

export function formatDateTime(value: DateTime | null): string {
  if (value === null) {
    return 'No date selected.'
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
  }).format(fromDateTime(value))
}

export function addMonths(value: Date, months: number): Date {
  const next = new Date(value)
  const day = next.getDate()
  next.setDate(1)
  next.setMonth(next.getMonth() + months)
  const month = next.getMonth()
  const year = next.getFullYear()
  const lastDay = new Date(year, month + 1, 0).getDate()
  next.setDate(Math.min(day, lastDay))
  return next
}

export function addYears(value: Date, years: number): Date {
  return addMonths(value, years * 12)
}

export function timeSpanFromParts(
  hours: number,
  minutes: number,
): TimeSpan {
  if (
    !Number.isInteger(hours) ||
    hours < 0 ||
    hours > 23 ||
    !Number.isInteger(minutes) ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new RangeError(
      'TimeSpan hours and minutes must describe a valid time of day.',
    )
  }
  return {
    duration: BigInt(hours * 60 + minutes) * ticksPerMinute,
  }
}

export function formatTimeSpan(value: TimeSpan): string {
  const totalMinutes = Number(value.duration / ticksPerMinute)
  const hours = Math.floor(totalMinutes / 60) % 24
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
