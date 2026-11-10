import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import type { MatchedEvent, MatchedReading, Run } from '../data/analysis'
import { formatCount, formatNumber, formatTime } from '../format'
import './Dashboard.css'

// Layout, in pixels. Run names sit above the plot; the "No count" row and the stop lanes sit below it.
const LEFT = 64
const RIGHT = 16
const TOP = 28
const PLOT = 150
const ROW = 22
const AXIS = 24
const MINUTE = 60_000
// Below this plot width, labels of unused readings would collide, so only the tooltip names them.
const LABEL_WIDTH = 640

type Shape =
  | { kind: 'circle'; cx: number; cy: number }
  | { kind: 'rect'; x: number; y: number; width: number; height: number }

type Item = {
  key: string
  time: number
  // Where the tooltip points
  x: number
  y: number
  title: string
  lines: string[]
  shape: Shape
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

// The smallest of 1, 2, 2.5 or 5 times a power of ten that is at least raw
function niceStep(raw: number) {
  const power = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 2.5, 5, 10].map((m) => m * power).find((step) => step >= raw)!
}

function compact(count: number) {
  return count >= 1000 ? `${count / 1000}K` : String(count)
}

// Stops that overlap go on separate lanes, so neither hides the other.
function assignLanes(events: MatchedEvent[], end: number) {
  const laneEnds: number[] = []
  return events.map((event) => {
    const from = Date.parse(event.start_time)
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= from)
    if (lane === -1) lane = laneEnds.push(0) - 1
    laneEnds[lane] = event.end_time ? Date.parse(event.end_time) : end
    return lane
  })
}

function describeReading(reading: MatchedReading) {
  const where = reading.run_id ? ` · ${reading.run_id}` : ''
  const use = reading.used ? 'counted' : `not used (${reading.why_not})`
  return `${reading.reading_id} at ${formatTime(reading.recorded_at)}${where} · ${use}`
}

function stopTitle(event: MatchedEvent) {
  if (!event.used || event.minutes_counted === null) return 'Not counted'
  const counted = formatNumber(event.minutes_counted)
  const total = event.end_time
    ? (Date.parse(event.end_time) - Date.parse(event.start_time)) / MINUTE
    : null
  return total !== null && formatNumber(total) !== counted
    ? `${counted} of ${formatNumber(total)} min counted`
    : `${counted} min counted`
}

