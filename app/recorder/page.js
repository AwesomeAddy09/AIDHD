import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Recorder from "@/components/Recorder";

export default async function RecorderPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <Recorder userId={user.id} />;
}
