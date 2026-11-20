export type InvitationGuest = { full_name: string; max_seats: number };
export type InvitationCompanion = { id?: string; full_name: string; attending?: boolean };
export type InvitationRsvp = {
  code?: string;
  companions?: InvitationCompanion[];
  initialStatus?: "confirmed" | "declined" | "pending";
  isConfirmed?: boolean;
  closed?: boolean;
  preview?: boolean;
};
