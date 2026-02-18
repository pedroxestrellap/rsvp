import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Wedding = {
  id: string;
  title: string;
  slug: string;
  event_date: string | null;
  is_published: boolean;
};

export default function WeddingsList() {
  const [items, setItems] = useState<Wedding[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("weddings")
        .select("id,title,slug,event_date,is_published")
        .order("event_date", { ascending: true });

      if (error) setErr(error.message);
      else setItems(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="border rounded bg-white p-4">Cargando…</div>;
  if (err) return <div className="border rounded bg-white p-4">Error: {err}</div>;

  if (!items.length) {
    return <div className="border rounded bg-white p-4">No tienes bodas todavía.</div>;
  }

  return (
    <div className="grid gap-3">
      {items.map((w) => (
        <a key={w.id} className="block border rounded bg-white p-4 hover:bg-gray-50"
          href={`/wedding/${w.id}`}>
          <div className="font-semibold">{w.title}</div>
          <div className="text-sm opacity-70">
            {w.event_date ?? ""} · {w.is_published ? "Publicado" : "Borrador"}
          </div>
          <div className="text-xs opacity-60 mt-1">/i/{w.slug}</div>
        </a>
      ))}
    </div>
  );
}
