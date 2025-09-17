import Spinner from '@/components/ui/Spinner'

export default function RootLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-zinc-700">
        <Spinner />
        <span>Loading…</span>
      </div>
    </div>
  )
}

