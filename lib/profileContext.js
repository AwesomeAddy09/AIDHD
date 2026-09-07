// Light-touch personalization: turns onboarding answers into a short
// paragraph appended to a Claude system prompt. Returns "" when there's
// nothing to add, so callers can just concatenate unconditionally.

function describeAdhdType(n) {
  if (n == null) return null;
  if (n <= 2) return "presentation leans strongly inattentive";
  if (n <= 4) return "presentation leans somewhat inattentive";
  if (n <= 6) return "fairly combined presentation";
  if (n <= 8) return "presentation leans somewhat hyperactive";
  return "presentation leans strongly hyperactive";
}

export async function buildPersonalizationContext(supabase) {
  const { data: profile } = await supabase.from("profiles").select("*").maybeSingle();
  if (!profile) return "";

  const lines = [];
  if (profile.adhd_type != null) {
    lines.push(`Their ADHD ${describeAdhdType(profile.adhd_type)} (self-reported ${profile.adhd_type}/10, 1 = very inattentive, 10 = very hyperactive).`);
  }
  if (profile.focus_times) {
    lines.push(`They describe their focus/energy pattern as: "${profile.focus_times}"`);
  }
  if (profile.start_difficulty) {
    lines.push(`They describe what makes starting hardest as: "${profile.start_difficulty}"`);
  }

  if (lines.length === 0) return "";
  return `\n\nContext about this person, from their own onboarding answers (use it to inform tone and specifics, never reference it explicitly or quote it back):\n${lines.join("\n")}`;
}
