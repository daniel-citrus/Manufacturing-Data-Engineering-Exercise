const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  hour: '2-digit',
  minute: '2-digit',
})

const timeWithSecondsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

// "13:30" in UTC, or "14:43:30" when the seconds aren't zero
export function formatTime(iso: string | null) {
  if (!iso) return '—'
  const date = new Date(iso)
  return (date.getUTCSeconds() ? timeWithSecondsFormat : timeFormat).format(date)
}

export function formatNumber(value: number | null, digits = 1) {
  return value === null ? '—' : value.toFixed(digits)
}

// 1,760
export function formatCount(value: number) {
  return value.toLocaleString('en-US')
}
