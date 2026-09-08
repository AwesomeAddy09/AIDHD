// Simple persistent rate limit backed by Supabase, safe across serverless
// instances (an in-memory counter wouldn't be, since each invocation can
// land on a different instance). Fails open on read errors so a database
// hiccup doesn't block legitimate use.
//
// Accepts either a single {limit, windowSeconds} tier or an array of them.
// Routes that cost real money per call use two tiers: a tight short window
// (catches a runaway retry loop within seconds/minutes) and a looser daily
// cap (catches sustained abuse that stays under the burst threshold but
// keeps calling for hours). Every tier must pass before one usage row is
// recorded, shared across all tiers for that route.
export async function checkRateLimit(supabase, userId, route, limits) {
  const tiers = Array.isArray(limits) ? limits : [limits];

  for (const { limit, windowSeconds } of tiers) {
    const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
    const { count, error } = await supabase
      .from("api_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("route", route)
      .gte("created_at", since);

    if (error) continue; // fail open on a read error, not on the user
    if ((count || 0) >= limit) return false;
  }

  await supabase.from("api_usage").insert({ user_id: userId, route });
  return true;
}
