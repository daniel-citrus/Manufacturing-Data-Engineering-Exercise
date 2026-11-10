import { DatasetSection } from '../components/DataTable'
import { Button, Page, PageHeader } from '../components/ui'
import { DATASETS, useDatasets } from '../data/datasets'

function RawDataPage() {
  const { states, busy, load } = useDatasets('raw')

  return (
    <Page>
      <PageHeader title="Raw data" subtitle="The datasets as the exercise API sends them.">
        <Button variant="primary" onClick={load} disabled={busy}>
          Pull raw data
        </Button>
      </PageHeader>
      <p className="mb-10 text-sm text-muted">
        Quotes mean text,{' '}
        <code className="rounded bg-surface px-1 py-0.5 font-mono text-ink">null</code> means the
        API sent an empty value, and a blank cell means the record has no such field.
      </p>
      {states && (
        <div className="space-y-10">
          {DATASETS.map((dataset, i) => (
            <DatasetSection key={dataset.name} dataset={dataset} state={states[i]} />
          ))}
        </div>
      )}
    </Page>
  )
}

export default RawDataPage
