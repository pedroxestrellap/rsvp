export function formatDateShort(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

export function statusLabel(status?: string | null) {
  const s = (status || "").toLowerCase();
  if (s === "published") return "Publicado";
  if (s === "draft") return "Borrador";
  if (s === "confirmed") return "Confirmado";
  if (s === "declined") return "No asiste";
  if (s === "pending") return "Pendiente";
  return status ? status : "—";
}

export function pillClasses(kind?: string | null) {
  const s = (kind || "").toLowerCase();
  if (s === "published" || s === "confirmed")
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (s === "draft" || s === "pending")
    return "bg-slate-50 text-slate-600 border-slate-200";
  if (s === "declined")
    return "bg-rose-50 text-rose-700 border-rose-100";
  return "bg-slate-50 text-slate-600 border-slate-200";
}
