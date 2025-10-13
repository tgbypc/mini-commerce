'use client'

export default function EmptyState({
  title,
  message,
  action,
}: {
  title?: string
  message?: string
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      {title && <h2 className="text-base font-semibold">{title}</h2>}
      {message && <p className="mt-1 text-sm text-zinc-600">{message}</p>}
      {action && <div className="pt-3">{action}</div>}
    </div>
  )
}
