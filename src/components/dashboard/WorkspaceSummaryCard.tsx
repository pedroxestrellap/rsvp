import { Card } from "../ui/Card";

export function WorkspaceSummaryCard({
  loading,
  workspaceName,
  workspaceSlug,
  totalWeddings,
  published,
  drafts,
  rsvpToday,
  onNewWedding,
  onTeam,
}: {
  loading: boolean;
  workspaceName?: string | null;
  workspaceSlug?: string | null;
  totalWeddings: number;
  published: number;
  drafts: number;
  rsvpToday: number;
  onNewWedding?: () => void;
  onTeam?: () => void;
}) {
  return (
    <Card>
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500">Workspace</p>
            <h2 className="mt-1 text-base font-semibold text-slate-900">
              {workspaceName || "Mi Workspace"}
            </h2>
            <p className="mt-2 text-xs text-slate-400">
              {workspaceSlug ? `Slug: ${workspaceSlug}` : "Slug: —"}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs text-slate-500">Bodas activas</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {loading ? "…" : totalWeddings}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={onNewWedding}
            className="hidden sm:inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
            >
            + Nueva boda
            </button>

          <button
            onClick={onTeam}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Gestionar equipo
          </button>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
          <div>
            <p className="text-xs text-slate-500">Publicadas</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {loading ? "…" : published}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Borradores</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {loading ? "…" : drafts}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">RSVP hoy</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {loading ? "…" : rsvpToday}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
