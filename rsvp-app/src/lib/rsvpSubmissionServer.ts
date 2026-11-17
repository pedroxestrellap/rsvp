import type { SupabaseClient } from "@supabase/supabase-js";
import { getRsvpSettings } from "./weddingSettings";

export function deadlinePassed(wedding: { rsvp_deadline?: string | null; timezone?: string | null }) {
  if (!wedding.rsvp_deadline) return false;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: wedding.timezone || "America/Santo_Domingo" }).format(new Date());
  return today > wedding.rsvp_deadline;
}

export async function submitRsvp(supabase: SupabaseClient, body: Record<string, any>) {
  const code = String(body.invite_code ?? "").trim();
  const slug = String(body.slug ?? "").trim();
  if (!code || !slug) throw new Error("Abre tu enlace personal de invitación para confirmar.");
  const { data: wedding, error: wError } = await supabase.from("weddings")
    .select("id, settings, is_published, rsvp_deadline, timezone").eq("slug", slug).eq("is_published", true).maybeSingle();
  if (wError) throw new Error("No se pudo consultar la boda.");
  if (!wedding) throw new Error("La invitación no está publicada.");
  if (deadlinePassed(wedding)) throw new Error("El plazo para confirmar ha terminado. Contacta con los novios.");
  const { data: guest, error: gError } = await supabase.from("guests")
    .select("id, full_name, wedding_id, max_seats, group_id").eq("wedding_id", wedding.id)
    .eq("invite_code", code).eq("is_primary", true).maybeSingle();
  if (gError) throw new Error("No se pudo consultar la invitación.");
  if (!guest) throw new Error("El enlace de invitación no es válido para esta boda.");

  const status = String(body.status ?? "");
  if (!["confirmed", "declined", "pending"].includes(status)) throw new Error("Selecciona una respuesta válida.");
  const hasCompanionSelection = Object.hasOwn(body, "companions");
  if (hasCompanionSelection && (!Array.isArray(body.companions) || body.companions.length > (guest.max_seats ?? 1) - 1)) {
    throw new Error("La selección de acompañantes supera el cupo de tu invitación.");
  }
  const selection: { id?: string; full_name: string; attending: boolean }[] = hasCompanionSelection ? body.companions.map((item: any) => {
    if (!item || typeof item !== "object" || typeof item.attending !== "boolean"
      || (item.id !== undefined && typeof item.id !== "string")
      || (item.full_name !== undefined && typeof item.full_name !== "string")) {
      throw new Error("Revisa la selección de acompañantes.");
    }
    return { id: item.id || undefined, full_name: (item.full_name ?? "").trim().slice(0, 200), attending: item.attending };
  }) : [];
  const seats = status === "confirmed" ? (hasCompanionSelection ? 1 + selection.filter(item => item.attending).length : Number(body.seats_confirmed)) : 0;
  if (!Number.isInteger(seats) || seats < (status === "confirmed" ? 1 : 0) || seats > (guest.max_seats ?? 1)) {
    throw new Error(`Elige entre 1 y ${guest.max_seats ?? 1} personas para confirmar.`);
  }
  const config = getRsvpSettings(wedding.settings ?? {});
  const message = config.show_message ? String(body.message ?? "").trim().slice(0, 2000) : "";
  const answers = config.custom_questions.map((question, i) => {
    const value = String(body.custom_answers?.[i] ?? "").trim().slice(0, 1000);
    return value ? `${question}: ${value}` : "";
  }).filter(Boolean);
  const dietary = config.show_dietary ? String(body.dietary ?? "").trim().slice(0, 2000) : "";

  if (hasCompanionSelection) {
    const { data: existing, error } = await supabase.from("guests").select("id, full_name")
      .eq("wedding_id", wedding.id).eq("primary_guest_id", guest.id).order("created_at", { ascending: true });
    if (error) throw new Error("No se pudieron consultar los acompañantes.");
    const ids = selection.flatMap(item => item.id ? [item.id] : []);
    if (new Set(ids).size !== ids.length || ids.some(id => !existing?.some(companion => companion.id === id))) {
      throw new Error("Uno de los acompañantes no pertenece a tu invitación.");
    }
    if (status === "confirmed" && existing?.some(companion => !ids.includes(companion.id))) {
      throw new Error("La lista de acompañantes cambió. Abre nuevamente tu enlace personal para confirmar.");
    }
    for (const item of selection) {
      if (item.id) item.full_name = existing!.find(companion => companion.id === item.id)!.full_name;
    }
    const attendingIds = new Set(selection.filter(item => item.attending && item.id).map(item => item.id!));
    const companions = [...(existing ?? [])];
    if (status === "confirmed") {
      for (const [index, item] of selection.entries()) {
        if (item.id || !item.attending) continue;
        const full_name = item.full_name || `Acompañante ${index + 1} de ${guest.full_name}`;
        const { data: created, error: createError } = await supabase.from("guests").insert({ wedding_id: wedding.id, full_name,
          max_seats: 1, is_primary: false, primary_guest_id: guest.id, group_id: guest.group_id, source: "rsvp" }).select("id, full_name").maybeSingle();
        if (createError || !created) throw new Error("No se pudo guardar tu acompañante.");
        companions.push(created);
        attendingIds.add(created.id);
        item.id = created.id;
        item.full_name = created.full_name;
      }
    }
    for (const companion of companions) {
      // The primary RSVP holds the group total. Companion rows hold individual
      // status, just as in RsvpManager; null avoids counting group seats twice.
      const companionStatus = status === "confirmed" ? (attendingIds.has(companion.id) ? "confirmed" : "declined") : status;
      const { error: companionError } = await supabase.from("rsvps").upsert({ guest_id: companion.id,
        status: companionStatus, seats_confirmed: null, updated_at: new Date().toISOString() }, { onConflict: "guest_id" });
      if (companionError) throw new Error("No se pudo guardar la confirmación de tus acompañantes.");
    }
  }

  // Keep the invited list even when a group declines or confirms fewer seats.
  if (status === "confirmed" && !hasCompanionSelection) {
    const { data: companions, error } = await supabase.from("guests").select("id, full_name")
      .eq("wedding_id", wedding.id).eq("primary_guest_id", guest.id).order("created_at", { ascending: true });
    if (error) throw new Error("No se pudieron consultar los acompañantes.");
    const names = config.ask_companion_names && Array.isArray(body.plus_ones)
      ? body.plus_ones.slice(0, seats - 1).map((n: unknown) => String(n).trim().slice(0, 200)) : [];
    for (let i = 0; i < seats - 1; i++) {
      const full_name = names[i] || companions?.[i]?.full_name || `Acompañante ${i + 1} de ${guest.full_name}`;
      const { error: companionError } = companions?.[i]
        ? await supabase.from("guests").update({ full_name }).eq("id", companions[i].id).eq("wedding_id", wedding.id)
        : await supabase.from("guests").insert({ wedding_id: wedding.id, full_name, max_seats: 1,
          is_primary: false, primary_guest_id: guest.id, group_id: guest.group_id, source: "rsvp" });
      if (companionError) throw new Error("No se pudieron guardar los acompañantes.");
    }
  }
  const { error } = await supabase.from("rsvps").upsert({ guest_id: guest.id, status,
    seats_confirmed: seats, dietary, message: [message, ...answers].filter(Boolean).join("\n\n"),
    updated_at: new Date().toISOString() }, { onConflict: "guest_id" });
  if (error) throw new Error("No se pudo guardar la confirmación.");
  return hasCompanionSelection ? { companions: selection.map(item => ({ ...item, attending: status === "confirmed" && item.attending })) } : undefined;
}
