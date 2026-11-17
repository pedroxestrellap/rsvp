import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type RsvpRow = {
  id?: string;
  guest_id?: string;
  status?: string | null;
  seats_confirmed?: number | null;
  dietary?: string | null;
  message?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type GuestRow = {
  id: string;
  wedding_id: string;
  full_name: string;
  max_seats: number | null;
  is_primary: boolean | null;
  primary_guest_id: string | null;
  group_id: string | null;
  invite_code: string | null;
  created_at: string;
  rsvps?: RsvpRow[] | RsvpRow | null;
};

type Props = {
  weddingId: string;
  initialGuests: GuestRow[];
};

type Status = "pending" | "confirmed" | "declined";

function normalizeStatus(v: any): Status {
  const s = String(v ?? "pending").toLowerCase();
  if (s === "confirmed" || s === "declined" || s === "pending") return s;
  return "pending";
}

function statusLabel(s: Status) {
  if (s === "confirmed") return "Confirmado";
  if (s === "declined") return "No asiste";
  return "Pendiente";
}

function statusPillClasses(s: Status) {
  if (s === "confirmed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (s === "declined") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function getRsvp0(g: any): RsvpRow | null {
  const r = g?.rsvps;
  if (!r) return null;
  if (Array.isArray(r)) return r[0] ?? null;
  if (typeof r === "object") return r as RsvpRow;
  return null;
}

export function RsvpManager({ weddingId, initialGuests }: Props) {
  const [guests, setGuests] = useState<GuestRow[]>(initialGuests || []);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");

  // abierto por grupo
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);

  const [savingGroupKey, setSavingGroupKey] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string>("");

  const grouped = useMemo(() => {
    const term = q.trim().toLowerCase();

    const filtered = guests.filter((g) => {
      const r0 = getRsvp0(g);
      const st = normalizeStatus(r0?.status);
      const matchesStatus = filter === "all" ? true : st === filter;
      const matchesName = term ? g.full_name.toLowerCase().includes(term) : true;
      return matchesStatus && matchesName;
    });

    const keyOf = (g: GuestRow) => g.group_id || g.primary_guest_id || g.id;

    const map = new Map<string, GuestRow[]>();
    for (const g of filtered) {
      const k = keyOf(g);
      map.set(k, [...(map.get(k) || []), g]);
    }

    const groups = Array.from(map.entries()).map(([k, items]) => {
      const sorted = [...items].sort(
        (a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary))
      );
      const primary = sorted.find((x) => x.is_primary) || sorted[0];
      return { key: k, primary, items: sorted };
    });

    // ordena por created_at del primary desc
    groups.sort((a, b) => (b.primary?.created_at || "").localeCompare(a.primary?.created_at || ""));
    return groups;
  }, [guests, q, filter]);

  function computeGroupSeats(items: GuestRow[]) {
    const primary = items.find((x) => x.is_primary) || items[0];
    const max = typeof primary?.max_seats === "number" ? primary.max_seats : null;

    const confirmedCount = items.reduce((acc, g) => {
      const st = normalizeStatus(getRsvp0(g)?.status);
      return acc + (st === "confirmed" ? 1 : 0);
    }, 0);

    return { confirmedCount, max };
  }

  async function saveGroup(groupKey: string, patches: Array<{ guestId: string; status: Status }>) {
    setErrMsg("");
    setSavingGroupKey(groupKey);

    try {
      // obtener guests del grupo para validar max_seats del primary
      const group = grouped.find((g) => g.key === groupKey);
      const items = group?.items || [];
      const { max } = computeGroupSeats(items);

      const nextConfirmed = items.reduce((acc, g) => {
        const override = patches.find((p) => p.guestId === g.id);
        const st = override ? override.status : normalizeStatus(getRsvp0(g)?.status);
        return acc + (st === "confirmed" ? 1 : 0);
      }, 0);

      if (typeof max === "number" && nextConfirmed > max) {
        throw new Error(`No puedes confirmar ${nextConfirmed} personas. Máximo permitido: ${max} (del Primary).`);
      }

      // upsert rsvps por guest_id
      const now = new Date().toISOString();

      const payload = patches.map((p) => ({
        guest_id: p.guestId,
        status: p.status,
        // seats_confirmed no se edita manual: lo dejamos null
        // (o podrías setear 1 si confirmed, pero con tu schema basta con status)
        updated_at: now,
      }));

      const { error } = await supabase
        .from("rsvps")
        .upsert(payload, { onConflict: "guest_id" });

      if (error) throw error;

      // actualizar estado local (sin refresh)
      setGuests((prev) =>
        prev.map((g) => {
          const p = patches.find((x) => x.guestId === g.id);
          if (!p) return g;

          const current = getRsvp0(g);
          const next: RsvpRow = {
            ...(current || {}),
            guest_id: g.id,
            status: p.status,
            updated_at: now,
          };

          return { ...g, rsvps: [next] };
        })
      );

      setOpenGroupKey(null);
    } catch (e: any) {
      setErrMsg(e?.message || "Error guardando RSVP.");
    } finally {
      setSavingGroupKey(null);
    }
  }

  return (
    <div className="grid gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar invitado…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="confirmed">Confirmados</option>
            <option value="declined">No asisten</option>
          </select>
        </div>

        <div className="text-xs text-slate-500">
          Wedding: <span className="font-semibold">{weddingId.slice(0, 8)}…</span>
        </div>
      </div>

      {errMsg ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errMsg}
        </div>
      ) : null}

      {/* Groups */}
      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          No hay resultados.
        </div>
      ) : (
        grouped.map((grp) => {
          const primary = grp.primary;
          const isOpen = openGroupKey === grp.key;

          const { confirmedCount, max } = computeGroupSeats(grp.items);

          return (
            <div key={grp.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              {/* Group header */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900">
                      Invitación: {primary?.full_name ?? "—"}
                    </div>

                    {primary?.invite_code ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                        {primary.invite_code}
                      </span>
                    ) : null}

                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
                      Seats: {confirmedCount}/{typeof max === "number" ? max : "—"}
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {grp.items.length > 1 ? `${grp.items.length} personas en el grupo` : "1 persona"}
                  </div>
                </div>

                <button
                  onClick={() => setOpenGroupKey((prev) => (prev === grp.key ? null : grp.key))}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {isOpen ? "Cerrar" : "Editar"}
                </button>
              </div>

              {/* Members view */}
              <div className="mt-4 grid gap-3">
                {grp.items.map((g) => {
                  const r0 = getRsvp0(g);
                  const st = normalizeStatus(r0?.status);

                  return (
                    <div
                      key={g.id}
                      className={`rounded-2xl border p-4 ${
                        g.is_primary ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50/40"
                      }`}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-slate-900">
                              {g.full_name}{" "}
                              <span className="text-xs font-semibold text-slate-400">
                                {g.is_primary ? "(Primary)" : "(Acompañante)"}
                              </span>
                            </div>

                            <span className={`rounded-full border px-3 py-1 text-xs ${statusPillClasses(st)}`}>
                              {statusLabel(st)}
                            </span>
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {r0?.message ? `Mensaje: ${r0.message}` : "Mensaje: —"}
                            {r0?.dietary ? ` · Dieta: ${r0.dietary}` : ""}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Group edit panel */}
              {isOpen ? (
                <GroupEditPanel
                  groupKey={grp.key}
                  items={grp.items}
                  primaryMaxSeats={typeof max === "number" ? max : null}
                  saving={savingGroupKey === grp.key}
                  onCancel={() => setOpenGroupKey(null)}
                  onSave={(patches) => saveGroup(grp.key, patches)}
                />
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}

function GroupEditPanel(props: {
  groupKey: string;
  items: GuestRow[];
  primaryMaxSeats: number | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (patches: Array<{ guestId: string; status: Status }>) => void;
}) {
  // estado editable por guestId
  const initial = useMemo(() => {
    const m = new Map<string, Status>();
    for (const g of props.items) {
      const st = normalizeStatus(getRsvp0(g)?.status);
      m.set(g.id, st);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.groupKey]); // si cambias de grupo, resetea

  const [map, setMap] = useState<Map<string, Status>>(initial);

  const confirmedCount = useMemo(() => {
    let c = 0;
    map.forEach((st) => {
      if (st === "confirmed") c++;
    });
    return c;
  }, [map]);

  const dirty = useMemo(() => {
    for (const g of props.items) {
      const a = normalizeStatus(getRsvp0(g)?.status);
      const b = map.get(g.id) ?? "pending";
      if (a !== b) return true;
    }
    return false;
  }, [map, props.items]);

  function setStatus(guestId: string, st: Status) {
    setMap((prev) => {
      const next = new Map(prev);
      next.set(guestId, st);
      return next;
    });
  }

  function buildPatches() {
    const patches: Array<{ guestId: string; status: Status }> = [];
    for (const g of props.items) {
      const before = normalizeStatus(getRsvp0(g)?.status);
      const after = map.get(g.id) ?? "pending";
      if (before !== after) patches.push({ guestId: g.id, status: after });
    }
    return patches;
  }

  const overLimit =
    typeof props.primaryMaxSeats === "number" ? confirmedCount > props.primaryMaxSeats : false;

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Editar RSVP del grupo</div>
          <div className="text-xs text-slate-500">
            Confirmados:{" "}
            <span className={`font-semibold ${overLimit ? "text-rose-700" : "text-slate-700"}`}>
              {confirmedCount}/{typeof props.primaryMaxSeats === "number" ? props.primaryMaxSeats : "—"}
            </span>{" "}
            (máximo del Primary)
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {props.items.map((g) => {
          const st = map.get(g.id) ?? "pending";
          return (
            <div key={g.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">
                  {g.full_name}{" "}
                  <span className="text-xs font-semibold text-slate-400">
                    {g.is_primary ? "(Primary)" : "(Acompañante)"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={st}
                  onChange={(e) => setStatus(g.id, normalizeStatus(e.target.value))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="pending">Pendiente</option>
                  <option value="confirmed">Confirmado</option>
                  <option value="declined">No asiste</option>
                </select>

                <span className={`rounded-full border px-3 py-1 text-xs ${statusPillClasses(st)}`}>
                  {statusLabel(st)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {overLimit ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Estás confirmando más personas de las permitidas por el Primary.
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          onClick={props.onCancel}
          disabled={props.saving}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Cancelar
        </button>

        <button
          onClick={() => props.onSave(buildPatches())}
          disabled={props.saving || !dirty || overLimit}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {props.saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
