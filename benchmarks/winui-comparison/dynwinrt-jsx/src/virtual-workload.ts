export interface VirtualListItem {
  readonly id: number
  readonly name: string
  readonly category: string
  readonly message: string
  readonly timestamp: string
  readonly tag: string
  readonly likes: number
  readonly avatarHue: number
  readonly initial: string
}

const names = [
  'Alex Carter', 'Bailey Nguyen', 'Casey Wu',
  'Devon Patel', 'Erin Sato', 'Finley Brooks',
  'Gray Romero', 'Harper Lin', 'Indra Khan',
  'Jules Vega', 'Kai Holm', 'Lane Park',
  'Morgan Diaz', 'Nico Tran', 'Owen Reyes',
  'Parker Yates',
]
const categories = [
  'Engineering', 'Design', 'Marketing', 'Sales',
  'Support', 'Operations', 'Research', 'Finance',
]
const adjectives = [
  'quick', 'lazy', 'eager', 'calm', 'bright',
  'rough', 'smooth', 'sharp', 'dim', 'bold',
  'shy', 'warm',
]
const nouns = [
  'report', 'thread', 'ticket', 'review', 'draft',
  'sync', 'build', 'deploy', 'spike', 'demo',
  'pitch', 'audit',
]
const tags = [
  'ux', 'perf', 'infra', 'client', 'api', 'css',
  'shipit', 'frontend', 'backend', 'release',
  'hotfix', 'wip',
]
const months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]
const baseDate = Date.UTC(2026, 0, 1, 9, 0, 0)

function mod(value: number, length: number): number {
  const result = value % length
  return result < 0 ? result + length : result
}

function timestamp(index: number): string {
  const date = new Date(baseDate + index * 60_000)
  return (
    `${months[date.getUTCMonth()]} ` +
    `${String(date.getUTCDate()).padStart(2, '0')} ` +
    `${String(date.getUTCHours()).padStart(2, '0')}:` +
    `${String(date.getUTCMinutes()).padStart(2, '0')}`
  )
}

export const virtualRowHeight = 76

export function virtualItemAt(
  index: number,
): VirtualListItem {
  const name = names[mod(index, names.length)]!
  const category = categories[
    mod(Math.floor(index / 7), categories.length)
  ]!
  const adjective = adjectives[
    mod(index * 3, adjectives.length)
  ]!
  const noun = nouns[
    mod(index * 5 + 2, nouns.length)
  ]!
  const unsigned =
    (Math.imul(index, 1_664_525) +
      1_013_904_223) >>> 0
  return {
    id: index,
    name,
    category,
    message: `${adjective} ${noun} #${index}`,
    timestamp: timestamp(index),
    tag: tags[mod(index * 31, tags.length)]!,
    likes: unsigned % 999,
    avatarHue: mod(index * 137, 360),
    initial: name[0]!,
  }
}

export function generateVirtualItems(
  count: number,
): readonly VirtualListItem[] {
  return Array.from(
    { length: Math.max(1, count) },
    (_, index) => virtualItemAt(index),
  )
}
