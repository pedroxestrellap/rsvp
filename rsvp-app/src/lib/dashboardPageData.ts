// src/lib/dashboardPageData.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getDashboardPageData(supabase: SupabaseClient, workspaceId: string) {
  // 1) Bodas del workspace
  const { data: weddings, error: wErr } = await supabase
    .from("weddings")
    .select("id, workspace_id, slug, title, event_date, is_published, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (wErr) throw wErr;

  // 2) Stats por boda (si creaste el VIEW wedding_rsvp_stats)
  const weddingIds = (weddings ?? []).map((w) => w.id);

  let statsByWedding: Record<string, any> = {};
  if (weddingIds.length > 0) {
    const { data: stats, error: sErr } = await supabase
      .from("wedding_rsvp_stats")
      .select("wedding_id, confirmed, pending, declined, confirmed_seats, total_guests")
      .in("wedding_id", weddingIds);

    if (!sErr && stats) {
      statsByWedding = Object.fromEntries(stats.map((r) => [r.wedding_id, r]));
    }
  }

  // 3) RSVP recientes (opcional, para tu card “RSVP recientes”)
  const { data: recent, error: rErr } = await supabase
    .from("rsvps")
    .select("id, guest_id, status, seats_confirmed, message, dietary, updated_at, created_at")
    .order("updated_at", { ascending: false })
    .limit(7);

  // si falla, no rompas el UI
  const recentRsvps = rErr ? [] : (recent ?? []);

  return {
    weddings: weddings ?? [],
    statsByWedding,
    recentRsvps,
  };
}
