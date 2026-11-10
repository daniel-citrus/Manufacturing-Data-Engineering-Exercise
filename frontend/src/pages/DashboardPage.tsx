import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { AttainmentChart } from '../components/AttainmentChart'
import { RunTimeline } from '../components/RunTimeline'
import { findLowestRun, useAnalysis, type Analysis, type Run } from '../data/analysis'
import { useDatasets } from '../data/datasets'
import { formatCount, formatNumber, formatTime } from '../format'
import '../App.css'
import '../components/Dashboard.css'

const QUARTER_HOUR = 15 * 60_000

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
    <div className="stat">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
    </div>
  )
}

function Legend() {
  return (
    <ul className="legend">
      <li>
        <svg width="24" height="12" aria-hidden="true">
          <line className="timeline-count" x1="2" x2="22" y1="6" y2="6" />
          <circle className="timeline-reading" cx="12" cy="6" r="4" />
        </svg>
        Counted reading
      </li>
      <li>
        <svg width="12" height="12" aria-hidden="true">
          <circle className="timeline-reading is-unused" cx="6" cy="6" r="4" />
        </svg>
        Reading not used
      </li>
      <li>
        <svg width="12" height="12" aria-hidden="true">
          <path className="timeline-no-count" d="M2,2l8,8m0,-8l-8,8" />
        </svg>
        Count isn't a number
      </li>
      <li>
        <svg width="20" height="12" aria-hidden="true">
          <rect className="timeline-stop" x="1" y="1" width="18" height="10" rx="2" />
        </svg>
        Downtime counted
      </li>
      <li>
        <svg width="20" height="12" aria-hidden="true">
          <rect className="timeline-stop is-unused" x="1" y="1" width="18" height="10" rx="2" />
        </svg>
        Downtime not counted
      </li>
      <li>
        <svg width="20" height="12" aria-hidden="true">
          <rect className="timeline-run legend-run" x="0.5" y="0.5" width="19" height="11" />
        </svg>
        Run
      </li>
    </ul>
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
  { label: 'Throughput (cases/h)', how: 'Cases ÷ operating minutes × 60.', num: true },
  {
    label: 'Target (cases/h)',
    how: "The run's target rate. Rates given per minute are multiplied by 60.",
    num: true,
  },
  { label: 'Attainment', how: 'Throughput ÷ target × 100.', num: true },
]

function ColumnHeader({ label, how, num }: (typeof COLUMNS)[number]) {
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
      className={num ? 'num' : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        className="column-name"
        tabIndex={0}
        aria-describedby={id}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {label}
      </span>
      <span ref={tip} id={id} role="tooltip" className="chart-tooltip column-tip" hidden={!open}>
        {how}
      </span>
    </th>
  )
}

function RunMetricsTable({ analysis, lowest }: { analysis: Analysis | null; lowest: Run | undefined }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <ColumnHeader key={column.label} {...column} />
            ))}
          </tr>
        </thead>
        <tbody>
          {analysis?.runs.map((run) => {
            const readings = analysis.readings.filter((r) => r.run_id === run.run_id && r.used)
            const stops = analysis.events.filter((e) => e.run_id === run.run_id && e.used)
            return (
              <tr key={run.run_id} className={run === lowest ? 'lowest' : undefined}>
                <th scope="row">
                  {run.run_id}
                  {run === lowest && <span className="badge">Lowest</span>}
                </th>
                <td>{runWindow(run)}</td>
                <td className="list">
                  {readings.map((r) => r.reading_id).join(', ') || '—'}
                </td>
                <td className="list">
                  {stops
                    .map((e) => `${e.event_id} ${formatNumber(e.minutes_counted)}`)
                    .join(', ') || '—'}
                </td>
                <td className="num">
                  {run.cases_produced === null ? '—' : formatCount(run.cases_produced)}
                </td>
                <td className="num">{formatNumber(run.elapsed_minutes)}</td>
                <td className="num">{formatNumber(run.downtime_minutes)}</td>
                <td className="num">{formatNumber(run.operating_minutes)}</td>
                <td className="num">{formatNumber(run.operating_throughput_cph)}</td>
                <td className="num">{run.target_rate_cases_per_hour}</td>
                <td className="num">
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

  return (
    <main className="dashboard">
      <h1>Dashboard</h1>
      {/* Pulls and cleans again into the Raw data and Cleaned data pages, which this page reads */}
      <p className="data-actions">
        <button
          type="button"
          onClick={() => {
            raw.load()
            cleaned.load()
          }}
          disabled={raw.busy || cleaned.busy}
        >
          Refresh
        </button>
      </p>
      <div className="dashboard-body">
        <div className="stats">
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

        <section className="card" aria-labelledby="attainment-heading">
          <h2 id="attainment-heading">Target attainment</h2>
          <AttainmentChart runs={runs} lowest={lowest} />
        </section>

        <section className="card" aria-labelledby="timeline-heading">
          <h2 id="timeline-heading">Readings and stops by run</h2>
          <Legend />
          {machines.length === 0 && (
            <RunTimeline machine="No data" runs={[]} readings={[]} events={[]} range={null} lowest={undefined} />
          )}
          {machines.map((machine) => (
            <div key={machine} className="timeline-machine">
              <h3>{machine}</h3>
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
        </section>

        <section aria-labelledby="metrics-heading">
          <h2 id="metrics-heading">Run metrics</h2>
          <RunMetricsTable analysis={analysis} lowest={lowest} />
        </section>
      </div>
    </main>
  )
}

export default DashboardPage
