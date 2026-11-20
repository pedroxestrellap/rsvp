import type { SheetData } from "write-excel-file/browser";
import type { GuestRow } from "../modules/guests/types";

export type ExportRsvp = { status: string; seats_confirmed?: number | null; dietary?: string | null; message?: string | null };
type ExportGuest = Pick<GuestRow, "full_name" | "phone" | "email" | "max_seats"> & { rsvps?: ExportRsvp[] | ExportRsvp | null };
export type GuestExportRow = (string | number | null)[];

const headers = ["Nombre", "Tipo", "Invitado principal", "Teléfono", "Email", "Estado RSVP", "Cupo de la invitación", "Personas confirmadas (grupo)", "Restricciones alimentarias", "Mensaje para los novios"];

export function guestExportRows(primary: ExportGuest, companions: ExportGuest[]): GuestExportRow[] {
  return [primary, ...companions].map((guest, index) => {
    const response = Array.isArray(guest.rsvps) ? guest.rsvps[0] : guest.rsvps;
    const status = response?.status === "confirmed" ? "Confirmado" : response?.status === "declined" ? "No asiste" : "Pendiente";
    return [guest.full_name ?? "", index === 0 ? "Principal" : "Acompañante", primary.full_name ?? "",
      guest.phone ?? "", guest.email ?? "", status, index === 0 ? primary.max_seats ?? 1 : null,
      index === 0 ? (response?.status === "confirmed" ? response.seats_confirmed ?? null : 0) : null,
      response?.dietary ?? "", response?.message ?? ""];
  });
}

export function guestExportSheet(rows: GuestExportRow[]): SheetData {
  return [headers.map(value => ({ value, fontWeight: "bold", backgroundColor: "#E1DAF5", wrap: true })),
    ...rows.map(row => row.map(value => value === null ? null : typeof value === "number"
      ? { value, type: Number, format: "0" }
      : { value, type: String, format: "@", wrap: true }))];
}

export const guestExportOptions = {
  sheet: "Invitados",
  stickyRowsCount: 1,
  columns: [30, 18, 30, 22, 32, 18, 24, 30, 36, 44].map(width => ({ width })),
};

export function guestExportFilename(title: string) {
  const name = title.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "boda";
  return `invitados-${name}.xlsx`;
}
