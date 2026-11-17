import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getWeddingById } from "./weddingsServer";
import { signCoupleToken, verifyCoupleToken } from "./coupleToken";

// Import only from server routes: this client bypasses RLS after explicit access checks.
export function weddingAdmin() {
  const url = import.meta.env.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function signingSecret() {
  const secret = import.meta.env.COUPLE_ACCESS_SECRET || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Falta la clave del servidor para el acceso de los novios.");
  return secret;
}

export async function getPlannerWedding(session: SupabaseClient, weddingId: string) {
  const { data: { user } } = await session.auth.getUser();
  if (!user) return null;
  const admin = weddingAdmin();
  const wedding = await getWeddingById(admin, weddingId);
  if (!wedding) return null;
  const { data, error } = await admin.from("workspace_users").select("id")
    .eq("workspace_id", wedding.workspace_id).eq("user_id", user.id).limit(1);
  if (error) throw error;
  return data?.length ? { supabase: admin, wedding } : null;
}

export async function getCoupleWedding(token: string) {
  const payload = verifyCoupleToken(token, signingSecret());
  if (!payload) return null;
  const supabase = weddingAdmin();
  const wedding = await getWeddingById(supabase, payload.weddingId);
  if (!wedding || wedding.settings?.couple_access_version !== payload.version) return null;
  return { supabase, wedding };
}

export function couplePath(weddingId: string, version: string) {
  return `/couple/${signCoupleToken(weddingId, version, signingSecret())}`;
}

export function isSameOrigin(request: Request, url: URL) {
  return request.headers.get("origin") === url.origin;
}
