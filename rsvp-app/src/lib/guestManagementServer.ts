import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { listGuestsByWedding } from "../modules/guests/server";
import { guestName, guestEmail, guestPhone } from "./guestForm";

export function seatLimit(value: unknown) {
  const seats = Number(value);
  if (!Number.isInteger(seats) || seats < 1 || seats > 100) throw new Error("El cupo debe estar entre 1 y 100 personas.");
  return seats;
}

async function checked(result: PromiseLike<{ error: any }>) {
  const { error } = await result;
  if (error) throw new Error(error.message);
}

export async function handleGuestAction(supabase: SupabaseClient, weddingId: string, form: FormData) {
  const action = String(form.get("action") ?? "");
  const name = ["delete_guest", "create_invite_code"].includes(action) ? "" : guestName(form.get("full_name"));
  const contact = {
    phone: guestPhone(form.get("phone"),form.has("phone_country")?String(form.get("phone_country")):undefined),
    email: guestEmail(form.get("email")),
  };

  if (action === "create_guest") {
    const named = form.get("companion_mode") === "names";
    const names = named ? form.getAll("companion_names").map(value=>guestName(value,true)) : [];
    const max_seats = seatLimit((named ? names.length : Number(form.get("companions") ?? 0)) + 1);
    if (names.some(value=>!value) && form.get("allow_unnamed_companions") !== "1") throw new Error("Dejaste acompañantes sin nombre. Confirma que el invitado podrá completarlos al responder.");
    const id = randomUUID();
    // One insert keeps the principal and named companions together; empty slots
    // are represented by max_seats and stay available in the personal RSVP.
    await checked(supabase.from("guests").insert([{ id, wedding_id: weddingId, full_name: name, ...contact,
      max_seats, is_primary: true, invite_code: randomBytes(12).toString("hex"), source: "manual" },
      ...names.filter(Boolean).map(full_name=>({id:randomUUID(), wedding_id:weddingId,full_name,max_seats:1,
        is_primary:false,primary_guest_id:id,source:"manual"}))]));
    return;
  }

  const guestId = String(form.get("guest_id") ?? "");
  const { data: guest, error } = await supabase.from("guests").select("id, is_primary, primary_guest_id, max_seats, group_id, invite_code")
    .eq("id", guestId).eq("wedding_id", weddingId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!guest) throw new Error("El invitado no pertenece a esta boda.");

  if (action === "create_invite_code") {
    if (guest.primary_guest_id) throw new Error("La invitación personal se genera para el invitado principal.");
    if (!guest.invite_code || !guest.is_primary) await checked(supabase.from("guests").update({ invite_code: guest.invite_code || randomBytes(12).toString("hex"), is_primary: true })
      .eq("id", guestId).eq("wedding_id", weddingId));
    return;
  }

  const guests = await listGuestsByWedding(supabase, weddingId);
  const companions = guests.filter(g => g.primary_guest_id === guestId);

  if (action === "update_guest") {
    const max_seats = guest.is_primary ? seatLimit(Number(form.get("companions") ?? 0) + 1) : 1;
    if (max_seats < companions.length + 1) throw new Error("El cupo no puede ser menor que los acompañantes ya añadidos. Elimina primero los que no asistirán.");
    const { data: rsvp, error: rsvpError } = await supabase.from("rsvps").select("seats_confirmed")
      .eq("guest_id", guestId).maybeSingle();
    if (rsvpError) throw new Error(rsvpError.message);
    if (rsvp && rsvp.seats_confirmed > max_seats) throw new Error("El cupo no puede ser menor que las personas ya confirmadas.");
    await checked(supabase.from("guests").update({ full_name: name, ...contact, max_seats })
      .eq("id", guestId).eq("wedding_id", weddingId));
    return;
  }

  if (action === "add_companion") {
    if (!guest.is_primary) throw new Error("Añade los acompañantes al invitado principal.");
    const max_seats = seatLimit(Math.max(guest.max_seats ?? 1, companions.length + 2));
    await checked(supabase.from("guests").update({ max_seats }).eq("id", guestId).eq("wedding_id", weddingId));
    await checked(supabase.from("guests").insert({ wedding_id: weddingId, full_name: name, max_seats: 1,
      is_primary: false, primary_guest_id: guestId, group_id: guest.group_id, source: "manual" }));
    return;
  }

  if (action === "delete_guest") {
    // Remove dependent RSVPs and companions explicitly; do not rely on FK cascade settings.
    const ids = [guestId, ...companions.map(g => g.id)];
    await checked(supabase.from("rsvps").delete().in("guest_id", ids));
    if (companions.length) await checked(supabase.from("guests").delete()
      .eq("wedding_id", weddingId).in("id", companions.map(g => g.id)));
    await checked(supabase.from("guests").delete().eq("id", guestId).eq("wedding_id", weddingId));
    return;
  }
  throw new Error("Acción de invitado no válida.");
}
