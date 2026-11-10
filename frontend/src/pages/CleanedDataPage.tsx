import { DatasetSection } from '../components/DataTable'
import { Button, Page, PageHeader } from '../components/ui'
import { DATASETS, useDatasets } from '../data/datasets'

// Cleans what the Raw data page pulled, so it waits until that pull has fully loaded.
function CleanedDataPage() {
  const { states, busy, load } = useDatasets('cleaned')
  const raw = useDatasets('raw')

  return (
    <Page>
      <PageHeader title="Cleaned data" subtitle="The same datasets after cleaning.">
        {!raw.ready && (
          <span id="clean-hint" className="self-center text-sm text-muted">
            Pull raw data first
          </span>
        )}
        <Button
          variant="primary"
          onClick={load}
          disabled={busy || !raw.ready}
          aria-describedby={raw.ready ? undefined : 'clean-hint'}
        >
          Clean data
        </Button>
      </PageHeader>
      <ul className="mb-10 list-disc space-y-1 pl-5 text-sm text-muted">
        <li>Times are converted to UTC.</li>
        <li>Product codes are trimmed and uppercased.</li>
        <li>Target rates are converted to cases per hour.</li>
        <li>The payload is split into a count and a unit.</li>
        <li>Counts written as numeric text become integers.</li>
      </ul>
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

export default CleanedDataPage
