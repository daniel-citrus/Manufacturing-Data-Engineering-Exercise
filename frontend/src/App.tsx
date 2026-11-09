import { useEffect, useState } from 'react'
import './App.css'

type Run = {
  run_id: string
  equipment_id: string
  product_code: string
  run_start: string
  run_end: string | null
  target_rate_cases_per_hour: number
  cases_produced: number | null
  elapsed_minutes: number | null
  downtime_minutes: number | null
  operating_minutes: number | null
  operating_throughput_cph: number | null
  target_attainment_percent: number | null
  data_quality_notes: string | null
}

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  hour: '2-digit',
  minute: '2-digit',
})

function formatTime(iso: string | null) {
  return iso ? timeFormat.format(new Date(iso)) : '—'
}

function formatNumber(value: number | null, digits = 1) {
  return value === null ? '—' : value.toFixed(digits)
}

function App() {
  const [runs, setRuns] = useState<Run[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/runs')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<Run[]>
      })
      .then(setRuns)
      .catch((err: Error) => setError(err.message))
  }, [])

  if (error) {
    return (
      <main>
        <h1>Production runs</h1>
        <p className="status" role="alert">
          Couldn't load runs ({error}). Is the backend running on port 8000?
        </p>
      </main>
    )
  }

  if (!runs) {
    return (
      <main>
        <h1>Production runs</h1>
        <p className="status">Loading runs…</p>
      </main>
    )
  }

  // Runs without an end time have no attainment, so they can't be ranked.
  const lowest = runs
    .filter((run) => run.target_attainment_percent !== null)
    .toSorted(
      (a, b) => a.target_attainment_percent! - b.target_attainment_percent!,
    )[0]

  return (
    <main>
      <h1>Production runs</h1>
      <p className="subtitle">
        Throughput and target attainment for each run. Times are UTC.
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Run</th>
              <th scope="col">Machine</th>
              <th scope="col">Product</th>
              <th scope="col">Start</th>
              <th scope="col">End</th>
              <th scope="col" className="num">Cases</th>
              <th scope="col" className="num">Downtime (min)</th>
              <th scope="col" className="num">Operating (min)</th>
              <th scope="col" className="num">Throughput (cases/h)</th>
              <th scope="col" className="num">Target (cases/h)</th>
              <th scope="col" className="num">Attainment</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr
                key={run.run_id}
                className={run === lowest ? 'lowest' : undefined}
              >
                <th scope="row">
                  {run.run_id}
                  {run === lowest && <span className="badge">Lowest</span>}
                </th>
                <td>{run.equipment_id}</td>
                <td>{run.product_code}</td>
                <td>{formatTime(run.run_start)}</td>
                <td>{formatTime(run.run_end)}</td>
                <td className="num">{formatNumber(run.cases_produced, 0)}</td>
                <td className="num">{formatNumber(run.downtime_minutes)}</td>
                <td className="num">{formatNumber(run.operating_minutes)}</td>
                <td className="num">
                  {formatNumber(run.operating_throughput_cph)}
                </td>
                <td className="num">
                  {formatNumber(run.target_rate_cases_per_hour, 0)}
                </td>
                <td className="num">
                  {run.target_attainment_percent === null
                    ? '—'
                    : `${run.target_attainment_percent.toFixed(1)}%`}
                </td>
                <td className="notes">{run.data_quality_notes ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lowest && (
        <p className="summary">
          Lowest-performing completed run: <strong>{lowest.run_id}</strong>, at{' '}
          {lowest.target_attainment_percent!.toFixed(1)}% of target.
        </p>
      )}
    </main>
  )
}

export default App
