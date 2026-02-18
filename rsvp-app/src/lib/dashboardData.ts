import type { SupabaseClient } from "@supabase/supabase-js";

export async function getWorkspaceForUser(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("workspace_users")
    .select("workspace_id, workspaces:workspace_id(id,name,slug)")
    .limit(1);

  if (error || !data || data.length === 0) return null;

  const ws = data[0]?.workspaces as any;
  return ws ? { id: ws.id, name: ws.name, slug: ws.slug } : null;
}

export async function getDashboardStats(supabase: SupabaseClient, workspaceId: string) {
  // Events
  const { data: evs } = await supabase
    .from("weddings")
    .select("id,status,created_at")
    .eq("workspace_id", workspaceId);

  const events = (evs || []) as Array<{ status?: string | null }>;

  const published = events.filter(e => (e.status || "").toLowerCase() === "published").length;
  const drafts = events.filter(e => (e.status || "").toLowerCase() === "draft").length;

  // RSVPs de hoy (si existe tabla y campo updated_at)
  const start = new Date();
  start.setHours(0,0,0,0);
  const isoStart = start.toISOString();

  let rsvpToday = 0;
  try {
    const { data: rsvps } = await supabase
      .from("rsvps")
      .select("id,updated_at")
      .gte("updated_at", isoStart);

    rsvpToday = (rsvps || []).length;
  } catch {
    rsvpToday = 0;
  }

  return { published, drafts, rsvpToday };
}
