import type { DataRecord, Dataset, Loaded } from '../data/datasets'
import '../App.css'
import './DataTable.css'

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
