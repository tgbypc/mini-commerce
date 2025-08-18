import Link from 'next/link'

export default function SuccessPage() {
  return (
    <div className="px-4 md:px-10 py-8">
      <div className="mx-auto w-full max-w-5xl">
        {/* Page title */}
        <div className="rounded-2xl border bg-white px-6 py-8 shadow-sm">
          <h1 className="text-center text-2xl md:text-3xl font-semibold text-[#0d141c]">
            Siparişiniz Onaylandı!
          </h1>
          <p className="mt-2 text-center text-sm text-zinc-600">
            Siparişiniz başarıyla alındı. Siparişinizle ilgili detayları aşağıda
            bulabilirsiniz.
          </p>

          {/* Details */}
          <div className="mt-8 overflow-hidden rounded-xl border">
            <dl className="divide-y">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4 py-4">
                <dt className="text-sm font-medium text-zinc-600">
                  Sipariş Numarası
                </dt>
                <dd className="md:col-span-2 text-sm text-zinc-900">
                  #123456789
                </dd>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4 py-4">
                <dt className="text-sm font-medium text-zinc-600">
                  Tahmini Teslimat Tarihi
                </dt>
                <dd className="md:col-span-2 text-sm text-zinc-900">
                  25 Temmuz 2024
                </dd>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4 py-4">
                <dt className="text-sm font-medium text-zinc-600">
                  Ödeme Yöntemi
                </dt>
                <dd className="md:col-span-2 text-sm text-zinc-900">
                  Kredi Kartı
                </dd>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4 py-4">
                <dt className="text-sm font-medium text-zinc-600">
                  Toplam Tutar
                </dt>
                <dd className="md:col-span-2 text-sm text-zinc-900">150 TL</dd>
              </div>
            </dl>
          </div>

          {/* Address */}
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-zinc-700">
              Teslimat Adresi
            </h2>
            <p className="mt-2 text-sm text-zinc-800 leading-relaxed">
              Ayşe Yılmaz Örnek Mahallesi, Örnek Sokak No: 123 İstanbul, Türkiye
            </p>
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:justify-start">
            <Link
              href="/orders/123456789"
              className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Sipariş Detaylarını Görüntüle
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Alışverişe Devam Et
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
