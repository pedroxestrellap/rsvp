import type { SupabaseClient } from "@supabase/supabase-js";
import type { RSVPRow, RSVPUpdateInput } from "./types";
import { rsvpSelect } from "./queries";

export async function listRsvpsByWedding(supabase: SupabaseClient, weddingId: string) {
  // rsvps -> guests para filtrar por wedding_id
  const { data, error } = await supabase
    .from("rsvps")
    .select(`${rsvpSelect}, guests!inner(wedding_id, full_name)`)
    .eq("guests.wedding_id", weddingId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function updateRsvp(supabase: SupabaseClient, rsvpId: string, input: RSVPUpdateInput) {
  const patch: any = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) patch[k] = v;
  }
  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase.from("rsvps").update(patch).eq("id", rsvpId);
  if (error) throw error;
}
