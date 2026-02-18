import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("Entrando...");

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
      <input
        type="password"
        placeholder="Contraseña"
        className="border p-2 rounded"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
      />
      <button className="border p-2 rounded font-medium" disabled={loading} type="submit">
        {loading ? "Entrando..." : "Entrar"}
      </button>

      {msg && <pre className="text-xs whitespace-pre-wrap">{msg}</pre>}
    </form>
  );
}
