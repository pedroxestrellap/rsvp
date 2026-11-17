export type WeddingRow = {
  id: string;
  workspace_id: string;
  slug: string | null;
  title: string | null;
  event_date: string | null; // date
  rsvp_deadline?: string | null;
  timezone?: string | null;
  theme_id: string | null;
  settings: any | null; // jsonb
  is_published: boolean | null;
  created_at: string | null;
};

export type WeddingInput = {
  title?: string;
  event_date?: string | null;
  rsvp_deadline?: string | null;
  theme_id?: string | null;
  settings?: any | null;
};
