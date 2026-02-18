import { Card } from "../ui/Card";
import { CardHeader } from "../ui/CardHeader";
import { cn } from "../../utils/ui";

export function GuestSummaryCard({
  loading,
  confirmed,
  pending,
  declined,
  onTables,
  onImport,
}: {
  loading: boolean;
  confirmed: number;
  pending: number;
  declined: number;
  onTables?: () => void;
  onImport?: () => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Resumen de invitados"
        action={<button className="h-8 w-8 rounded-lg bg-emerald-600/10 text-emerald-700" aria-label="action" />}
      />

      <div className="p-6">
        <div className="grid grid-cols-3 gap-4 text-xs text-slate-500">
          <div>
            <p>confirmados</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{loading ? "…" : confirmed}</p>
          </div>
          <div>
            <p>pendientes</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{loading ? "…" : pending}</p>
          </div>
          <div>
            <p>no asisten</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{loading ? "…" : declined}</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Donut placeholder */}
          <div className="grid place-items-center">
            <div className="relative h-44 w-44 rounded-full border-[14px] border-slate-200">
              <div className="absolute inset-0 rounded-full border-[14px] border-emerald-500/70 [clip-path:polygon(50%_50%,0_0,100%_0)]" />
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <p className="text-xs text-slate-400">Confirmados</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "…" : confirmed}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-3 text-sm">
            {[
              ["Confirmados", "bg-emerald-400"],
              ["Pendientes", "bg-slate-400"],
              ["No asisten", "bg-rose-400"],
              ["Mesas", "bg-indigo-400"],
              ["Acompañantes", "bg-sky-400"],
            ].map(([label, dot]) => (
              <div key={label} className="flex items-center gap-3">
                <span className={cn("h-2.5 w-2.5 rounded-full", dot)} />
                <span className="text-slate-600">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={onTables}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Administrar mesas
          </button>
          <button
            onClick={onImport}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Importar invitados
          </button>
        </div>
      </div>
    </Card>
  );
}
