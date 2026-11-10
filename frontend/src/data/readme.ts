import { useEffect } from 'react'
import { createStore, useStore } from './store'

const store = createStore<{ text: string | null; error: string | null }>({
  text: null,
  error: null,
})
let inFlight = false

function loadReadme() {
  inFlight = true
  store.set({ text: null, error: null })
  fetch('/api/readme')
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.text()
    })
    .then((text) => store.set({ text, error: null }))
    .catch((err: Error) => store.set({ text: null, error: err.message }))
    .finally(() => {
      inFlight = false
    })
}

// Fetched on the first visit and kept after that; a failed load is retried on the next visit.
export function useReadme() {
  useEffect(() => {
    if (store.get().text === null && !inFlight) loadReadme()
  }, [])
  return useStore(store)
}
