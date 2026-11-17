// src/lib/guestsServer.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getGuestWithRsvp(supabase: SupabaseClient, guestId: string) {
 const { data, error } = await supabase
  .from("guests")
  .select(`
    id,
    wedding_id,
     full_name,
     phone,
     email,
     is_primary,
     primary_guest_id,
     group_id,
    max_seats,
    invite_code,
    rsvps (
      id,
      status,
      seats_confirmed,
      updated_at
    )
  `)
  .eq("id", guestId)
  .maybeSingle();


  if (error) throw error;
  return data;
}

export async function getGuestGroup(supabase: SupabaseClient, guest: any) {
  // Caso A: usa group_id (recomendado)
  if (guest?.group_id) {
    const { data, error } = await supabase
      .from("guests")
      .select("id, full_name, max_seats, is_primary, primary_guest_id, group_id, invite_code")
      .eq("group_id", guest.group_id)
      .eq("wedding_id", guest.wedding_id)
      .order("is_primary", { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  // Caso B: fallback: primary_guest_id
  const primaryId = guest?.is_primary ? guest.id : guest?.primary_guest_id;
  if (!primaryId) return [guest];

  const { data, error } = await supabase
    .from("guests")
    .select("id, full_name, max_seats, is_primary, primary_guest_id, group_id, invite_code")
    .or(`id.eq.${primaryId},primary_guest_id.eq.${primaryId}`)
    .eq("wedding_id", guest.wedding_id)
    .order("is_primary", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
