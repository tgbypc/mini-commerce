// src/app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb, FieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";        // Webhook için Node runtime şart
export const dynamic = "force-dynamic"; // Her çağrıyı çalıştır

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  // Stripe imza doğrulaması için header + secret gerekli
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return new NextResponse(
      "Missing Stripe signature or webhook secret",
      { status: 400 }
    );
  }

  // RAW body (JSON.parse DEĞİL) — Stripe imza doğrulaması bunu ister
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return new NextResponse(`Webhook Error: ${msg}`, { status: 400 });
  }

  // Yalnızca ödeme başarıyla tamamlandığında aksiyon al
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // line_items + product expand ile product.metadata.productId'yi alalım
    const full = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items.data.price.product"],
    });

    const items = (full.line_items?.data ?? []).map((li) => {
      const product = li.price?.product as Stripe.Product | null;
      return {
        productId: product?.metadata?.productId ?? null,
        title: li.description ?? product?.name ?? "Item",
        quantity: li.quantity ?? 0,
        unitAmount: li.price?.unit_amount ?? null,
        currency:
          li.price?.currency ?? full.currency ?? session.currency ?? "usd",
      };
    });

    // Firestore batch
    const batch = adminDb.batch();

    // Global order dokümanı
    const orderRef = adminDb.collection("orders").doc();
    const orderDoc = {
      orderId: orderRef.id,
      sessionId: session.id,
      paymentStatus: session.payment_status, // "paid" vb.
      amountTotal: (session.amount_total ?? 0) / 100,
      currency: session.currency ?? "usd",
      email: session.customer_details?.email ?? null,
      userId: session.metadata?.userId ?? null,
      items,
      createdAt: FieldValue.serverTimestamp(),
    };

    // Stok düş (productId ve quantity varsa)
    for (const it of items) {
      if (!it.productId || !it.quantity) continue;
      const pref = adminDb.collection("products").doc(String(it.productId));
      batch.update(pref, { stock: FieldValue.increment(-it.quantity) });
    }

    // orders kök koleksiyonuna yaz
    batch.set(orderRef, orderDoc);

    // Kullanıcı login id geldiyse users/{uid}/orders altına kopya
    const userId = session.metadata?.userId;
    if (userId) {
      const uref = adminDb
        .collection("users")
        .doc(String(userId))
        .collection("orders")
        .doc(orderRef.id);
      batch.set(uref, orderDoc);
    }

    await batch.commit();
  }

  // Stripe'a 200 dön — aksi halde event’i tekrar gönderir
  return NextResponse.json({ received: true });
}