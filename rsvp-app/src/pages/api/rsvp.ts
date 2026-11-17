import type { APIRoute } from "astro";
import { weddingAdmin, isSameOrigin } from "@/lib/weddingAccessServer";
import { submitRsvp } from "@/lib/rsvpSubmissionServer";

export const POST: APIRoute = async ({ request, url }) => {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (!isSameOrigin(request, url)) return new Response(JSON.stringify({ error: "Origen no permitido." }), { status: 403, headers });
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Solicitud no válida.");
    const result = await submitRsvp(weddingAdmin(), body);
    return new Response(JSON.stringify({ ok: true, ...result }), { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "No se pudo guardar la confirmación." }), { status: 400, headers });
  }
};
