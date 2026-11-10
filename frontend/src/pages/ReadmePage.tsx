import { Marked } from 'marked'
import { useEffect, useMemo, useRef } from 'react'
import { useReadme } from '../data/readme'
import '../App.css'
import '../components/Readme.css'

const REPO_FILES = 'https://github.com/daniel-citrus/Manufacturing-Data-Engineering-Exercise/blob/HEAD/'

// Relative links point at files in the repo, which the app doesn't serve, so they open on GitHub.
const markdown = new Marked({
  walkTokens(token) {
    if (token.type === 'link' && !/^([a-z]+:|#|\/)/i.test(token.href)) {
      token.href = REPO_FILES + token.href
    }
  },
})

// Splits the README at its "##" headings, so each section is its own dropdown.
function toSections(text: string) {
  const sections: { heading: string | null; html: string }[] = []
  let heading: string | null = null
  let source = ''
  const flush = () => {
    if (heading !== null || source) {
      sections.push({ heading, html: markdown.parse(source, { async: false }) })
    }
  }
  for (const token of markdown.lexer(text)) {
    if (token.type === 'heading' && token.depth === 2) {
      flush()
      heading = token.text
      source = ''
    } else {
      source += token.raw
    }
  }
  flush()
  return sections
}

function enhanceCodeBlocks(root: HTMLElement) {
  for (const pre of root.querySelectorAll('pre')) {
    if (pre.parentElement?.classList.contains('readme-code-block')) continue
    const wrap = document.createElement('div')
    wrap.className = 'readme-code-block'
    pre.replaceWith(wrap)
    wrap.append(pre)
    const copy = document.createElement('button')
    copy.type = 'button'
    copy.className = 'readme-copy'
    copy.textContent = 'Copy'
    copy.setAttribute('aria-label', 'Copy code to clipboard')
    wrap.prepend(copy)
  }
}

function ReadmePage() {
  const { text, error } = useReadme()
  const sections = useMemo(() => (text === null ? null : toSections(text)), [text])
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const root = mainRef.current
    if (!root) return

    enhanceCodeBlocks(root)

    const onClick = (event: MouseEvent) => {
      const copy = (event.target as Element).closest('.readme-copy')
      if (!copy || !root.contains(copy)) return
      const pre = copy.parentElement?.querySelector('pre')
      if (!pre) return
      void navigator.clipboard.writeText(pre.innerText).then(
        () => {
          copy.textContent = 'Copied'
          window.setTimeout(() => {
            copy.textContent = 'Copy'
          }, 2000)
        },
        () => {
          copy.textContent = 'Failed'
          window.setTimeout(() => {
            copy.textContent = 'Copy'
          }, 2000)
        },
      )
    }

    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [sections])

  if (error) {
    return (
      <main>
        <p className="status" role="alert">
          Couldn't load the README ({error}).
        </p>
      </main>
    )
  }
  if (sections === null) {
    return (
      <main>
        <p className="status">Loading…</p>
      </main>
    )
  }
  // The README is this repo's own file, so its HTML (the <details> blocks) is rendered as written.
  return (
    <main ref={mainRef} className="readme">
      {sections.map(({ heading, html }) =>
        heading === null ? (
          <div key="" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <details key={heading} className="readme-section">
            <summary>
              <h2>{heading}</h2>
            </summary>
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </details>
        ),
      )}
    </main>
  )
}

export default ReadmePage
