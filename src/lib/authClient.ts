import { supabase } from "./supabaseClient";

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  // Debug rápido: confirma sesión
  const session = data.session;
  if (!session) {
    throw new Error("No session returned (check Auth settings / email confirmation)");
  }

  window.location.href = "/dashboard";
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.href = "/dashboard/login";
}

export async function requireSessionOrRedirect() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) window.location.href = "/dashboard/login";
  return data.session;
}
