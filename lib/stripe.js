import Stripe from "stripe";

// Server-only. STRIPE_SECRET_KEY is a sk_test_... key while this stays
// in test mode — switching to live billing later is just swapping this
// (and STRIPE_PRICE_ID_PRO, STRIPE_WEBHOOK_SECRET) for their live-mode
// equivalents, no code changes needed here.
let client = null;
export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return client;
}
