import { AttainmentChart } from '../components/AttainmentChart'
import { RunTimeline } from '../components/RunTimeline'
import { findLowestRun, useAnalysis, type Analysis, type Run } from '../data/analysis'
import { formatCount, formatNumber, formatTime } from '../format'
import '../App.css'
import '../components/Dashboard.css'

const QUARTER_HOUR = 15 * 60_000

// The assumptions and decisions behind the numbers, as written in analysis/
const GROUND_RULES = [
  'Counts are a running total, so they should only go up.',
  "A reading belongs to a run on the same machine if its time is between the run's start and end, including exactly at the start or end.",
  'A stop belongs to a run on the same machine if any part of it overlaps the run.',
  'All times are in UTC, and the time zone offsets in the data are assumed to be correct.',
  'Target rates in cases/minute are multiplied by 60 to get cases/hour.',
]

const DECISIONS = [
  {
    decision: 'C010 (1760 → 25) is a glitch, so R101 is counted only up to 14:40',
    other: 'Treat it as a counter reset: R101 reaches 91.1%, and R102 becomes the lowest run',
  },
  {
    decision: 'C001 and C014, taken 1 minute before R100 and R102 start, are left out',
    other: 'Use them as starting counts: R100 reaches 94% and R102 96%',
  },
  {
    decision: "Only D002's 4 minutes inside R101 count",
    other: 'Leave D002 out: R101 downtime is 5.5 minutes instead of 9.5',
  },
  {
    decision: "D003 and D004's shared 1.5 minutes count once",
    other: 'Drop D004: those stops count 4.0 minutes instead of 5.5',
  },
  {
    decision: 'R104 has no end time, so it gets no metrics',
    other: 'Use 15:40, the last reading, as its end: 150 cases, 83%',
  },
]

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

function RunMetricsTable({ analysis, lowest }: { analysis: Analysis | null; lowest: Run | undefined }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Run</th>
            <th scope="col">Window</th>
            <th scope="col">Readings used</th>
            <th scope="col">Stops counted (min)</th>
            <th scope="col" className="num">Cases</th>
            <th scope="col" className="num">Elapsed (min)</th>
            <th scope="col" className="num">Downtime (min)</th>
            <th scope="col" className="num">Operating (min)</th>
            <th scope="col" className="num">Throughput (cases/h)</th>
            <th scope="col" className="num">Target (cases/h)</th>
            <th scope="col" className="num">Attainment</th>
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

function Assumptions() {
  return (
    <section className="assumptions" aria-labelledby="assumptions-heading">
      <h2 id="assumptions-heading">Assumptions</h2>
      <ul>
        {GROUND_RULES.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
      <h3>Decisions that change the result</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Decision</th>
              <th scope="col">Other option and its effect</th>
            </tr>
          </thead>
          <tbody>
            {DECISIONS.map(({ decision, other }) => (
              <tr key={decision}>
                <td>{decision}</td>
                <td>{other}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// Charts of the data loaded on the Cleaned data page; empty until it has loaded there.
function DashboardPage() {
  const analysis = useAnalysis()
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
                ? formatCount(completed.reduce((sum, run) => sum + run.cases_produced!, 0))
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

        <Assumptions />
      </div>
    </main>
  )
}

export default DashboardPage
