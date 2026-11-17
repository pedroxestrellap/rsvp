import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvitationCompanion } from "../types/invitations";

// A personal link resolves its recipient and their own companions automatically.
export async function getInvitationGuest(supabase: SupabaseClient, weddingId: string, code: string) {
  if (!code) return null;
  const { data: guest, error } = await supabase.from("guests").select("id, full_name, max_seats")
    .eq("wedding_id", weddingId).eq("invite_code", code).eq("is_primary", true).maybeSingle();
  if (error) throw new Error("No se pudo consultar la invitación.");
  if (!guest) return null;
  const { data: rows, error: companionsError } = await supabase.from("guests").select("id, full_name")
    .eq("wedding_id", weddingId).eq("primary_guest_id", guest.id).order("created_at", { ascending: true });
  if (companionsError) throw new Error("No se pudieron consultar los acompañantes.");
  const ids = [guest.id, ...(rows ?? []).map(row => row.id)];
  const { data: responses, error: responseError } = await supabase.from("rsvps")
    .select("guest_id, status, seats_confirmed").in("guest_id", ids);
  if (responseError) throw new Error("No se pudo consultar tu confirmación.");
  const response = responses?.find(row => row.guest_id === guest.id);
  const initialStatus: "confirmed" | "declined" | "pending" = response?.status === "declined" ? "declined" : response?.status === "pending" ? "pending" : "confirmed";
  const companions: InvitationCompanion[] = (rows ?? []).map((row, index) => {
    const saved = responses?.find(rsvp => rsvp.guest_id === row.id);
    return { id: row.id, full_name: row.full_name,
      attending: response?.status === "confirmed" && (saved ? saved.status === "confirmed" : index < (response.seats_confirmed ?? 1) - 1) };
  });
  return { guest, companions, initialStatus };
}
