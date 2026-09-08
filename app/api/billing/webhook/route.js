import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";

// Stripe calls this server-to-server, there's no user session to scope
// a normal request through — same reasoning as app/api/account/delete,
// this is the second (and only other) deliberate use of the service
// role key in the app, needed here to write whichever user's plan
// changed, identified by Stripe customer id rather than a cookie.
function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  return createSupabaseAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req) {
  const stripe = getStripe();
  const admin = getAdminClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !admin || !webhookSecret) {
    return NextResponse.json({ error: "Billing isn't set up yet." }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (e) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.supabase_user_id;
        if (userId) {
          await admin
            .from("profiles")
            .update({
              plan: "pro",
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
            })
            .eq("user_id", userId);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const active = ["active", "trialing"].includes(subscription.status);
        await admin
          .from("profiles")
          .update({
            plan: active ? "pro" : "free",
            stripe_subscription_id: active ? subscription.id : null,
          })
          .eq("stripe_customer_id", subscription.customer);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    // Stripe retries on non-2xx, but a bug in our handler shouldn't
    // cause it to hammer this endpoint indefinitely for an event we've
    // already acknowledged receiving.
  }

  return NextResponse.json({ received: true });
}
