import type { SupabaseClient } from "@supabase/supabase-js";

export type RsvpStatus = "confirmed" | "pending" | "declined";

export async function listRsvpsByWedding(supabase: SupabaseClient, weddingId: string) {
  const { data, error } = await supabase
    .from("guests")
    .select(`
      id,
      wedding_id,
      full_name,
      max_seats,
      invite_code,
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
    .order("updated_at", { foreignTable: "rsvps", ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function updateRsvp(
  supabase: SupabaseClient,
  rsvpId: string,
  patch: { status?: string; seats_confirmed?: number | null }
) {
  // 1. Traer rsvp + guest
  const { data: rsvp, error: rErr } = await supabase
    .from("rsvps")
    .select("id, guest_id, guests:max_seats")
    .eq("id", rsvpId)
    .single();

  if (rErr) throw rErr;
  if (!rsvp) throw new Error("RSVP not found");

  // 2. Validar seats_confirmed
  if (
    typeof patch.seats_confirmed === "number" &&
    typeof rsvp.guests?.max_seats === "number" &&
    patch.seats_confirmed > rsvp.guests.max_seats
  ) {
    throw new Error(
      `Seats confirmados (${patch.seats_confirmed}) exceden el máximo permitido (${rsvp.guests.max_seats})`
    );
  }

  // 3. Update
  const { error } = await supabase
    .from("rsvps")
    .update(patch)
    .eq("id", rsvpId);

  if (error) throw error;
}

