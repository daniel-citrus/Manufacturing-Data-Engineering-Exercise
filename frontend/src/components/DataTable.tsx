import '../App.css'
import './DataTable.css'

export type DataRecord = Record<string, unknown>

export type Dataset = {
  name: string
  title: string
  description: string
}

export const DATASETS: Dataset[] = [
  {
    name: 'production_runs',
    title: 'Production runs',
    description: 'Production-run windows, products, equipment, and target rates',
  },
  {
    name: 'counter_readings',
    title: 'Counter readings',
    description:
      'Timestamped cumulative case-counter readings with a JSON payload',
  },
  {
    name: 'downtime_events',
    title: 'Downtime events',
    description:
      'Timestamped equipment downtime intervals and recorded reasons',
  },
]

// Each dataset loads on its own so one failure leaves the others showing.
export type Loaded =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; records: DataRecord[] }

export async function fetchDataset(
  kind: 'raw' | 'cleaned',
  name: string,
): Promise<Loaded> {
  try {
    const res = await fetch(`/api/${kind}/${name}`)
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        detail?: unknown
      } | null
      const detail = typeof body?.detail === 'string' ? body.detail : null
      return { status: 'error', message: detail ?? `HTTP ${res.status}` }
    }
    return { status: 'ready', records: (await res.json()) as DataRecord[] }
  } catch (err) {
    return { status: 'error', message: (err as Error).message }
  }
}

export function DatasetSection({
  dataset,
  state,
}: {
  dataset: Dataset
  state: Loaded
}) {
  return (
    <section className="data-section">
      <h2>{dataset.title}</h2>
      <p className="subtitle">{dataset.description}</p>
      {state.status === 'loading' && <p className="status">Loading…</p>}
      {state.status === 'error' && (
        <p className="status data-error" role="alert">
          Couldn't load {dataset.name}: {state.message}
        </p>
      )}
      {state.status === 'ready' && (
        <DataTable records={state.records} count={state.records.length} />
      )}
    </section>
  )
}

function DataTable({
  records,
  count,
}: {
  records: DataRecord[]
  count: number
}) {
  const columns = [...new Set(records.flatMap((record) => Object.keys(record)))]

  return (
    <>
      <p className="status">
        {count} {count === 1 ? 'record' : 'records'}
      </p>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((record, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column}>
                    {column in record ? JSON.stringify(record[column]) : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default DataTable
