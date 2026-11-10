import { useEffect, useState, type MouseEvent } from 'react'
import { Page, PageHeader } from './components/ui'
import CleanedDataPage from './pages/CleanedDataPage'
import DashboardPage from './pages/DashboardPage'
import RawDataPage from './pages/RawDataPage'
import ReadmePage from './pages/ReadmePage'

const pages = [
  { path: '/', label: 'README', Page: ReadmePage },
  { path: '/raw', label: 'Raw data', Page: RawDataPage },
  { path: '/cleaned', label: 'Cleaned data', Page: CleanedDataPage },
  { path: '/dashboard', label: 'Dashboard', Page: DashboardPage },
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

  // A sidebar that stays put on wide screens, and a bar of tabs across the top on a phone.
  return (
    <div className="md:flex md:min-h-screen">
      <header className="border-b border-line bg-surface md:w-56 md:flex-none md:border-r md:border-b-0">
        <div className="md:sticky md:top-0">
          <p className="px-4 pt-3 text-sm font-semibold text-ink md:px-6 md:pt-9 md:pb-5">
            Production Runs
          </p>
          <nav aria-label="Pages" className="flex overflow-x-auto px-1 md:flex-col md:gap-1 md:px-3">
            {pages.map(({ path: to, label }) => (
              <a
                key={to}
                href={to}
                aria-current={to === path ? 'page' : undefined}
                onClick={(event) => go(event, to)}
                className="px-3 py-3 text-sm whitespace-nowrap text-body hover:text-ink aria-[current=page]:font-semibold aria-[current=page]:text-ink aria-[current=page]:shadow-[inset_0_-2px_0_var(--color-accent)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink md:rounded-md md:py-2 md:hover:bg-page/60 md:aria-[current=page]:bg-page md:aria-[current=page]:shadow-[inset_3px_0_0_var(--color-accent)]"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <div className="min-w-0 flex-1">
        {current ? (
          <current.Page />
        ) : (
          <Page>
            <PageHeader title="Page not found" subtitle={`There is no page at ${path}.`} />
          </Page>
        )}
      </div>
    </div>
  )
}

export default App
