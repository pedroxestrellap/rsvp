import type { APIRoute } from "astro";
import { supabaseServer } from "@/lib/supabaseServer";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const invite_code = String(body.invite_code || "").trim();
    const status = String(body.status || "pending");
    const seats_confirmed = Number(body.seats_confirmed ?? 1);
    const message = String(body.message || "");
    const dietary = String(body.dietary || "");
    const plus_ones: string[] = Array.isArray(body.plus_ones) ? body.plus_ones : [];

    if (!invite_code) return new Response(JSON.stringify({ error: "Missing invite_code" }), { status: 400 });
    if (!["yes", "no", "maybe"].includes(status)) return new Response(JSON.stringify({ error: "Invalid status" }), { status: 400 });

    // 1) Buscar guest por invite_code (server)
    const { data: guest, error: guestErr } = await supabaseServer
      .from("guests")
      .select("id, wedding_id, max_seats, is_primary, group_id, full_name")
      .eq("invite_code", invite_code)
      .maybeSingle();

    if (guestErr) return new Response(JSON.stringify({ error: guestErr.message }), { status: 500 });
    if (!guest) return new Response(JSON.stringify({ error: "Invite not found" }), { status: 404 });
    if (!guest.is_primary) return new Response(JSON.stringify({ error: "Invite code must be primary guest" }), { status: 400 });

    // 2) Validar boda publicada (evita usar códigos de bodas no publicadas)
    const { data: wedding, error: wErr } = await supabaseServer
      .from("weddings")
      .select("is_published")
      .eq("id", guest.wedding_id)
      .maybeSingle();

    if (wErr) return new Response(JSON.stringify({ error: wErr.message }), { status: 500 });
    if (!wedding?.is_published) return new Response(JSON.stringify({ error: "Wedding not published" }), { status: 403 });

    // 3) Validar cupo
    if (status === "yes" && seats_confirmed > guest.max_seats) {
      return new Response(JSON.stringify({ error: `Seats exceed max allowed (${guest.max_seats})` }), { status: 400 });
    }

    // 4) Upsert RSVP (server)
    const { error: rsvpErr } = await supabaseServer
      .from("rsvps")
      .upsert(
        {
          guest_id: guest.id,
          status,
          seats_confirmed: status === "yes" ? seats_confirmed : 0,
          message,
          dietary,
        },
        { onConflict: "guest_id" }
      );

    if (rsvpErr) return new Response(JSON.stringify({ error: rsvpErr.message }), { status: 500 });

    // 5) Acompañantes (server)
    const desiredPlusOnes = Math.max(0, (status === "yes" ? seats_confirmed : 0) - 1);

    const { data: existingCompanions, error: compErr } = await supabaseServer
      .from("guests")
      .select("id, full_name")
      .eq("primary_guest_id", guest.id)
      .eq("is_primary", false);

    if (compErr) return new Response(JSON.stringify({ error: compErr.message }), { status: 500 });

    const existingCount = existingCompanions?.length ?? 0;

    let group_id = guest.group_id;
    if (!group_id && desiredPlusOnes > 0) {
      group_id = crypto.randomUUID();
      const { error: gErr } = await supabaseServer.from("guests").update({ group_id }).eq("id", guest.id);
      if (gErr) return new Response(JSON.stringify({ error: gErr.message }), { status: 500 });
    }

    // crear faltantes
    if (desiredPlusOnes > existingCount) {
      const toCreate = desiredPlusOnes - existingCount;

      const rows = Array.from({ length: toCreate }).map((_, idx) => {
        const name = (plus_ones[existingCount + idx] || "").trim();
        return {
          wedding_id: guest.wedding_id,
          full_name: name || `Acompañante de ${guest.full_name}`,
          is_primary: false,
          primary_guest_id: guest.id,
          group_id,
          source: "rsvp",
          max_seats: 1,
        };
      });

      const { error: insErr } = await supabaseServer.from("guests").insert(rows);
      if (insErr) return new Response(JSON.stringify({ error: insErr.message }), { status: 500 });
    }

    // borrar sobrantes
    if (desiredPlusOnes < existingCount) {
      const toDelete = existingCompanions!.slice(desiredPlusOnes).map((c) => c.id);
      if (toDelete.length) {
        const { error: delErr } = await supabaseServer.from("guests").delete().in("id", toDelete);
        if (delErr) return new Response(JSON.stringify({ error: delErr.message }), { status: 500 });
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), { status: 500 });
  }
};
