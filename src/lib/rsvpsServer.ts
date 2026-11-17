// src/lib/rsvpsServer.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function upsertRsvpForGuest(
  supabase: SupabaseClient,
  guestId: string,
  patch: { status: string; seats_confirmed: number | null }
) {
  if (!["confirmed", "declined", "pending"].includes(patch.status)) throw new Error("Selecciona un estado válido.");
  const seats = patch.status === "confirmed" ? patch.seats_confirmed : 0;
  if (seats === null || !Number.isInteger(seats) || seats < (patch.status === "confirmed" ? 1 : 0)) {
    throw new Error("Indica un número entero de personas (al menos una para confirmar).");
  }
  // 1) traer max_seats del guest
  const { data: guest, error: gErr } = await supabase
    .from("guests")
    .select("id, max_seats")
    .eq("id", guestId)
    .single();
  if (gErr) throw gErr;

  // 2) validar
  if (seats > (guest.max_seats ?? 1)) {
    throw new Error(`Las personas confirmadas (${seats}) exceden el cupo (${guest.max_seats ?? 1}).`);
  }

  // 3) upsert rsvp (si no existe, lo crea)
  const { error } = await supabase
    .from("rsvps")
    .upsert(
      {
        guest_id: guestId,
        status: patch.status,
          seats_confirmed: seats,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "guest_id" }
    );

  if (error) throw error;
}
