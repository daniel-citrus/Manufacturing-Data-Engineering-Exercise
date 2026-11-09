import { createStore, useStore, type Store } from './store'

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

type DatasetKind = 'raw' | 'cleaned'

type DatasetsState = { states: Loaded[] | null; busy: boolean }

const stores: Record<DatasetKind, Store<DatasetsState>> = {
  raw: createStore<DatasetsState>({ states: null, busy: false }),
  cleaned: createStore<DatasetsState>({ states: null, busy: false }),
}

async function fetchDataset(
  kind: DatasetKind,
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

// The results land in the store even if the page was left while they loaded.
async function loadDatasets(kind: DatasetKind) {
  const store = stores[kind]
  store.set({ states: DATASETS.map(() => ({ status: 'loading' })), busy: true })
  await Promise.all(
    DATASETS.map(async (dataset, i) => {
      const state = await fetchDataset(kind, dataset.name)
      const { states, busy } = store.get()
      store.set({ busy, states: states && states.map((s, j) => (j === i ? state : s)) })
    }),
  )
  store.set({ ...store.get(), busy: false })
}

// Nothing loads until load() is called; each call fetches every dataset again.
export function useDatasets(kind: DatasetKind) {
  const { states, busy } = useStore(stores[kind])
  return { states, busy, load: () => loadDatasets(kind) }
}
