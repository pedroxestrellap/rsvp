export type RSVPRow = {
  id: string;
  guest_id: string;
  status: string | null;
  seats_confirmed: number | null;
  dietary: string | null;
  message: string | null;
  updated_at: string | null;
  created_at: string | null;
};

export type RSVPUpdateInput = {
  status?: string | null;
  seats_confirmed?: number | null;
  dietary?: string | null;
  message?: string | null;
};
