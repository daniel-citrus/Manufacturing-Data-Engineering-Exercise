import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'

// The box behind every chart tooltip and column note. Each one adds its own position.
export const tooltipBox =
  'z-10 w-max max-w-60 rounded-lg border border-line bg-page px-2.5 py-2 text-xs/snug text-muted shadow-lg'

export function Page({
  ref,
  className = '',
  children,
}: {
  ref?: Ref<HTMLElement>
  className?: string
  children: ReactNode
}) {
  return (
    <main ref={ref} className={`mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10 ${className}`}>
      {children}
    </main>
  )
}

// The title on the left and the page's buttons on the right, or under it when there's no room.
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div>
        <h1 className="text-[1.75rem]/tight font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  )
}

const BUTTON_VARIANTS = {
  primary: 'border-transparent bg-ink text-page enabled:hover:bg-ink/80',
  secondary: 'border-line bg-page text-ink enabled:hover:bg-surface',
}

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_VARIANTS }) {
  return (
    <button
      type="button"
      className={`inline-flex h-9 cursor-pointer items-center rounded-lg border px-3.5 text-sm font-medium transition-[background-color,scale] duration-150 enabled:active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

export function LowestBadge() {
  return (
    <span className="ml-2 rounded border border-current px-1.5 py-px text-[11px] font-semibold tracking-wide text-accent uppercase">
      Lowest
    </span>
  )
}
