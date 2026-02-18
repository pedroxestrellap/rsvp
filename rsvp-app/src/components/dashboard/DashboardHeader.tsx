import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function DashboardHeader({ userEmail = "" }: { userEmail?: string }) {
  async function onLogout() {
    await supabase.auth.signOut();
    window.location.href = "/dashboard/login";
  }

  return (
    <header className="border-b bg-white">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        <a href="/dashboard" className="font-bold">Planner Dashboard</a>

        <div className="flex items-center gap-3">
          {userEmail ? <span className="text-sm opacity-70">{userEmail}</span> : null}
          <button onClick={onLogout} className="text-sm underline">Cerrar sesión</button>
        </div>
      </div>
    </header>
  );
}

