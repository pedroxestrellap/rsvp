import { useMemo } from "react";
import type { Workspace, WeddingRow } from "../../types/dashboard";
import { WorkspaceSummaryCard } from "./WorkspaceSummaryCard";
import { HeroPublishCard } from "./HeroPublishCard";
import { GuestSummaryCard } from "./GuestSummaryCard";
import { MiniCard } from "./MiniCard";
import { RsvpRow } from "./RsvpRow";


type Props = {
  initialWorkspace: Workspace | null;
  initialWeddings: WeddingRow[];
  initialStatsByWedding: Record<string, any>;
  initialRecentRsvps: any[];
};

export default function DashboardHome({
  initialWorkspace,
  initialWeddings,
  initialStatsByWedding,
  initialRecentRsvps,
}: Props) {
  const workspaceName = initialWorkspace?.name ?? "Mi Workspace";
  const workspaceSlug = initialWorkspace?.slug ?? "—";

  const totalWeddings = initialWeddings?.length ?? 0;
  const published = (initialWeddings ?? []).filter((w) => w.is_published).length;
  const drafts = totalWeddings - published;

  // Global stats (sumando todas las bodas del workspace)
  const stats = useMemo(() => {
    let confirmed = 0, pending = 0, declined = 0;
    for (const w of initialWeddings ?? []) {
      const s = initialStatsByWedding?.[w.id];
      confirmed += Number(s?.confirmed ?? 0);
      pending += Number(s?.pending ?? 0);
      declined += Number(s?.declined ?? 0);
    }
    return { confirmed, pending, declined };
  }, [initialWeddings, initialStatsByWedding]);

  // Mini cards: mostrar las 4 bodas más recientes
  const miniCards = useMemo(() => {
    if ((initialWeddings ?? []).length > 0) {
      return initialWeddings.slice(0, 4).map((w) => ({
        title: w.title || "Boda sin título",
        subtitle: w.slug ? `Slug: ${w.slug}` : "Slug: —",
        value: w.is_published ? "Publicado" : "Borrador",
        status: w.is_published ? "published" : "draft",
      }));
    }
    return [
      { title: "Bodas activas", subtitle: "Este workspace", value: String(totalWeddings), status: "draft" },
      { title: "Publicadas", subtitle: "Listas para compartir", value: String(published), status: "published" },
      { title: "Borradores", subtitle: "Por terminar", value: String(drafts), status: "pending" },
      { title: "RSVP recientes", subtitle: "Últimas respuestas", value: String(initialRecentRsvps.length), status: "confirmed" },
    ];
  }, [initialWeddings, totalWeddings, published, drafts, initialRecentRsvps.length]);

  const heroPrimaryCta = () => {
    const pub = initialWeddings.find((w) => w.is_published && w.slug);
    if (pub?.slug) return "Ver invitación publicada";
    if (totalWeddings > 0) return "Publicar invitación";
    return "Crear primera boda";
  };

  return (
    <div className="px-8 pb-10">
      <div className="grid gap-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <WorkspaceSummaryCard
            loading={false}
            workspaceName={workspaceName}
            workspaceSlug={workspaceSlug}
            totalWeddings={totalWeddings}
            published={published}
            drafts={drafts}
            rsvpToday={initialRecentRsvps.length}
            onNewWedding={() => {}}
            onTeam={() => {}}
          />

          <HeroPublishCard
            loading={false}
            primaryCtaText={heroPrimaryCta()}
            confirmed={stats.confirmed}
            pending={stats.pending}
            declined={stats.declined}
            onPrimary={() => {}}
            onExport={() => {}}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {miniCards.map((c, idx) => (
            <MiniCard key={idx} {...c} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* RSVP recientes */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h3 className="text-sm font-semibold text-slate-900">RSVP recientes</h3>
            </div>

            <div className="px-6 py-3">
              {initialRecentRsvps.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  Aún no hay RSVPs. Publica una invitación y comparte el link.
                </div>
              ) : (
                <div className="grid gap-2">
                  {initialRecentRsvps.map((r: any) => (
                    <RsvpRow key={r.id} rsvp={r} />
                  ))}
                </div>
              )}
              <div className="py-4 text-center">
                <button className="text-sm font-semibold text-slate-600 hover:text-slate-900">
                  Ver todo →
                </button>
              </div>
            </div>
          </div>

          <GuestSummaryCard
            loading={false}
            confirmed={stats.confirmed}
            pending={stats.pending}
            declined={stats.declined}
            onTables={() => {}}
            onImport={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
