import { DatasetSection } from '../components/DataTable'
import { DATASETS, useDatasets } from '../data/datasets'

function CleanedDataPage() {
  const { states, busy, load } = useDatasets('cleaned')

  return (
    <main>
      <h1>Cleaned data</h1>
      <p className="subtitle">The same datasets after cleaning.</p>
      <ul className="data-steps">
        <li>Times are converted to UTC.</li>
        <li>Product codes are trimmed and uppercased.</li>
        <li>Target rates are converted to cases per hour.</li>
        <li>The payload is split into a count and a unit.</li>
        <li>Counts written as numeric text become integers.</li>
      </ul>
      <p className="data-actions">
        <button type="button" onClick={load} disabled={busy}>
          Clean data
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

export default CleanedDataPage
