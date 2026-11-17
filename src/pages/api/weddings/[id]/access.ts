import type { APIRoute } from "astro";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { getPlannerWedding, couplePath, isSameOrigin } from "../../../../lib/weddingAccessServer";
import { updateWedding } from "../../../../lib/weddingsServer";

export const POST: APIRoute = async (context) => {
  const json = (body: object, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
  if (!isSameOrigin(context.request, context.url)) return json({ error: "Origen no permitido." }, 403);
  try {
    const access = await getPlannerWedding(supabaseServer(context), context.params.id ?? "");
    if (!access) return json({ error: "No tienes acceso a esta boda." }, 403);
    const body = await context.request.json();
    const { wedding, supabase } = access;
    let version = wedding.settings?.couple_access_version;
    if (!version || body.renew === true) {
      version = crypto.randomUUID();
      await updateWedding(supabase, wedding.id, { settings: { ...wedding.settings, couple_access_version: version } });
    }
    return json({ path: couplePath(wedding.id, version) });
  } catch {
    return json({ error: "No se pudo generar el acceso para los novios." }, 500);
  }
};
