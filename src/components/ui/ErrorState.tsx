'use client'

export default function ErrorState({
  title = 'Error',
  message = 'An unexpected error occurred.',
  retry,
}: {
  title?: string
  message?: string
  retry?: () => void
}) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-rose-700">{title}</h2>
      <p className="mt-1 text-sm text-rose-600">{message}</p>
      {retry && (
        <div className="pt-3">
          <button
            onClick={retry}
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
