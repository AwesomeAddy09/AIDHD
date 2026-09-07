// Thin data-access layer over Supabase. Keeps the shape of tasks/events
// identical to the original prototype's local state so the UI code barely
// has to change: tasks: [{id, text, category, minutes, priority, done, steps}]
// eventsByDate: { "YYYY-MM-DD": [{id, text, start, end}] }

function rowToTask(row) {
  return {
    id: row.id,
    text: row.text,
    category: row.category,
    minutes: row.minutes,
    priority: row.priority,
    done: row.done,
    steps: row.steps,
  };
}

export async function fetchTasks(supabase) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToTask);
}

export async function insertTasks(supabase, userId, tasks) {
  const rows = tasks.map((t) => ({
    user_id: userId,
    text: t.text,
    category: t.category,
    minutes: t.minutes,
    priority: t.priority,
    done: false,
    steps: null,
  }));
  const { data, error } = await supabase.from("tasks").insert(rows).select();
  if (error) throw error;
  return (data || []).map(rowToTask);
}

export async function updateTask(supabase, id, patch) {
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTask(supabase, id) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchEventsByDate(supabase) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("start_min", { ascending: true });
  if (error) throw error;
  const byDate = {};
  for (const row of data || []) {
    const key = row.event_date;
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push({ id: row.id, text: row.text, start: row.start_min, end: row.end_min });
  }
  return byDate;
}

export async function insertEvent(supabase, userId, dateKey, event) {
  const { data, error } = await supabase
    .from("events")
    .insert({
      user_id: userId,
      event_date: dateKey,
      text: event.text,
      start_min: event.start,
      end_min: event.end,
    })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, text: data.text, start: data.start_min, end: data.end_min };
}

export async function deleteEvent(supabase, id) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchRecap(supabase, dateKey) {
  const { data, error } = await supabase
    .from("recaps")
    .select("text")
    .eq("recap_date", dateKey)
    .maybeSingle();
  if (error) throw error;
  return data?.text ?? null;
}

export async function upsertRecap(supabase, userId, dateKey, text) {
  const { error } = await supabase
    .from("recaps")
    .upsert(
      { user_id: userId, recap_date: dateKey, text },
      { onConflict: "user_id,recap_date" }
    );
  if (error) throw error;
}
