import { useState, type KeyboardEvent } from 'react'
import type { Run } from '../data/analysis'
import { formatNumber } from '../format'
import { LowestBadge, tooltipBox } from './ui'

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
  // most of all on a phone. Sits above the bar's end.
  function tooltip(run: Run, percent: number) {
    if (active !== run.run_id) return null
    return (
      <div
        className={`${tooltipBox} pointer-events-none absolute -top-2 -translate-y-full ${percent / max > 1 / 3 ? 'translate-x-[calc(-100%+12px)]' : '-translate-x-3'}`}
        style={{ left: at(percent) }}
        aria-hidden="true"
      >
        <strong className="block text-sm text-ink">{run.run_id}</strong>
        <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
          <dt>Attained</dt>
          <dd className="text-right font-semibold text-ink tabular-nums">{attained(run)}</dd>
          <dt>Target</dt>
          <dd className="text-right font-semibold text-ink tabular-nums">
            {run.target_rate_cases_per_hour} cases/h
          </dd>
        </dl>
      </div>
    )
  }

  // Each row is a name and a bar area; the bar area leaves room on the right for the value at
  // the bar's tip, and its hit area also covers the gaps between rows and that room.
  const name = 'text-sm text-ink'
  const scale =
    'group relative mr-14 h-5 rounded-xs before:absolute before:-inset-y-[7px] before:-right-14 before:left-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink'

  return (
    <div
      className={`@container relative grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-4 gap-y-3.5 pt-6 ${runs.length ? '' : 'min-h-45'}`}
    >
      {/* Spans every row of the bar column (absolutely placed grid children don't take a row) */}
      <div className="pointer-events-none absolute inset-y-0 right-14 left-0 col-start-2" aria-hidden="true">
        {GRID.map((percent) => (
          <span
            key={percent}
            className={`absolute top-5 bottom-0 w-px ${percent === 100 ? 'bg-muted' : 'bg-line'}`}
            style={{ left: at(percent) }}
          >
            <span
              className={`absolute -top-5 -translate-x-1/2 text-[11px] whitespace-nowrap text-muted tabular-nums ${percent % 50 ? '@max-[420px]:hidden' : ''}`}
            >
              {percent === 100 ? 'Target' : `${percent}%`}
            </span>
          </span>
        ))}
      </div>
      {measured.map((run) => {
        const percent = run.target_attainment_percent!
        return (
          <div key={run.run_id} className="contents">
            <p className={name}>
              <strong>{run.run_id}</strong>
              {run === lowest && <LowestBadge />}
            </p>
            <div className={scale} {...hitTarget(run)}>
              <span
                className={`block h-full rounded-r group-hover:opacity-80 group-focus-visible:opacity-80 ${run === lowest ? 'bg-accent' : 'bg-chart-bar'}`}
                style={{ width: at(percent) }}
              />
              {/* The background keeps the target line from running through the value */}
              <span
                className="absolute top-1/2 translate-x-[3px] -translate-y-1/2 bg-page px-[3px] text-[13px] font-semibold whitespace-nowrap text-ink tabular-nums"
                style={{ left: at(percent) }}
              >
                {percent.toFixed(1)}%
              </span>
              {tooltip(run, percent)}
            </div>
          </div>
        )
      })}
      {unmeasured.map((run) => (
        <div key={run.run_id} className="contents">
          <p className={name}>
            <strong>{run.run_id}</strong>
          </p>
          <div className={scale} {...hitTarget(run)}>
            {/* The background hides the 0% gridline behind the dash */}
            <span className="absolute top-1/2 -translate-y-1/2 bg-page pr-1.5 text-[13px] text-muted">
              —
            </span>
            {tooltip(run, 0)}
          </div>
        </div>
      ))}
    </div>
  )
}
