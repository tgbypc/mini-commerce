'use client'

export default function Spinner({ size = 24 }: { size?: number }) {
  const s = `${size}px`
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      className="animate-spin text-zinc-600"
      aria-label="Loading"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeOpacity="0.2"
      />
      <path
        fill="currentColor"
        d="M22 12a10 10 0 0 0-10-10v4a6 6 0 0 1 6 6h4z"
      />
    </svg>
  )
}

