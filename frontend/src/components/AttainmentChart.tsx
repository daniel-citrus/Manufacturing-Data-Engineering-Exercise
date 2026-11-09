import { useState, type KeyboardEvent } from 'react'
import type { Run } from '../data/analysis'
import { formatNumber } from '../format'
import './Dashboard.css'

const GRID = [0, 25, 50, 75, 100]

// Measured runs lowest first, then the runs without metrics. Hovering or focusing a bar shows
// its attained and target rates. With no runs it draws just the grid.
export function AttainmentChart({
  runs,
  lowest,
}: {
  runs: Run[]
  lowest: Run | undefined
}) {
  const [active, setActive] = useState<string | null>(null)
  const measured = runs
    .filter((run) => run.target_attainment_percent !== null)
    .toSorted(
      (a, b) => a.target_attainment_percent! - b.target_attainment_percent!,
    )
  const unmeasured = runs.filter((run) => run.target_attainment_percent === null)
  const max = Math.max(100, ...measured.map((run) => run.target_attainment_percent!))
  const at = (percent: number) => `${(percent / max) * 100}%`
  const attained = (run: Run) =>
    run.operating_throughput_cph === null ? '—' : `${formatNumber(run.operating_throughput_cph)} cases/h`

  // The bar area is the hit target, for the pointer and the keyboard alike.
  function hitTarget(run: Run) {
    const percent = run.target_attainment_percent
    return {
      tabIndex: 0,
      role: 'img',
      'aria-label': `${run.run_id}: ${percent === null ? 'not measured' : `${percent.toFixed(1)}% of target, attained ${attained(run)}`}, target ${run.target_rate_cases_per_hour} cases/h`,
      onPointerEnter: () => setActive(run.run_id),
      onPointerLeave: () => setActive(null),
      onFocus: () => setActive(run.run_id),
      onBlur: () => setActive(null),
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === 'Escape') setActive(null)
      },
    }
  }

  // Opens to the right only from short bars: the bar column leaves little room on the right,
  // most of all on a phone.
  function tooltip(run: Run, percent: number) {
    if (active !== run.run_id) return null
    return (
      <div
        className={percent / max > 1 / 3 ? 'chart-tooltip is-left' : 'chart-tooltip is-right'}
        style={{ left: at(percent) }}
        aria-hidden="true"
      >
        <strong>{run.run_id}</strong>
        <dl>
          <dt>Attained</dt>
          <dd>{attained(run)}</dd>
          <dt>Target</dt>
          <dd>{run.target_rate_cases_per_hour} cases/h</dd>
        </dl>
      </div>
    )
  }

  return (
    <div className={runs.length ? 'attainment' : 'attainment is-empty'}>
      <div className="attainment-grid" aria-hidden="true">
        {GRID.map((percent) => (
          <span
            key={percent}
            className={percent === 100 ? 'is-target' : percent % 50 ? 'is-minor' : undefined}
            style={{ left: at(percent) }}
          >
            <span className="attainment-tick">
              {percent === 100 ? 'Target' : `${percent}%`}
            </span>
          </span>
        ))}
      </div>
      {measured.map((run) => {
        const percent = run.target_attainment_percent!
        return (
          <div
            key={run.run_id}
            className={run === lowest ? 'attainment-row is-lowest' : 'attainment-row'}
          >
            <p className="attainment-name">
              <strong>{run.run_id}</strong>
              {run === lowest && <span className="badge">Lowest</span>}
            </p>
            <div className="attainment-scale" {...hitTarget(run)}>
              <span className="attainment-bar" style={{ width: at(percent) }} />
              <span className="attainment-value" style={{ left: at(percent) }}>
                {percent.toFixed(1)}%
              </span>
              {tooltip(run, percent)}
            </div>
          </div>
        )
      })}
      {unmeasured.map((run) => (
        <div key={run.run_id} className="attainment-row">
          <p className="attainment-name">
            <strong>{run.run_id}</strong>
          </p>
          <div className="attainment-scale" {...hitTarget(run)}>
            <span className="attainment-none">—</span>
            {tooltip(run, 0)}
          </div>
        </div>
      ))}
    </div>
  )
}
