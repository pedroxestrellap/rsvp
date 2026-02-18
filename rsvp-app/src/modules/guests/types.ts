export type GuestRow = {
  id: string;
  wedding_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  max_seats: number | null;
  is_primary: boolean | null;
  primary_guest_id: string | null;
  group_id: string | null;
  tag: string | null;
  notes_internal: string | null;
  source: string | null;
  invite_code: string | null;
  created_at: string | null;
};

export type GuestCreateInput = {
  wedding_id: string;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  max_seats?: number | null;
  is_primary?: boolean | null;
  primary_guest_id?: string | null;
  group_id?: string | null;
  tag?: string | null;
  notes_internal?: string | null;
  source?: string | null;
  invite_code?: string | null;
};

export type GuestUpdateInput = Partial<Omit<GuestCreateInput, "wedding_id">>;
