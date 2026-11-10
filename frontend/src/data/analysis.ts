import { useMemo } from 'react'
import { DATASETS, useDatasets, type DataRecord } from './datasets'

// The records as the Cleaned data page shows them
type CleanRun = {
  run_id: string
  equipment_id: string
  start_time: string
  end_time: string | null
  product_code: string
  target_hourly_rate: number
}

type CleanReading = {
  reading_id: string
  equipment_id: string
  recorded_at: string
  // A number, or the text the API sent when it isn't one ("ERROR")
  count: unknown
}

type CleanEvent = {
  event_id: string
  equipment_id: string
  start_time: string
  end_time: string | null
  reason: string
}

// A run with its metrics, which are null when it has no usable readings. A run with no end time has only its cases.
export type Run = {
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
}

export type MatchedReading = CleanReading & {
  run_id: string | null
  used: boolean
  why_not: string | null
}

export type MatchedEvent = CleanEvent & {
  run_id: string | null
  // Minutes this stop adds to its run's downtime; null when it adds none
  minutes_counted: number | null
  used: boolean
  note: string | null
}

export type Analysis = {
  runs: Run[]
  readings: MatchedReading[]
  events: MatchedEvent[]
}

const MINUTE = 60_000
const ms = (iso: string) => Date.parse(iso)

// Machine, then time, like the notebooks
function byMachineThenTime<T extends { equipment_id: string }>(time: (item: T) => string) {
  return (a: T, b: T) =>
    a.equipment_id < b.equipment_id ? -1 : a.equipment_id > b.equipment_id ? 1 : ms(time(a)) - ms(time(b))
}

// A reading belongs to a run on the same machine if its time is within the run, ends included.
function runForReading(runs: CleanRun[], reading: CleanReading) {
  const at = ms(reading.recorded_at)
  return runs.find(
    (run) =>
      run.equipment_id === reading.equipment_id &&
      ms(run.start_time) <= at &&
      (run.end_time === null || at <= ms(run.end_time)),
  )
}

// A stop belongs to a run on the same machine if any part of it overlaps the run.
function runForStop(runs: CleanRun[], stop: CleanEvent) {
  return runs.find(
    (run) =>
      run.equipment_id === stop.equipment_id &&
      (stop.end_time === null || ms(stop.end_time) > ms(run.start_time)) &&
      (run.end_time === null || ms(stop.start_time) < ms(run.end_time)),
  )
}

// Counts are a running total, so a count below the run's last good count is a glitch.
function matchReadings(runs: CleanRun[], readings: CleanReading[]): MatchedReading[] {
  const machines = new Set(runs.map((run) => run.equipment_id))
  const seen = new Set<string>()
  const lastGood = new Map<string, number>()
  return readings.toSorted(byMachineThenTime((r) => r.recorded_at)).map((reading) => {
    const run = runForReading(runs, reading)
    const key = JSON.stringify([reading.equipment_id, reading.recorded_at, reading.count])
    let whyNot: string | null = null
    if (!machines.has(reading.equipment_id)) whyNot = 'machine has no production runs'
    else if (!run) whyNot = 'outside every run'
    else if (!Number.isInteger(reading.count)) whyNot = "count isn't a number"
    else if (seen.has(key)) whyNot = 'duplicate'
    else if ((reading.count as number) < (lastGood.get(run.run_id) ?? -Infinity))
      whyNot = 'glitch: count dropped'
    else lastGood.set(run.run_id, reading.count as number)
    seen.add(key)
    return { ...reading, run_id: run?.run_id ?? null, used: whyNot === null, why_not: whyNot }
  })
}

