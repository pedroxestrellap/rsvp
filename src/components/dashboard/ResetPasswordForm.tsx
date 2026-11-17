import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState("Verificando enlace...");

  useEffect(() => {
    let active = true;

    async function checkRecoverySession() {
      try {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.slice(1));
        const linkError = hash.get("error_description") || url.searchParams.get("error_description");
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        // Emails sent from the Supabase panel use hash tokens, while the app uses PKCE.
        // Remove hash tokens from browser history before establishing the cookie session.
        if (url.hash) {
          url.hash = "";
          window.history.replaceState(window.history.state, "", url.toString());
        }

        if (linkError) throw new Error("El enlace ha caducado o no es válido. Solicita uno nuevo.");

        const { data, error } = accessToken && refreshToken
          ? await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          : await supabase.auth.getSession();

        if (error || !data.session) {
          throw new Error("No se pudo verificar el enlace. Solicita uno nuevo y ábrelo en el mismo navegador.");
        }

        if (active) {
          setReady(true);
          setMsg("");
        }
      } catch (error) {
        if (active) setMsg(error instanceof Error ? error.message : "No se pudo verificar el enlace.");
      }
    }

    void checkRecoverySession();
    return () => { active = false; };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || loading) return;
    if (password !== confirmation) {
      setMsg("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    setMsg("Guardando contraseña...");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirmation("");
      setDone(true);
      setMsg("Tu contraseña se ha actualizado.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "No se pudo guardar la contraseña. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 grid gap-3">
      {ready && !done && <form onSubmit={onSubmit} className="grid gap-3">
        <label className="grid gap-1 text-sm">
          Nueva contraseña
          <input
            type="password"
            className="border p-2 rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          Confirmar contraseña
          <input
            type="password"
            className="border p-2 rounded"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
          />
        </label>
        <p className="text-xs opacity-70">Usa al menos 8 caracteres.</p>
        <button className="border p-2 rounded font-medium" disabled={loading} type="submit">
          {loading ? "Guardando..." : "Guardar contraseña"}
        </button>
      </form>}
      {msg && <p className="text-sm" role="status">{msg}</p>}
      {done
        ? <a className="text-sm underline" href="/dashboard">Ir al dashboard</a>
        : <a className="text-sm underline" href="/dashboard/login">Volver al inicio de sesión</a>}
    </div>
  );
}
