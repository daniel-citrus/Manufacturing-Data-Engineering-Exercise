import { useId } from 'react'
import type { DataRecord, Dataset, Loaded } from '../data/datasets'
import { useOverflows } from './hooks'

export function DatasetSection({
  dataset,
  state,
}: {
  dataset: Dataset
  state: Loaded
}) {
  const id = useId()
  const count = state.status === 'ready' ? state.records.length : null

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div>
          <h2 id={id} className="text-lg font-semibold text-ink">
            {dataset.title}
          </h2>
          <p className="text-sm text-muted">{dataset.description}</p>
        </div>
        {count !== null && (
          <p className="text-sm text-muted tabular-nums">
            {count} {count === 1 ? 'record' : 'records'}
          </p>
        )}
      </div>
      {state.status === 'loading' && <p className="text-sm text-muted">Loading…</p>}
      {state.status === 'error' && (
        <p className="text-sm text-accent" role="alert">
          Couldn't load {dataset.name}: {state.message}
        </p>
      )}
      {state.status === 'ready' && <DataTable records={state.records} labelledBy={id} />}
    </section>
  )
}

// Values are shown as JSON, spaces and all, so text and numbers look different.
const CELL = 'px-3 py-2 text-left align-top font-mono text-[13px] whitespace-pre'
// While the table scrolls sideways, its first column stays put so each row keeps its ID.
const PINNED = 'sticky left-0 shadow-[inset_-1px_0_0_var(--color-line)]'

function DataTable({ records, labelledBy }: { records: DataRecord[]; labelledBy: string }) {
  const columns = [...new Set(records.flatMap((record) => Object.keys(record)))]
  const [ref, overflows] = useOverflows<HTMLDivElement>()
  const pinned = (i: number) => (overflows && i === 0 ? PINNED : '')

  // A box that scrolls takes focus, so the keyboard can scroll it too.
  return (
    <div
      ref={ref}
      role="region"
      aria-labelledby={labelledBy}
      tabIndex={overflows ? 0 : undefined}
      className="overflow-x-auto rounded-xl border border-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <table className="w-full">
        <thead className="border-b border-line bg-surface">
          <tr>
            {columns.map((column, i) => (
              <th
                key={column}
                scope="col"
                className={`${CELL} bg-surface align-bottom font-semibold text-ink ${pinned(i)}`}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {records.map((record, index) => (
            <tr key={index} className="bg-page hover:bg-surface">
              {columns.map((column, i) => (
                <td key={column} className={`${CELL} bg-inherit ${pinned(i)}`}>
                  {column in record ? JSON.stringify(record[column]) : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
