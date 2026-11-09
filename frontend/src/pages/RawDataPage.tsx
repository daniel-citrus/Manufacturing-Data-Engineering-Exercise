import { useEffect, useState } from 'react'
import {
  DATASETS,
  DatasetSection,
  fetchDataset,
  type Loaded,
} from '../components/DataTable'

function RawDataPage() {
  const [states, setStates] = useState<Loaded[]>(
    DATASETS.map(() => ({ status: 'loading' })),
  )

  useEffect(() => {
    let active = true
    DATASETS.forEach((dataset, i) => {
      fetchDataset('raw', dataset.name).then((state) => {
        if (active) setStates((prev) => prev.map((s, j) => (j === i ? state : s)))
      })
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <main>
      <h1>Raw data</h1>
      <p className="subtitle">The datasets as the exercise API sends them.</p>
      <p className="data-key">
        Quotes mean text, <code>null</code> means the API sent an empty value,
        and a blank cell means the record has no such field.
      </p>
      {DATASETS.map((dataset, i) => (
        <DatasetSection key={dataset.name} dataset={dataset} state={states[i]} />
      ))}
    </main>
  )
}

export default RawDataPage
