import type Stripe from 'stripe'

type StripeSession = Stripe.Checkout.Session

type StripeShippingCost = StripeSession['shipping_cost']
type StripeCollectedShippingDetails =
  Stripe.Checkout.Session.CollectedInformation['shipping_details']
type StripeLegacyShippingDetails = {
  address?: Stripe.Address | null
  name?: string | null
} | null | undefined
type StripeShippingDetails =
  | StripeCollectedShippingDetails
  | StripeLegacyShippingDetails
type StripeCustomerDetails = StripeSession['customer_details']

type StripeAddressWithTown = Stripe.Address & {
  town?: string | null
}

type StripeSessionWithLegacy = StripeSession & {
  shipping_details?: StripeLegacyShippingDetails
}

export type ShippingAddress = {
  line1?: string | null
  line2?: string | null
  postal_code?: string | null
  city?: string | null
  town?: string | null
  state?: string | null
  country?: string | null
}

export type ShippingInfo = {
  method?: string | null
  amountTotal?: number | null
  address?: ShippingAddress | null
  name?: string | null
}

type ShippingInfoInput = {
  cost?: StripeShippingCost | null
  details?: StripeShippingDetails | null
  customer?: StripeCustomerDetails | null
}

export function toShippingInfo({
  cost,
  details,
  customer,
}: ShippingInfoInput): ShippingInfo {
  const rate = cost?.['shipping_rate']
  const method = typeof rate === 'string' ? null : rate?.['display_name'] ?? null
  const amountTotal = typeof cost?.['amount_total'] === 'number' ? cost?.['amount_total'] / 100 : null
  const source = (details?.['address'] ?? customer?.['address'] ?? null) as
    | StripeAddressWithTown
    | null
  const address: ShippingAddress | null = source
    ? {
        line1: source?.['line1'] ?? null,
        line2: source?.['line2'] ?? null,
        postal_code: source?.['postal_code'] ?? null,
        city: source?.['city'] ?? null,
        town: source?.['town'] ?? null,
        state: source?.['state'] ?? null,
        country: source?.['country'] ?? null,
      }
    : null

  return {
    method,
    amountTotal,
    address,
    name: details?.['name'] ?? customer?.['name'] ?? null,
  }
}

export function extractShippingDetails(
  session: StripeSession | StripeSessionWithLegacy | null | undefined
): StripeShippingDetails | null {
  if (!session) return null
  const collected = session.collected_information?.shipping_details ?? null
  if (collected) return collected
  const legacy = (session as StripeSessionWithLegacy)?.shipping_details ?? null
  return legacy ?? null
}
