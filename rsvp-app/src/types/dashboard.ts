export type Workspace = {
  id: string;
  name?: string | null;
  slug?: string | null;
};

export type WeddingRow = {
  id: string;
  workspace_id: string;
  slug: string | null;
  title: string | null;
  status?: string | null;
  event_date: string | null;
  is_published: boolean | null;
  created_at: string | null;
};

export type RSVPRow = {
  id: string;
  event_id?: string;
  guest_name?: string | null;
  status?: string | null;
  count?: number | null;
  notes?: string | null;
  updated_at?: string | null;
};

export type MiniCardItem = {
  title: string;
  subtitle: string;
  value: string;
  status: string;
};
