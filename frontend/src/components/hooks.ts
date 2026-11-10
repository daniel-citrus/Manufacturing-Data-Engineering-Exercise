import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// Whether the element is wider inside than out, so it scrolls sideways. Rechecked whenever it
// or its first child resizes, which covers rows arriving after it mounts.
export function useOverflows<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [overflows, setOverflows] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(() => setOverflows(el.scrollWidth > el.clientWidth))
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    return () => observer.disconnect()
  }, [])
  return [ref, overflows] as const
}

// Which mark's tooltip is open. Leaving a mark closes it only after a moment, so the pointer can
// move onto the tooltip, which then keeps it open; Escape closes it from anywhere.
export function useTooltip<T>() {
  const [active, setActive] = useState<T | null>(null)
  const timer = useRef(0)

  useEffect(() => {
    if (active === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActive(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const open = (key: T) => {
    window.clearTimeout(timer.current)
    setActive(key)
  }
  const close = () => {
    window.clearTimeout(timer.current)
    setActive(null)
  }
  const closeSoon = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setActive(null), 150)
  }
  // Spread on the tooltip itself
  const hoverable = {
    onPointerEnter: () => window.clearTimeout(timer.current),
    onPointerLeave: closeSoon,
  }
  return { active, open, close, closeSoon, hoverable }
}
