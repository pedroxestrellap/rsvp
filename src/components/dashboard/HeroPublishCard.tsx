import { Card } from "../ui/Card";

export function HeroPublishCard({
  loading,
  primaryCtaText,
  confirmed,
  pending,
  declined,
  onPrimary,
  onExport,
}: {
  loading: boolean;
  primaryCtaText: string;
  confirmed: number;
  pending: number;
  declined: number;
  onPrimary?: () => void;
  onExport?: () => void;
}) {
  return (
    <Card className="relative overflow-hidden border-emerald-700/10 bg-emerald-700 text-white">
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 10%, rgba(255,255,255,.35), transparent 45%), radial-gradient(circle at 85% 60%, rgba(255,255,255,.20), transparent 45%)",
        }}
      />
      <div className="relative p-6">
        <h3 className="text-base font-semibold">Centro de publicación</h3>
        <p className="mt-2 max-w-md text-sm text-white/80">
          Publica la invitación, comparte el link y monitorea RSVPs en tiempo real. Todo desde el dashboard.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            onClick={onPrimary}
            className="rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-white"
          >
            {primaryCtaText}
          </button>

          <button
            onClick={onExport}
            className="rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
          >
            Exportar lista
          </button>

          <div className="ml-auto grid h-16 w-20 place-items-center rounded-2xl bg-white/15">
            <div className="h-9 w-9 rounded-xl bg-white/20" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl bg-white/10 p-3">
            <p className="text-white/70">Confirmados</p>
            <p className="mt-1 text-sm font-semibold">{loading ? "…" : confirmed}</p>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <p className="text-white/70">Pendientes</p>
            <p className="mt-1 text-sm font-semibold">{loading ? "…" : pending}</p>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <p className="text-white/70">No asisten</p>
            <p className="mt-1 text-sm font-semibold">{loading ? "…" : declined}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
