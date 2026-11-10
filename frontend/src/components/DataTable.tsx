import type { DataRecord, Dataset, Loaded } from '../data/datasets'

export function DatasetSection({
  dataset,
  state,
}: {
  dataset: Dataset
  state: Loaded
}) {
  const count = state.status === 'ready' ? state.records.length : null

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div>
          <h2 className="text-lg font-semibold text-ink">{dataset.title}</h2>
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
      {state.status === 'ready' && <DataTable records={state.records} />}
    </section>
  )
}

// Values are shown as JSON, spaces and all, so text and numbers look different.
const CELL = 'px-3 py-2 text-left align-top font-mono text-[13px] whitespace-pre'

function DataTable({ records }: { records: DataRecord[] }) {
  const columns = [...new Set(records.flatMap((record) => Object.keys(record)))]

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full">
        <thead className="border-b border-line bg-surface">
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col" className={`${CELL} align-bottom font-semibold text-ink`}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {records.map((record, index) => (
            <tr key={index} className="hover:bg-surface/60">
              {columns.map((column) => (
                <td key={column} className={CELL}>
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
