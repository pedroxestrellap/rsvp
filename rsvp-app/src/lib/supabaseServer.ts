// src/lib/supabaseServer.ts
import { createServerClient } from "@supabase/ssr";
import { parse } from "cookie";
import type { AstroGlobal } from "astro";

export function supabaseServer(Astro: AstroGlobal) {
  const url = import.meta.env.PUBLIC_SUPABASE_URL as string;
  const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;

  if (!url || !anon) throw new Error("Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY");

  return createServerClient(url, anon, {
    cookies: {
      // Astro NO tiene cookies.getAll(), por eso parseamos el header:
      getAll() {
        const cookieHeader = Astro.request.headers.get("cookie") ?? "";
        const parsed = parse(cookieHeader);
        return Object.entries(parsed).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          Astro.cookies.set(name, value, options);
        });
      },
    },
  });
}
