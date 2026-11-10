import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { AttainmentChart } from '../components/AttainmentChart'
import { useOverflows } from '../components/hooks'
import { RunTimeline, RunTimelineLegend } from '../components/RunTimeline'
import { Button, LowestBadge, Page, PageHeader, tooltipBox } from '../components/ui'
import { findLowestRun, useAnalysis, type Analysis, type Run } from '../data/analysis'
import { DATASETS, useDatasets } from '../data/datasets'
import { formatCount, formatNumber, formatTime } from '../format'

const QUARTER_HOUR = 15 * 60_000

// The final run-level result, in the order of the required output
const RESULT_FIELDS = [
  'run_id',
  'equipment_id',
  'product_code',
  'run_start',
  'run_end',
  'target_rate_cases_per_hour',
  'cases_produced',
  'elapsed_minutes',
  'downtime_minutes',
  'operating_minutes',
  'operating_throughput_cph',
  'target_attainment_percent',
  'data_quality_notes',
] as const

function resultRows(runs: Run[]) {
  return runs.map((run) => Object.fromEntries(RESULT_FIELDS.map((field) => [field, run[field]])))
}

// Empty cells for missing values, and quotes around text that has a comma, quote or line break
function toCsv(runs: Run[]) {
  const cell = (value: unknown) => {
    const text = value === null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return [
    RESULT_FIELDS.join(','),
    ...resultRows(runs).map((row) => RESULT_FIELDS.map((field) => cell(row[field])).join(',')),
  ].join('\n') + '\n'
}

function download(name: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

function runWindow(run: Run) {
  return `${formatTime(run.run_start)}–${run.run_end ? formatTime(run.run_end) : 'no end'}`
}

// One range for every machine, padded and rounded out to quarter hours, so the timelines line up.
function timeRange({ runs, readings, events }: Analysis) {
  const machines = new Set(runs.map((run) => run.equipment_id))
  const times = [
    ...runs.flatMap((run) => [run.run_start, run.run_end]),
    ...readings.filter((r) => machines.has(r.equipment_id)).map((r) => r.recorded_at),
    ...events
      .filter((e) => machines.has(e.equipment_id))
      .flatMap((e) => [e.start_time, e.end_time]),
  ]
    .filter((time): time is string => time !== null)
    .map((time) => Date.parse(time))
  if (times.length === 0) return null
  const start = Math.min(...times) - QUARTER_HOUR / 3
  const end = Math.max(...times) + QUARTER_HOUR / 3
  return {
    start: Math.floor(start / QUARTER_HOUR) * QUARTER_HOUR,
    end: Math.ceil(end / QUARTER_HOUR) * QUARTER_HOUR,
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3.5 sm:px-5 sm:py-4">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tracking-tight text-ink tabular-nums sm:text-[1.75rem]">
        {value}
      </p>
    </div>
  )
}

// A bordered section with its heading. Flush content, like a table, runs to the border and is
// clipped to its corners; other content isn't clipped, so chart tooltips can spill out.
function Card({
  id,
  title,
  flush = false,
  children,
}: {
  id: string
  title: string
  flush?: boolean
  children: ReactNode
}) {
  return (
    <section
      className={`min-w-0 rounded-xl border border-line ${flush ? 'overflow-hidden' : 'p-5'}`}
      aria-labelledby={id}
    >
      <h2 id={id} className={`text-lg font-semibold text-ink ${flush ? 'px-5 py-4' : 'mb-3'}`}>
        {title}
      </h2>
      {children}
    </section>
  )
}

// How each run metrics value is worked out, shown when its column name is hovered or focused
const COLUMNS: { label: string; how: string; num?: boolean }[] = [
  {
    label: 'Run',
    how: 'The run from the production runs. Lowest marks the completed run with the lowest attainment.',
  },
  { label: 'Window', how: 'Run start to run end, in UTC.' },
  {
    label: 'Readings used',
    how: "Counter readings on the run's machine taken from its start to its end, both included, or from its start on when it has no end. Left out: counts that aren't numbers, duplicates, and counts lower than the run's last good count.",
  },
  {
    label: 'Stops counted (min)',
    how: "Downtime events on the run's machine that overlap it, with the minutes each adds. Only minutes inside the run count, and time two stops share counts once.",
  },
  {
    label: 'Cases',
    how: 'Last reading used − first reading used, so for a run with no end time, the cases up to its last reading. — when no readings are used.',
    num: true,
  },
  { label: 'Elapsed (min)', how: 'Run end − run start.', num: true },
  { label: 'Downtime (min)', how: "Sum of the run's stops counted.", num: true },
  { label: 'Operating (min)', how: 'Elapsed − downtime.', num: true },
  { label: 'Throughput (cases/h)', how: '(Cases ÷ operating minutes) × 60.', num: true },
  {
    label: 'Target (cases/h)',
    how: "The run's target rate. Rates given per minute are multiplied by 60.",
    num: true,
  },
  { label: 'Attainment', how: '(Throughput ÷ target) × 100.', num: true },
]

function ColumnHeader({
  label,
  how,
  num,
  className = '',
}: (typeof COLUMNS)[number] & { className?: string }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const cell = useRef<HTMLTableCellElement>(null)
  const tip = useRef<HTMLSpanElement>(null)

  // Fixed to the window so the table's scroll box can't clip it, and kept on screen.
  useLayoutEffect(() => {
    if (!open || !cell.current || !tip.current) return
    const box = cell.current.getBoundingClientRect()
    const width = tip.current.offsetWidth
    const left = num ? box.right - 12 - width : box.left + 12
    tip.current.style.top = `${box.bottom}px`
    tip.current.style.left = `${Math.max(8, Math.min(left, window.innerWidth - width - 8))}px`
  }, [open, num])

  // Escape closes it, and so does scrolling, which would otherwise leave it behind.
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && close()
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <th
      ref={cell}
      scope="col"
      className={`px-3 py-2.5 align-bottom font-semibold text-ink ${num ? 'text-right' : 'text-left'} ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        className="cursor-help rounded-xs underline decoration-muted decoration-dotted underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        tabIndex={0}
        aria-describedby={id}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {label}
      </span>
      {/* Placed from script, flush under its header so the pointer can move onto it */}
      <span
        ref={tip}
        id={id}
        role="tooltip"
        className={`${tooltipBox} fixed text-left font-normal whitespace-normal`}
        hidden={!open}
      >
        {how}
      </span>
    </th>
  )
}

// Values stay on one line (FLOUR-A would otherwise break at the hyphen); the lists of IDs wrap.
const CELL = 'px-3 py-2.5 align-top whitespace-nowrap'
const NUM = `${CELL} text-right tabular-nums`
const LIST = 'min-w-35 px-3 py-2.5 align-top text-[13px]'
// While the table scrolls sideways, the Run column stays put so each row keeps its run.
const PINNED = 'sticky left-0 shadow-[inset_-1px_0_0_var(--color-line)]'

function RunMetricsTable({ analysis, lowest }: { analysis: Analysis | null; lowest: Run | undefined }) {
  const [ref, overflows] = useOverflows<HTMLDivElement>()

  return (
    <div ref={ref} className="overflow-x-auto border-t border-line">
      <table className="w-full text-sm">
        <thead className="border-b border-line bg-surface">
          <tr>
            {COLUMNS.map((column, i) => (
              <ColumnHeader
                key={column.label}
                {...column}
                className={overflows && i === 0 ? `${PINNED} bg-surface` : ''}
              />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {analysis?.runs.map((run) => {
            const readings = analysis.readings.filter((r) => r.run_id === run.run_id && r.used)
            const stops = analysis.events.filter((e) => e.run_id === run.run_id && e.used)
            return (
              <tr key={run.run_id} className={run === lowest ? 'bg-accent-soft' : 'bg-page'}>
                <th
                  scope="row"
                  className={`${CELL} bg-inherit text-left font-semibold text-ink ${overflows ? PINNED : ''}`}
                >
                  {run.run_id}
                  {run === lowest && <LowestBadge />}
                </th>
                <td className={CELL}>{runWindow(run)}</td>
                <td className={LIST}>{readings.map((r) => r.reading_id).join(', ') || '—'}</td>
                <td className={LIST}>
                  {stops
                    .map((e) => `${e.event_id} ${formatNumber(e.minutes_counted)}`)
                    .join(', ') || '—'}
                </td>
                <td className={NUM}>
                  {run.cases_produced === null ? '—' : formatCount(run.cases_produced)}
                </td>
                <td className={NUM}>{formatNumber(run.elapsed_minutes)}</td>
                <td className={NUM}>{formatNumber(run.downtime_minutes)}</td>
                <td className={NUM}>{formatNumber(run.operating_minutes)}</td>
                <td className={NUM}>{formatNumber(run.operating_throughput_cph)}</td>
                <td className={NUM}>{run.target_rate_cases_per_hour}</td>
                <td className={NUM}>
                  {run.target_attainment_percent === null
                    ? '—'
                    : `${run.target_attainment_percent.toFixed(1)}%`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Charts of the data loaded on the Cleaned data page; empty until it has loaded there.
function DashboardPage() {
  const analysis = useAnalysis()
  const raw = useDatasets('raw')
  const cleaned = useDatasets('cleaned')
  const runs = analysis?.runs ?? []
  const readings = analysis?.readings ?? []
  const events = analysis?.events ?? []
  const lowest = findLowestRun(runs)
  const completed = runs.filter((run) => run.target_attainment_percent !== null)
  const machines = [...new Set(runs.map((run) => run.equipment_id))]
  const range = analysis && timeRange(analysis)
  const ofAll = (part: number, all: number) => (analysis ? `${part} of ${all}` : '—')
  const busy = raw.busy || cleaned.busy
  // A refresh can fail on another page's data, so its errors show here too.
  const failures = [
    { kind: 'raw', states: raw.states },
    { kind: 'cleaned', states: cleaned.states },
  ].flatMap(({ kind, states }) =>
    (states ?? []).flatMap((state, i) =>
      state.status === 'error' ? [`Couldn't load ${kind} ${DATASETS[i].name}: ${state.message}`] : [],
    ),
  )

  return (
    <Page>
      <PageHeader title="Dashboard">
        {/* Pulls and cleans again into the Raw data and Cleaned data pages, which this page reads */}
        <Button
          onClick={() => {
            raw.load()
            cleaned.load()
          }}
          disabled={busy}
        >
          Refresh
        </Button>
        <Button
          onClick={() => download('run_metrics.csv', 'text/csv', toCsv(runs))}
          disabled={!analysis}
        >
          Download CSV
        </Button>
        <Button
          onClick={() =>
            download('run_metrics.json', 'application/json', JSON.stringify(resultRows(runs), null, 2) + '\n')
          }
          disabled={!analysis}
        >
          Download JSON
        </Button>
      </PageHeader>
      {(busy || failures.length > 0) && (
        <div className="mb-6 space-y-1 text-sm">
          {busy && <p className="text-muted">Loading…</p>}
          {failures.map((failure) => (
            <p key={failure} className="text-accent" role="alert">
              {failure}
            </p>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Completed runs" value={ofAll(completed.length, runs.length)} />
          <Stat
            label="Readings matched"
            value={ofAll(readings.filter((r) => r.run_id).length, readings.length)}
          />
          <Stat
            label="Stops matched"
            value={ofAll(events.filter((e) => e.run_id).length, events.length)}
          />
          <Stat
            label="Cases produced"
            value={
              analysis
                ? formatCount(runs.reduce((sum, run) => sum + (run.cases_produced ?? 0), 0))
                : '—'
            }
          />
        </div>

        <Card id="attainment-heading" title="Target attainment">
          <AttainmentChart runs={runs} lowest={lowest} />
        </Card>

        <Card id="timeline-heading" title="Readings and stops by run">
          <RunTimelineLegend />
          {machines.length === 0 && (
            <RunTimeline machine="No data" runs={[]} readings={[]} events={[]} range={null} lowest={undefined} />
          )}
          {machines.map((machine) => (
            <div key={machine}>
              <h3 className="mt-4 mb-2 text-[15px] font-semibold text-ink">{machine}</h3>
              <RunTimeline
                machine={machine}
                runs={runs.filter((run) => run.equipment_id === machine)}
                readings={readings.filter((r) => r.equipment_id === machine)}
                events={events.filter((e) => e.equipment_id === machine)}
                range={range}
                lowest={lowest}
              />
            </div>
          ))}
        </Card>

        <Card id="metrics-heading" title="Run metrics" flush>
          <RunMetricsTable analysis={analysis} lowest={lowest} />
        </Card>
      </div>
    </Page>
  )
}

export default DashboardPage
