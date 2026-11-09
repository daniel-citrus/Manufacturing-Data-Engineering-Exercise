import { DatasetSection } from '../components/DataTable'
import { DATASETS, useDatasets } from '../data/datasets'

function RawDataPage() {
  const { states, busy, load } = useDatasets('raw')

  return (
    <main>
      <h1>Raw data</h1>
      <p className="subtitle">The datasets as the exercise API sends them.</p>
      <p className="data-key">
        Quotes mean text, <code>null</code> means the API sent an empty value,
        and a blank cell means the record has no such field.
      </p>
      <p className="data-actions">
        <button type="button" onClick={load} disabled={busy}>
          Pull raw data
        </button>
      </p>
      {states &&
        DATASETS.map((dataset, i) => (
          <DatasetSection
            key={dataset.name}
            dataset={dataset}
            state={states[i]}
          />
        ))}
    </main>
  )
}

export default RawDataPage
