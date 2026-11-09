import { useEffect, useState, type MouseEvent } from 'react'
import './App.css'
import CleanedDataPage from './pages/CleanedDataPage'
import RawDataPage from './pages/RawDataPage'
import RunsPage from './pages/RunsPage'

const pages = [
  { path: '/raw', label: 'Raw data', Page: RawDataPage },
  { path: '/cleaned', label: 'Cleaned data', Page: CleanedDataPage },
  { path: '/', label: 'Run results', Page: RunsPage },
]

function App() {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // Plain left clicks switch pages in place; modified clicks keep the browser's default.
  function go(event: MouseEvent<HTMLAnchorElement>, to: string) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }
    event.preventDefault()
    if (to !== path) window.history.pushState(null, '', to)
    setPath(to)
  }

  const current = pages.find((page) => page.path === path)

  return (
    <div className="layout">
      <nav className="sidebar" aria-label="Pages">
        {pages.map(({ path: to, label }) => (
          <a
            key={to}
            href={to}
            aria-current={to === path ? 'page' : undefined}
            onClick={(event) => go(event, to)}
          >
            {label}
          </a>
        ))}
      </nav>
      <div className="content">
        {current ? (
          <current.Page />
        ) : (
          <main>
            <h1>Page not found</h1>
            <p className="subtitle">There is no page at {path}.</p>
          </main>
        )}
      </div>
    </div>
  )
}

export default App
