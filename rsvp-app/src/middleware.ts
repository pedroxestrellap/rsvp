import { defineMiddleware } from "astro:middleware";
import { createServerClient } from "@supabase/ssr";

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = context.url.pathname;

  const isDashboard = pathname.startsWith("/dashboard");
  const isLogin = pathname === "/dashboard/login";
  if (!isDashboard || isLogin) return next();

  const supabase = createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return context.cookies.get(name)?.value;
        },
        set(name, value, options) {
          context.cookies.set(name, value, options);
        },
        remove(name, options) {
          context.cookies.delete(name, options);
        },
      },
    }
  );

  const { data } = await supabase.auth.getUser();

  if (!data.user) return context.redirect("/dashboard/login");

  context.locals.user = data.user;
  return next();
});
