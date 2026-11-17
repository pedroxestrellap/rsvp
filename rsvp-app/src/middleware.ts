import { defineMiddleware } from "astro:middleware";
import { createServerClient } from "@supabase/ssr";
import { parse } from "cookie";

export const onRequest = defineMiddleware(async (context, next) => {
  // Ngrok terminates HTTPS before forwarding to the local HTTP dev server.
  if (import.meta.env.DEV && context.url.hostname === "peroratorical-twiggier-marc.ngrok-free.dev"
    && context.request.headers.get("x-forwarded-proto") === "https") {
    context.url.protocol = "https:";
  }
  const pathname = context.url.pathname;

  const isDashboard = pathname.startsWith("/dashboard");
  const isWeddings = pathname === "/weddings" || pathname.startsWith("/weddings/");
  const isLogin = pathname === "/dashboard/login";
  const isPasswordReset = pathname === "/dashboard/reset-password";
  if ((!isDashboard && !isWeddings) || isLogin || isPasswordReset) return next();

  const supabase = createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return Object.entries(parse(context.request.headers.get("cookie") ?? ""))
            .map(([name, value]) => ({ name, value: value ?? "" }));
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => context.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data } = await supabase.auth.getUser();

  if (!data.user) return context.redirect("/dashboard/login");

  context.locals.user = data.user;
  const response = await next();
  response.headers.set("Cache-Control", "no-store");
  return response;
});
