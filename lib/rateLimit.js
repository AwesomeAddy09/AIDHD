// Simple persistent rate limit backed by Supabase, safe across serverless
// instances (an in-memory counter wouldn't be, since each invocation can
// land on a different instance). Fails open on read errors so a database
// hiccup doesn't block legitimate use.
export async function checkRateLimit(supabase, userId, route, { limit, windowSeconds }) {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count, error } = await supabase
    .from("api_usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("route", route)
    .gte("created_at", since);

  if (error) return true;
  if ((count || 0) >= limit) return false;

  await supabase.from("api_usage").insert({ user_id: userId, route });
  return true;
}
