// src/lib/rsvpsServer.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function upsertRsvpForGuest(
  supabase: SupabaseClient,
  guestId: string,
  patch: { status: string; seats_confirmed: number | null }
) {
  // 1) traer max_seats del guest
  const { data: guest, error: gErr } = await supabase
    .from("guests")
    .select("id, max_seats")
    .eq("id", guestId)
    .single();
  if (gErr) throw gErr;

  // 2) validar
  if (typeof patch.seats_confirmed === "number" && typeof guest.max_seats === "number") {
    if (patch.seats_confirmed > guest.max_seats) {
      throw new Error(`Seats confirmados (${patch.seats_confirmed}) exceden el max (${guest.max_seats}).`);
    }
    if (patch.seats_confirmed < 0) {
      throw new Error("Seats confirmados no puede ser negativo.");
    }
  }

  // 3) upsert rsvp (si no existe, lo crea)
  const { error } = await supabase
    .from("rsvps")
    .upsert(
      {
        guest_id: guestId,
        status: patch.status,
        seats_confirmed: patch.seats_confirmed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "guest_id" }
    );

  if (error) throw error;
}
