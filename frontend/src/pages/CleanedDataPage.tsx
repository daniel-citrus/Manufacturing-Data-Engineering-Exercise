import { useEffect, useRef, useState } from 'react'
import {
  DATASETS,
  DatasetSection,
  fetchDataset,
  type Loaded,
} from '../components/DataTable'

function CleanedDataPage() {
  const [states, setStates] = useState<Loaded[] | null>(null)
  const [busy, setBusy] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  async function clean() {
    setBusy(true)
    setStates(DATASETS.map(() => ({ status: 'loading' })))
    await Promise.all(
      DATASETS.map(async (dataset, i) => {
        const state = await fetchDataset('cleaned', dataset.name)
        if (mounted.current) {
          setStates((prev) => prev && prev.map((s, j) => (j === i ? state : s)))
        }
      }),
    )
    if (mounted.current) setBusy(false)
  }

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
        <button type="button" onClick={clean} disabled={busy}>
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