// Only a stop's minutes inside its run count, and time shared by two stops counts once.
function matchEvents(runs: CleanRun[], events: CleanEvent[]): MatchedEvent[] {
  const countedUntil = new Map<string, number>()
  return events.toSorted(byMachineThenTime((e) => e.start_time)).map((event) => {
    const run = runForStop(runs, event)
    const row = { ...event, run_id: run?.run_id ?? null, minutes_counted: null, used: false }
    if (!run) return { ...row, note: 'outside every run' }
    if (run.end_time === null) return { ...row, note: 'run has no end time' }
    const start = ms(event.start_time)
    const runStart = ms(run.start_time)
    const runEnd = ms(run.end_time)
    const insideFrom = Math.max(start, runStart)
    const insideTo = Math.min(event.end_time === null ? runEnd : ms(event.end_time), runEnd)
    const countFrom = Math.max(insideFrom, countedUntil.get(run.run_id) ?? runStart)
    const counted = Math.max(0, (insideTo - countFrom) / MINUTE)
    countedUntil.set(run.run_id, Math.max(insideTo, countedUntil.get(run.run_id) ?? runStart))
    const note =
      start < runStart
        ? `starts before ${run.run_id}: only the overlap counts`
        : counted < (insideTo - insideFrom) / MINUTE
          ? 'shares time with an earlier stop: counted once'
          : null
    return { ...row, minutes_counted: counted, used: true, note }
  })
}

// The same metrics as notebook 04. A run without usable readings has none, and one without an end time
// has only its cases, since there's no operating time without an end.
function runMetrics(run: CleanRun, readings: MatchedReading[], events: MatchedEvent[]): Run {
  const row: Run = {
    run_id: run.run_id,
    equipment_id: run.equipment_id,
    product_code: run.product_code,
    run_start: run.start_time,
    run_end: run.end_time,
    target_rate_cases_per_hour: run.target_hourly_rate,
    cases_produced: null,
    elapsed_minutes: null,
    downtime_minutes: null,
    operating_minutes: null,
    operating_throughput_cph: null,
    target_attainment_percent: null,
  }
  const used = readings.filter((r) => r.run_id === run.run_id && r.used)
  if (used.length === 0) return row
  const cases = (used.at(-1)!.count as number) - (used[0].count as number)
  if (run.end_time === null) return { ...row, cases_produced: cases }
  const elapsed = (ms(run.end_time) - ms(run.start_time)) / MINUTE
  const downtime = events
    .filter((e) => e.run_id === run.run_id && e.used)
    .reduce((sum, e) => sum + e.minutes_counted!, 0)
  const operating = elapsed - downtime
  const throughput = (cases / operating) * 60
  return {
    ...row,
    cases_produced: cases,
    elapsed_minutes: elapsed,
    downtime_minutes: downtime,
    operating_minutes: operating,
    operating_throughput_cph: throughput,
    target_attainment_percent: (throughput / run.target_hourly_rate) * 100,
  }
}

function analyze(runs: CleanRun[], readings: CleanReading[], events: CleanEvent[]): Analysis {
  const matchedReadings = matchReadings(runs, readings)
  const matchedEvents = matchEvents(runs, events)
  return {
    runs: runs.map((run) => runMetrics(run, matchedReadings, matchedEvents)),
    readings: matchedReadings,
    events: matchedEvents,
  }
}

// Runs without an end time have no attainment, so they can't be ranked.
export function findLowestRun(runs: Run[]): Run | undefined {
  return runs
    .filter((run) => run.target_attainment_percent !== null)
    .toSorted(
      (a, b) => a.target_attainment_percent! - b.target_attainment_percent!,
    )[0]
}

// Uses the data the Cleaned data page loaded. Null until all three datasets have loaded there.
export function useAnalysis(): Analysis | null {
  const { states } = useDatasets('cleaned')
  return useMemo(() => {
    const records = (name: string): DataRecord[] | null => {
      const state = states?.[DATASETS.findIndex((dataset) => dataset.name === name)]
      return state?.status === 'ready' ? state.records : null
    }
    const runs = records('production_runs')
    const readings = records('counter_readings')
    const events = records('downtime_events')
    if (!runs || !readings || !events) return null
    return analyze(
      runs as CleanRun[],
      readings as CleanReading[],
      events as CleanEvent[],
    )
  }, [states])
}
