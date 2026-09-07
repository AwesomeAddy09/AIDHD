import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Dashboard from "@/components/Dashboard";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <Dashboard userId={user.id} name={user.user_metadata?.name || user.email.split("@")[0]} />
  );
}
