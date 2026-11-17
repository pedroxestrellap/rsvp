import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(recovering ? "Enviando enlace..." : "Entrando...");

    if (recovering) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/dashboard/reset-password`,
        });
        setMsg(error
          ? `Error: ${error.message}`
          : "Si el correo está registrado, recibirás un enlace para cambiar tu contraseña. Ábrelo en este mismo navegador.");
      } catch {
        setMsg("No se pudo enviar el enlace. Revisa tu conexión e inténtalo de nuevo.");
      } finally {
        setLoading(false);
      }
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMsg(`Error: ${error.message}`);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setMsg("No se creó sesión. Revisa confirmación de email en Supabase Auth.");
      setLoading(false);
      return;
    }

    setMsg("OK. Redirigiendo...");
    window.location.href = "/dashboard";
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-3">
      <input
        type="email"
        placeholder="Email"
        className="border p-2 rounded"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />
      {!recovering && <input
        type="password"
        placeholder="Contraseña"
        className="border p-2 rounded"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
      />}
      <button className="border p-2 rounded font-medium" disabled={loading} type="submit">
        {loading ? "Procesando..." : recovering ? "Enviar enlace de recuperación" : "Entrar"}
      </button>

      <button
        className="text-sm underline"
        type="button"
        disabled={loading}
        onClick={() => {
          setRecovering(!recovering);
          setPassword("");
          setMsg("");
        }}
      >
        {recovering ? "Volver al inicio de sesión" : "Olvidé mi contraseña"}
      </button>

      {msg && <p className="text-xs whitespace-pre-wrap" role="status">{msg}</p>}
    </form>
  );
}
