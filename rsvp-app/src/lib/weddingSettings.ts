export const weddingFields = [
  { name: "partner_one", label: "Nombre de uno de los novios" },
  { name: "partner_two", label: "Nombre del otro novio o novia" },
  { name: "main_photo_url", label: "Enlace a la fotografía principal", type: "url" },
  { name: "main_photo_alt", label: "Descripción de la fotografía" },
  { name: "ceremony_time", label: "Hora de la ceremonia", type: "time" },
  { name: "ceremony_venue", label: "Lugar de la ceremonia" },
  { name: "ceremony_address", label: "Dirección de la ceremonia" },
  { name: "ceremony_map_url", label: "Enlace al mapa de la ceremonia", type: "url" },
  { name: "reception_time", label: "Hora de la recepción", type: "time" },
  { name: "reception_venue", label: "Lugar de la recepción" },
  { name: "reception_address", label: "Dirección de la recepción" },
  { name: "reception_map_url", label: "Enlace al mapa de la recepción", type: "url" },
  { name: "dress_code", label: "Código de vestimenta" },
  { name: "dress_examples_url", label: "Enlace a ejemplos de vestimenta", type: "url" },
  { name: "gifts_url", label: "Enlace a la mesa de regalos", type: "url" },
  { name: "gifts_label", label: "Nombre de la mesa de regalos o tienda" },
  { name: "contact_name", label: "Persona de contacto" },
  { name: "contact_phone", label: "Teléfono de contacto", type: "tel" },
] as const;

export function getRsvpSettings(settings: Record<string, any> = {}) {
  const form = settings.rsvp_form ?? {};
  const questions: unknown[] = Array.isArray(form.custom_questions) ? form.custom_questions : [];
  return {
    intro: typeof form.intro === "string" ? form.intro : "Confirma tu asistencia. ¡Nos encantará compartir este día contigo!",
    submit_label: typeof form.submit_label === "string" && form.submit_label.trim() ? form.submit_label : "Enviar confirmación",
    show_dietary: form.show_dietary !== false,
    show_message: form.show_message !== false,
    ask_companion_names: form.ask_companion_names !== false,
    custom_questions: questions.filter((q): q is string => typeof q === "string").slice(0, 10),
  };
}

export function parseWeddingForm(form: FormData, currentSettings: Record<string, any> = {}) {
  const text = (name: string, max = 2000) => String(form.get(name) ?? "").trim().slice(0, max);
  const title = text("title", 200);
  if (!title) throw new Error("Escribe el título de la boda.");
  const event_date = text("event_date");
  const rsvp_deadline = text("rsvp_deadline");
  for (const date of [event_date, rsvp_deadline]) {
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))) {
      throw new Error("La fecha no es válida.");
    }
  }
  if (event_date && rsvp_deadline && rsvp_deadline > event_date) {
    throw new Error("La fecha límite de confirmación debe ser anterior o igual a la boda.");
  }

  const settings = { ...currentSettings };
  for (const field of weddingFields) {
    if (["main_photo_url", "main_photo_alt", "dress_examples_url", "gifts_url", "gifts_label"].includes(field.name) && !form.has(field.name)) continue;
    const value = text(field.name);
    if (field.name.endsWith("_url") && value) {
      let url: URL;
      try { url = new URL(value); } catch { throw new Error(`Revisa el enlace: ${field.label}.`); }
      if (!["https:", "http:"].includes(url.protocol)) throw new Error(`Revisa el enlace: ${field.label}.`);
    }
    settings[field.name] = value;
  }
  for (const name of ["welcome_message", "gifts", "additional_information"]) settings[name] = text(name, 5000);
  // Optional editorial content lives in the existing settings JSON, just like venues.
  // Preserve it when an older client submits a form without these fields.
  for (const name of ["gifts_message", "dress_recommendations", "dress_restrictions"]) {
    if (form.has(name)) settings[name] = text(name, 5000);
  }
  if (form.has("dress_colors")) {
    const colors = text("dress_colors", 200).split(/[,\s]+/).filter(Boolean);
    if (colors.length > 12 || colors.some(color => !/^#[\da-f]{6}$/i.test(color))) {
      throw new Error("Usa hasta 12 colores de vestimenta en formato #RRGGBB, separados por comas.");
    }
    settings.dress_colors = colors;
  }
  if (form.has("itinerary")) {
    const lines = text("itinerary", 10000).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length > 30) throw new Error("El itinerario admite hasta 30 actividades.");
    settings.itinerary = lines.map(line => {
      const [time = "", title = "", ...description] = line.split("|").map(part => part.trim());
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !title) {
        throw new Error("Escribe cada actividad como: HH:MM | Nombre | Descripción.");
      }
      return { time, title: title.slice(0, 200), description: description.join(" | ").slice(0, 2000) };
    });
  }
  settings.rsvp_form = {
    ...currentSettings.rsvp_form,
    intro: text("form_intro"),
    submit_label: text("submit_label", 80) || "Enviar confirmación",
    show_dietary: form.has("show_dietary"),
    show_message: form.has("show_message"),
    ask_companion_names: form.has("ask_companion_names"),
    custom_questions: text("custom_questions", 2000).split(/\r?\n/).map(q => q.trim()).filter(Boolean).slice(0, 10),
  };
  return { title, event_date: event_date || null, rsvp_deadline: rsvp_deadline || null, settings };
}
