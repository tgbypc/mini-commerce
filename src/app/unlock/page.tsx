import AdminSecretForm from '@/components/AdminSecretForm'

export default function UnlockPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-160px)] w-full max-w-4xl flex-col justify-center gap-10 px-4 py-16 sm:px-6 lg:px-8">
      <div className="space-y-3 text-center sm:text-left">
        <span className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.26em] text-blue-600 dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-200">
          Admin access
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-[#0d141c] dark:text-white sm:text-4xl">
          Unlock the MiniCommerce admin panel
        </h1>
        <p className="max-w-2xl text-sm text-zinc-500 dark:text-zinc-300/80">
          This page is for trusted teammates only. Provide the shared{' '}
          <strong>ADMIN_SECRET</strong> or reuse your Firebase admin session to
          mint a short-lived impersonation cookie. Once approved, you will be
          redirected to the admin dashboard.
        </p>
      </div>
      <AdminSecretForm />
      <div className="rounded-3xl border border-amber-200/60 bg-amber-50/60 px-6 py-5 text-sm text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100">
        <p className="font-semibold uppercase tracking-[0.24em] text-xs text-amber-500/80 dark:text-amber-200/80">
          Security notes
        </p>
        <ul className="mt-3 space-y-2 text-left">
          <li>
            - Secrets stay on the server - never commit <code>.env.local</code>{' '}
            or expose <code>ADMIN_SECRET</code> in client bundles.
          </li>
          <li>
            - Rotate the secret periodically and update Vercel environment
            variables accordingly.
          </li>
          <li>
            - Remove the impersonation cookie when finished testing by signing
            out or revoking the secret.
          </li>
        </ul>
      </div>
    </div>
  )
}
