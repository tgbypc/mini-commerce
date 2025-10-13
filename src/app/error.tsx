'use client'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {error?.message || 'An unexpected error occurred.'}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex rounded-xl border px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() =>
              typeof window !== 'undefined'
                ? window.location.reload()
                : undefined
            }
            className="inline-flex rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  )
}
