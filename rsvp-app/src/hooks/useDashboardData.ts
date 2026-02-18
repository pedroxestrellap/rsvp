import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { WeddingRow, RSVPRow, Workspace } from "../types/dashboard";

type InitialData = {
  initialWorkspace?: Workspace | null;
  initialWeddings?: WeddingRow[];
  initialRecentRsvps?: RSVPRow[];
};

export function useDashboardData(initial: InitialData = {}) {
  const [loading, setLoading] = useState(false);

  const [workspace, setWorkspace] = useState<Workspace | null>(
    initial.initialWorkspace ?? null
  );
  const [weddings, setWeddings] = useState<WeddingRow[]>(
    initial.initialWeddings ?? []
  );
  const [recentRsvps, setRecentRsvps] = useState<RSVPRow[]>(
    initial.initialRecentRsvps ?? []
  );

  const stats = useMemo(() => {
    const totalweddings = weddings.length;
    const published = weddings.filter((e) => (e.status || "").toLowerCase() === "published").length;
    const drafts = weddings.filter((e) => (e.status || "").toLowerCase() === "draft").length;

    const confirmed = recentRsvps.filter((r) => (r.status || "").toLowerCase() === "confirmed").length;
    const declined = recentRsvps.filter((r) => (r.status || "").toLowerCase() === "declined").length;
    const pending = recentRsvps.filter((r) => (r.status || "").toLowerCase() === "pending").length;

    return { totalweddings, published, drafts, confirmed, declined, pending };
  }, [weddings, recentRsvps]);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: memberships, error: mErr } = await supabase
        .from("workspace_users")
        .select("workspace_id, role, workspaces:workspace_id(id,name,slug)")
        .limit(1);

      if (!mErr && memberships && memberships.length > 0) {
        const ws = memberships[0]?.workspaces as any;
        const wsObj = ws ? { id: ws.id, name: ws.name, slug: ws.slug } : null;
        setWorkspace(wsObj);

        const { data: wds, error: wErr } = await supabase
          .from("weddings")
          .select("id, workspace_id, name, date, status, slug, created_at")
          .eq("workspace_id", memberships[0].workspace_id)
          .order("created_at", { ascending: false })
          .limit(12);

        if (!wErr && wds) setWeddings(wds as WeddingRow[]);

        const { data: rsvps, error: rErr } = await supabase
          .from("rsvps")
          .select("id, event_id, guest_name, status, count, notes, updated_at")
          .order("updated_at", { ascending: false })
          .limit(7);

        if (!rErr && rsvps) setRecentRsvps(rsvps as RSVPRow[]);
      }

      setLoading(false);
    })();
  }, []);

  return { loading, workspace, weddings, recentRsvps, stats };
}
