import type { SupabaseClient } from "@supabase/supabase-js";
import { guestSelect } from "../modules/guests/queries";
import type { GuestRow } from "../modules/guests/types";

type GuestRsvp = { id: string; status: string; seats_confirmed: number; dietary: string | null; message: string | null; updated_at: string; created_at: string };
export type GuestWithRsvp = GuestRow & { rsvps: GuestRsvp[] | GuestRsvp | null };

export async function listGuestsWithRsvpByWedding(supabase: SupabaseClient, weddingId: string) {
  const { data, error } = await supabase
    .from("guests")
    .select(`
      ${guestSelect},
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
  return (data ?? []) as GuestWithRsvp[];
}