export function RunTimeline({
  machine,
  runs,
  readings,
  events,
  range,
  lowest,
}: {
  machine: string
  runs: Run[]
  readings: MatchedReading[]
  events: MatchedEvent[]
  // The time range every machine shares, in epoch milliseconds. Null draws an empty chart.
  range: { start: number; end: number } | null
  lowest: Run | undefined
}) {
  const [ref, width] = useWidth()
  const [active, setActive] = useState<number | null>(null)
  const [focusIndex, setFocusIndex] = useState(0)
  const hits = useRef<(SVGElement | null)[]>([])
  const id = useId()
  const { start, end } = range ?? { start: 0, end: 1 }

  const plotWidth = Math.max(0, width - LEFT - RIGHT)
  const x = (iso: string | null) =>
    LEFT + (((iso ? Date.parse(iso) : end) - start) / (end - start)) * plotWidth

  const counts = readings
    .map((reading) => reading.count)
    .filter((count): count is number => typeof count === 'number')
  const step = niceStep(Math.max(1, ...counts) / 4)
  const top = Math.ceil(Math.max(1, ...counts) / step) * step
  const y = (count: number) => TOP + PLOT - (count / top) * PLOT
  const yTicks = Array.from({ length: top / step + 1 }, (_, i) => i * step)

  const noCountRow = readings.some((reading) => typeof reading.count !== 'number')
  const noCountY = TOP + PLOT + ROW / 2
  const lanes = assignLanes(events, end)
  const lanesTop = TOP + PLOT + (noCountRow ? ROW : 0)
  const laneY = (lane: number) => lanesTop + lane * ROW + ROW / 2
  const height = lanesTop + Math.max(1, ...lanes.map((lane) => lane + 1)) * ROW + AXIS

  const minutes = (end - start) / MINUTE
  const tickEvery = [15, 30, 60].find((m) => (plotWidth / minutes) * m >= 44) ?? 60
  const xTicks: number[] = []
  for (let t = Math.ceil(start / (tickEvery * MINUTE)) * tickEvery * MINUTE; range && t <= end; t += tickEvery * MINUTE) {
    xTicks.push(t)
  }

  // Readings at the same time and count (a duplicate) share one mark and one tooltip.
  const byPosition = new Map<string, MatchedReading[]>()
  for (const r of readings) {
    const key = `${r.recorded_at}|${JSON.stringify(r.count)}`
    byPosition.set(key, [...(byPosition.get(key) ?? []), r])
  }
  const groups = [...byPosition.values()]
  const markY = (reading: MatchedReading) =>
    typeof reading.count === 'number' ? y(reading.count) : noCountY

  const items: Item[] = [
    ...runs.map((run): Item => {
      const x0 = x(run.run_start)
      const x1 = x(run.run_end)
      const attainment = run.target_attainment_percent
      return {
        key: run.run_id,
        time: Date.parse(run.run_start),
        x: (x0 + x1) / 2,
        y: TOP - 4,
        title:
          attainment === null
            ? run.run_end
              ? 'No metrics'
              : 'No end time, so no attainment'
            : `${attainment.toFixed(1)}% of target`,
        lines: [
          `${run.run_id} · ${formatTime(run.run_start)}–${run.run_end ? formatTime(run.run_end) : 'no end'} · ${run.product_code}`,
          ...(run.cases_produced === null
            ? []
            : run.operating_throughput_cph === null
              ? [`${formatCount(run.cases_produced)} cases`]
              : [
                  `${formatCount(run.cases_produced)} cases · ${formatNumber(run.operating_throughput_cph)} of ${run.target_rate_cases_per_hour} cases/h`,
                ]),
        ],
        shape: { kind: 'rect', x: x0, y: TOP, width: x1 - x0, height: PLOT },
      }
    }),
    ...groups.map((group): Item => {
      const [first] = group
      const cx = x(first.recorded_at)
      const cy = markY(first)
      return {
        key: first.reading_id,
        time: Date.parse(first.recorded_at),
        x: cx,
        y: cy - 10,
        title:
          typeof first.count === 'number'
            ? `${formatCount(first.count)} cases`
            : `Count ${JSON.stringify(first.count)}`,
        lines: group.map(describeReading),
        shape: { kind: 'circle', cx, cy },
      }
    }),
    ...events.map((event, i): Item => {
      const x0 = x(event.start_time)
      const x1 = x(event.end_time)
      const hitWidth = Math.max(x1 - x0, 16)
      return {
        key: event.event_id,
        time: Date.parse(event.start_time),
        x: (x0 + x1) / 2,
        y: laneY(lanes[i]) - ROW / 2,
        title: stopTitle(event),
        lines: [
          `${event.event_id} · ${formatTime(event.start_time)}–${event.end_time ? formatTime(event.end_time) : 'no end'} · ${event.reason}`,
          (event.run_id ?? 'No run') + (event.note ? ` · ${event.note}` : ''),
        ],
        shape: {
          kind: 'rect',
          x: (x0 + x1 - hitWidth) / 2,
          y: laneY(lanes[i]) - ROW / 2,
          width: hitWidth,
          height: ROW,
        },
      }
    }),
  ].toSorted((a, b) => a.time - b.time)

  function onKeyDown(event: KeyboardEvent, index: number) {
    if (event.key === 'Escape') return setActive(null)
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: items.length - 1 }[
      event.key
    ]
    if (next === undefined) return
    event.preventDefault()
    hits.current[Math.min(Math.max(next, 0), items.length - 1)]?.focus()
  }

  const shown = active === null ? null : items[active]
  const showLabels = plotWidth >= LABEL_WIDTH

  return (
    <div className="timeline" ref={ref}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="group"
          aria-label={`${machine}: runs, counter readings and downtime over time`}
        >
          <defs>
            {/* A run or stop with no end fades out instead of stopping at the edge. Set as a style,
                since the classes' fill would override a fill attribute. */}
            <linearGradient id={`${id}-run`}>
              <stop offset="0.5" className="timeline-fade-run" />
              <stop offset="1" className="timeline-fade-run" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${id}-stop`}>
              <stop offset="0.3" className="timeline-fade-stop" />
              <stop offset="1" className="timeline-fade-stop" stopOpacity="0" />
            </linearGradient>
          </defs>

          <g aria-hidden="true">
            {runs.map((run) => (
              <rect
                key={run.run_id}
                className="timeline-run"
                x={x(run.run_start)}
                y={TOP}
                width={x(run.run_end) - x(run.run_start)}
                height={PLOT}
                style={run.run_end ? undefined : { fill: `url(#${id}-run)` }}
              />
            ))}
            {events.map((event) => (
              <rect
                key={event.event_id}
                className="timeline-stop-wash"
                x={x(event.start_time)}
                y={TOP}
                width={Math.max(1, x(event.end_time) - x(event.start_time))}
                height={PLOT}
                style={event.end_time ? undefined : { fill: `url(#${id}-stop)` }}
              />
            ))}
            {yTicks.map((tick) => (
              <g key={tick}>
                <line
                  className={tick === 0 ? 'timeline-baseline' : 'timeline-grid'}
                  x1={LEFT}
                  x2={width - RIGHT}
                  y1={y(tick)}
                  y2={y(tick)}
                />
                {range && (
                  <text className="timeline-axis" x={LEFT - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle">
                    {compact(tick)}
                  </text>
                )}
              </g>
            ))}

            {runs.map((run) => {
              const x0 = x(run.run_start)
              const room = x(run.run_end) - x0 - 8
              const extra = run === lowest ? ' · Lowest' : run.run_end ? '' : ' · no end'
              return (
                <text key={run.run_id} className="timeline-run-name" x={x0 + 4} y={TOP - 10}>
                  {run.run_id}
                  {extra && room >= 90 && <tspan className="timeline-run-extra">{extra}</tspan>}
                </text>
              )
            })}

            {runs.map((run) => {
              const used = readings.filter(
                (r) => r.run_id === run.run_id && r.used && typeof r.count === 'number',
              )
              if (used.length < 2) return null
              const path = used
                .map((r, i) => `${i ? 'L' : 'M'}${x(r.recorded_at)},${y(r.count as number)}`)
                .join('')
              return <path key={run.run_id} className="timeline-count" d={path} />
            })}

            {groups.map((group) => {
              const [first] = group
              const cx = x(first.recorded_at)
              const cy = markY(first)
              const unused = group.filter((r) => !r.used).map((r) => r.reading_id)
              const label = showLabels && unused.length > 0 && (
                <text
                  className="timeline-label"
                  x={typeof first.count === 'number' ? cx : cx + 9}
                  y={typeof first.count === 'number' ? cy - 10 : cy}
                  textAnchor={typeof first.count === 'number' ? 'middle' : 'start'}
                  dominantBaseline={typeof first.count === 'number' ? 'auto' : 'middle'}
                >
                  {unused.join(', ')}
                </text>
              )
              if (typeof first.count !== 'number') {
                return (
                  <g key={first.reading_id}>
                    <path className="timeline-no-count" d={`M${cx - 4},${cy - 4}l8,8m0,-8l-8,8`} />
                    {label}
                  </g>
                )
              }
              return (
                <g key={first.reading_id}>
                  <circle
                    className={group.some((r) => r.used) ? 'timeline-reading' : 'timeline-reading is-unused'}
                    cx={cx}
                    cy={cy}
                    r={4}
                  />
                  {label}
                </g>
              )
            })}

            {noCountRow && (
              <text className="timeline-axis" x={LEFT - 8} y={noCountY} textAnchor="end" dominantBaseline="middle">
                No count
              </text>
            )}
            <line className="timeline-grid" x1={LEFT} x2={width - RIGHT} y1={lanesTop} y2={lanesTop} />
            <text className="timeline-axis" x={LEFT - 8} y={laneY(0)} textAnchor="end" dominantBaseline="middle">
              Stops
            </text>
            {events.map((event, i) => (
              <rect
                key={event.event_id}
                className={event.used ? 'timeline-stop' : 'timeline-stop is-unused'}
                x={x(event.start_time)}
                y={laneY(lanes[i]) - 5}
                width={Math.max(3, x(event.end_time) - x(event.start_time))}
                height={10}
                rx={2}
                style={event.end_time || !event.used ? undefined : { fill: `url(#${id}-stop)` }}
              />
            ))}

            {xTicks.map((tick) => (
              <text
                key={tick}
                className="timeline-axis"
                x={x(new Date(tick).toISOString())}
                y={height - 6}
                textAnchor="middle"
              >
                {formatTime(new Date(tick).toISOString())}
              </text>
            ))}
          </g>

          <g>
            {items.map((item, i) => {
              const common = {
                ref: (el: SVGElement | null) => {
                  hits.current[i] = el
                },
                className: active === i ? 'timeline-hit is-active' : 'timeline-hit',
                tabIndex: i === focusIndex ? 0 : -1,
                role: 'img',
                'aria-label': [item.title, ...item.lines].join(', '),
                onPointerEnter: () => setActive(i),
                onPointerLeave: () => setActive(null),
                onFocus: () => {
                  setFocusIndex(i)
                  setActive(i)
                },
                onBlur: () => setActive(null),
                onKeyDown: (event: KeyboardEvent) => onKeyDown(event, i),
              }
              return item.shape.kind === 'circle' ? (
                <circle key={item.key} {...common} cx={item.shape.cx} cy={item.shape.cy} r={12} />
              ) : (
                <rect
                  key={item.key}
                  {...common}
                  x={item.shape.x}
                  y={item.shape.y}
                  width={item.shape.width}
                  height={item.shape.height}
                  rx={4}
                />
              )
            })}
          </g>
        </svg>
      )}

      {shown && (
        <div
          className={shown.y < 70 ? 'chart-tooltip is-below' : 'chart-tooltip'}
          style={{
            left: Math.min(Math.max(shown.x, 120), width - 120),
            top: shown.y < 70 ? shown.y + 30 : shown.y,
          }}
          aria-hidden="true"
        >
          <strong>{shown.title}</strong>
          {shown.lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      )}
    </div>
  )
}
