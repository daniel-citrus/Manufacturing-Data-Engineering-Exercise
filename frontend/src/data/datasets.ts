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

async function fetchDataset(url: string, init?: RequestInit): Promise<Loaded> {
  try {
    const res = await fetch(url, init)
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

// Counts each store's loads, so results from a load that was replaced or cleared are dropped.
const loads: Record<DatasetKind, number> = { raw: 0, cleaned: 0 }

// The results land in the store even if the page was left while they loaded.
async function loadInto(kind: DatasetKind, fetchOne: (dataset: Dataset, i: number) => Promise<Loaded>) {
  const store = stores[kind]
  const load = ++loads[kind]
  store.set({ states: DATASETS.map(() => ({ status: 'loading' })), busy: true })
  await Promise.all(
    DATASETS.map(async (dataset, i) => {
      const state = await fetchOne(dataset, i)
      if (load !== loads[kind]) return
      const { states, busy } = store.get()
      store.set({ busy, states: states && states.map((s, j) => (j === i ? state : s)) })
    }),
  )
  if (load === loads[kind]) store.set({ ...store.get(), busy: false })
}

function allReady(states: Loaded[] | null): states is Extract<Loaded, { status: 'ready' }>[] {
  return states !== null && states.every((state) => state.status === 'ready')
}

// Pulls every dataset from the exercise API. The cleaned data came from the previous pull, so
// it's cleared until this pull is cleaned.
async function pullRaw() {
  loads.cleaned++
  stores.cleaned.set({ states: null, busy: false })
  await loadInto('raw', (dataset) => fetchDataset(`/api/raw/${dataset.name}`))
}

// Cleans the records the Raw data page pulled, so the whole app works from that one pull.
async function cleanRaw() {
  const raw = stores.raw.get().states
  if (!allReady(raw)) return
  await loadInto('cleaned', (dataset, i) =>
    fetchDataset(`/api/cleaned/${dataset.name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(raw[i].records),
    }),
  )
}

// Nothing loads until load() is called. Raw data is pulled again on each call; cleaned data is
// the current raw data cleaned, and needs every raw dataset loaded first.
export function useDatasets(kind: DatasetKind) {
  const { states, busy } = useStore(stores[kind])
  return {
    states,
    busy,
    ready: !busy && allReady(states),
    load: kind === 'raw' ? pullRaw : cleanRaw,
  }
}
