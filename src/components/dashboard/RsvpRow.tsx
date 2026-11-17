import { cn } from "../../utils/ui";
import { formatDateShort, pillClasses, statusLabel } from "../../utils/dashboardFormat";
import type { RSVPRow } from "../../types/dashboard";

export function RsvpRow({ rsvp }: { rsvp: RSVPRow }) {
  const { updated_at, guest_name, notes, status, count } = rsvp;
  const isConfirmed = (status || "").toLowerCase() === "confirmed";

  return (
    <div className="flex items-center justify-between rounded-xl px-3 py-3 transition hover:bg-slate-50">
      <div className="flex items-center gap-4">
        <div className="w-12 text-xs font-semibold text-slate-700">
          {formatDateShort(updated_at || null)}
        </div>

        <div>
          <div className="text-sm font-medium text-slate-900">{guest_name || "Invitado"}</div>
          <div className="mt-1 text-xs text-slate-400">{notes ? notes : "Respuesta recibida"}</div>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <span className={cn("rounded-full border px-3 py-1 text-xs", pillClasses(status))}>
          {statusLabel(status)}
        </span>

        <span className={cn("text-sm font-semibold", isConfirmed ? "text-emerald-600" : "text-slate-900")}>
          {typeof count === "number" ? `${count} pax` : "—"}
        </span>
      </div>
    </div>
  );
}
