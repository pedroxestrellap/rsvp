import type { SupabaseClient } from "@supabase/supabase-js";

export async function listGuestsWithRsvpByWedding(supabase: SupabaseClient, weddingId: string) {
  const { data, error } = await supabase
    .from("guests")
    .select(`
      id,
      wedding_id,
      full_name,
      max_seats,
      is_primary,
      primary_guest_id,
      group_id,
      invite_code,
      created_at,
      rsvps (
        id,
        status,
        seats_confirmed,
        dietary,
        message,
        updated_at,
        created_at
      )
    `)
    .eq("wedding_id", weddingId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
