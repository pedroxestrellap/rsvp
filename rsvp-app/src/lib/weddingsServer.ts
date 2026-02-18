import type { SupabaseClient } from "@supabase/supabase-js";
import type { WeddingInput, WeddingRow } from "../types/weddings";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export async function listWeddingsByWorkspace(supabase: SupabaseClient, workspaceId: string) {
  const { data, error } = await supabase
    .from("weddings")
    .select("id, workspace_id, slug, title, event_date, theme_id, settings, is_published, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as WeddingRow[];
}

export async function getWeddingById(supabase: SupabaseClient, weddingId: string) {
  const { data, error } = await supabase
    .from("weddings")
    .select("id, workspace_id, slug, title, event_date, theme_id, settings, is_published, created_at")
    .eq("id", weddingId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as WeddingRow | null;
}

export async function createWedding(supabase: SupabaseClient, workspaceId: string, input: WeddingInput) {
  const title = input.title?.trim() || "Nueva boda";
  const slug = slugify(title) || "boda";

  const { data, error } = await supabase
    .from("weddings")
    .insert({
      workspace_id: workspaceId,
      title,
      slug,
      event_date: input.event_date ?? null,
      theme_id: input.theme_id ?? null,
      settings: input.settings ?? {},
      is_published: false,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function updateWedding(
  supabase: SupabaseClient,
  weddingId: string,
  input: WeddingInput
) {
  const patch: any = {};

  // title (si viene y no está vacío)
  if (typeof input.title === "string" && input.title.trim().length > 0) {
    patch.title = input.title.trim();
    patch.slug = slugify(input.title);
  }

  // event_date (si viene: permite null explícito si tú quieres borrar fecha)
  if ("event_date" in input) {
    patch.event_date = input.event_date ?? null;
  }

  // settings (si viene)
  if ("settings" in input && input.settings !== undefined) {
    patch.settings = input.settings;
  }

  // theme_id (NO lo mandes si no viene)
  if ("theme_id" in input && input.theme_id) {
    patch.theme_id = input.theme_id;
  }

  // si no hay nada que actualizar, sal
  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase.from("weddings").update(patch).eq("id", weddingId);
  if (error) throw error;
}


export async function setWeddingPublished(supabase: SupabaseClient, weddingId: string, published: boolean) {
  const { error } = await supabase.from("weddings").update({ is_published: published }).eq("id", weddingId);
  if (error) throw error;
}
