export function normalizeGuestSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function guestFilters(params: URLSearchParams) {
  const status = params.get("guest_status") ?? "all";
  const companions = params.get("companions") ?? "all";
  return {
    q: (params.get("q") ?? "").slice(0, 200),
    status: ["all", "confirmed", "declined", "pending"].includes(status) ? status : "all",
    companions: ["all", "with", "without"].includes(companions) ? companions : "all",
  };
}

export function matchesGuest(search: string, status: string, hasCompanions: boolean, filters: ReturnType<typeof guestFilters>) {
  return search.includes(normalizeGuestSearch(filters.q))
    && (filters.status === "all" || filters.status === status)
    && (filters.companions === "all" || (filters.companions === "with") === hasCompanions);
}
