import type { SupabaseClient } from "@supabase/supabase-js";
import type { GuestCreateInput, GuestRow, GuestUpdateInput } from "./types";
import { guestSelect } from "./queries";

export async function listGuestsByWedding(supabase: SupabaseClient, weddingId: string) {
  const { data, error } = await supabase
    .from("guests")
    .select(guestSelect)
    .eq("wedding_id", weddingId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as GuestRow[];
}

export async function getGuestById(supabase: SupabaseClient, guestId: string) {
  const { data, error } = await supabase
    .from("guests")
    .select(guestSelect)
    .eq("id", guestId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as GuestRow | null;
}

export async function createGuest(supabase: SupabaseClient, input: GuestCreateInput) {
  const { data, error } = await supabase
    .from("guests")
    .insert(input)
    .select(guestSelect)
    .single();

  if (error) throw error;
  return data as GuestRow;
}

export async function updateGuest(supabase: SupabaseClient, guestId: string, input: GuestUpdateInput) {
  const patch: any = {};

  // Solo campos presentes (no mandar null accidental)
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) patch[k] = v;
  }

  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase.from("guests").update(patch).eq("id", guestId);
  if (error) throw error;
}

export async function deleteGuest(supabase: SupabaseClient, guestId: string) {
  const { error } = await supabase.from("guests").delete().eq("id", guestId);
  if (error) throw error;
}
