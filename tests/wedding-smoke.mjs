// Opt-in integration check: creates one disposable wedding and removes it in finally.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { createServer, loadEnv } from "vite";

if (process.env.RSVP_INTEGRATION !== "1") throw new Error("Ejecuta con RSVP_INTEGRATION=1 para usar la base de datos de desarrollo.");
const env = loadEnv("development", process.cwd(), "");
const admin = createClient(env.SUPABASE_URL || env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const origin = process.env.RSVP_TEST_ORIGIN || "http://localhost:4321";
const vite = await createServer({ cacheDir: "node_modules/.vite-tests", server: { middlewareMode: true, hmr: false }, appType: "custom" });
const { signCoupleToken } = await vite.ssrLoadModule("/src/lib/coupleToken.ts");
let weddingId;
let secondWeddingId;
let temporaryUserId;
let membershipId;
async function check(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}
async function post(path, fields, headers = {}) {
  return fetch(`${origin}${path}`, { method: "POST", redirect: "manual", headers: { Origin: origin, ...headers },
    body: new URLSearchParams(fields) });
}
try {
  const workspace = await check(admin.from("workspaces").select("id").limit(1).single());
  const slug = `integration-${randomUUID()}`;
  const version = randomUUID();
  const wedding = await check(admin.from("weddings").insert({ workspace_id: workspace.id,
    title: "Boda de verificación temporal", slug, is_published: false,
    settings: { couple_access_version: version } }).select("id").single());
  weddingId = wedding.id;
  const secondWedding = await check(admin.from("weddings").insert({ workspace_id: workspace.id,
    title: "Segunda boda de verificación temporal", slug: `integration-${randomUUID()}`, settings: { untouched: true } }).select("id").single());
  secondWeddingId = secondWedding.id;
  const token = signCoupleToken(weddingId, version, env.COUPLE_ACCESS_SECRET || env.SUPABASE_SERVICE_ROLE_KEY);
  const path = `/couple/${token}`;

  // Use a disposable account to verify planner authentication and workspace isolation.
  const email = `rsvp-integration-${randomUUID()}@example.com`;
  const password = randomUUID();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (authError) throw authError;
  temporaryUserId = authData.user.id;
  const cookies = new Map();
  const session = createServerClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, { cookies: {
    getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
    setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
  } });
  const { error: loginError } = await session.auth.signInWithPassword({ email, password });
  if (loginError) throw loginError;
  const plannerHeaders = { Origin: origin, "Content-Type": "application/json", Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; ") };
  const accessUrl = `${origin}/api/weddings/${weddingId}/access`;
  assert.equal((await fetch(accessUrl, { method: "POST", headers: plannerHeaders, body: "{}" })).status, 403);
  const libraryPath = `/weddings/${weddingId}/templates`;
  const previewPath = `${libraryPath}/preview/floral_romance`;
  assert.equal((await fetch(`${origin}${libraryPath}`, { headers: { Cookie: plannerHeaders.Cookie }, redirect: "manual" })).status, 404);
  const membership = await check(admin.from("workspace_users").insert({ workspace_id: workspace.id,
    user_id: temporaryUserId, role: "planner" }).select("id").single());
  membershipId = membership.id;
  const plannerLink = await fetch(accessUrl, { method: "POST", headers: plannerHeaders, body: "{}" });
  assert.equal(plannerLink.status, 200);
  assert.equal((await plannerLink.json()).path, path);
  for (const plannerPath of ["/weddings", `/weddings/${weddingId}`, `/weddings/${weddingId}/guests`]) {
    const page = await fetch(`${origin}${plannerPath}`, { headers: { Cookie: plannerHeaders.Cookie }, redirect: "manual" });
    assert.equal(page.status, 200, plannerPath);
    assert.ok((await page.text()).includes("Boda de verificación temporal"), plannerPath);
  }
  const libraryPage = await fetch(`${origin}${libraryPath}`, { headers: { Cookie: plannerHeaders.Cookie } });
  assert.equal(libraryPage.status, 200);
  assert.ok((await libraryPage.text()).includes("Floral Romance"));
  const draftPreview = await fetch(`${origin}${previewPath}`, { headers: { Cookie: plannerHeaders.Cookie } });
  assert.equal(draftPreview.status, 200);
  assert.ok((await draftPreview.text()).includes("data-floral-envelope"));
  assert.equal((await check(admin.from("weddings").select("theme_id").eq("id", weddingId).single())).theme_id, "theme_1");

  let response = await fetch(`${origin}${path}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const portalHtml = await response.text();
  assert.ok(portalHtml.includes("Agregar invitado"));
  assert.match(portalHtml, /role="tablist"/);
  const openingTag = (html, id) => html.match(new RegExp(`<[^>]+id="${id}"[^>]*>`))?.[0] ?? "";
  assert.match(openingTag(portalHtml, "tab-guests"), /aria-selected="true"/);
  assert.match(openingTag(portalHtml, "panel-information"), /\bhidden\b/);
  for (const tab of ["information", "form"]) {
    const page = await fetch(`${origin}${path}?tab=${tab}`);
    const html = await page.text();
    assert.match(openingTag(html, `tab-${tab}`), /aria-selected="true"/);
    assert.doesNotMatch(openingTag(html, `panel-${tab}`), /\bhidden\b/);
    assert.match(openingTag(html, "panel-guests"), /\bhidden\b/);
  }
  response = await fetch(`${origin}/weddings`, { redirect: "manual" });
  assert.equal(response.status, 302);
  assert.equal((await fetch(`${origin}/i/${slug}`)).status, 404);

  response = await post(path, { action: "create_guest", full_name: "Invitado temporal", companions: "1" });
  assert.equal(response.status, 303);
  let guests = await check(admin.from("guests").select("id, max_seats, invite_code, is_primary").eq("wedding_id", weddingId));
  assert.equal(guests.length, 1);
  const guest = guests[0];
  assert.equal(guest.max_seats, 2);

  response = await post(path, { action: "update_guest", guest_id: guest.id, full_name: "Invitado editado", companions: "2" });
  assert.equal(response.status, 303);
  response = await post(path, { action: "add_companion", guest_id: guest.id, full_name: "Acompañante temporal" });
  assert.equal(response.status, 303);
  guests = await check(admin.from("guests").select("id, full_name, is_primary").eq("wedding_id", weddingId));
  assert.equal(guests.length, 2);
  assert.ok(guests.some(g => g.full_name === "Invitado editado"));

  response = await post(path, { action: "save_wedding", title: "Boda temporal editada", event_date: "2027-06-20",
    partner_one: "Persona A", partner_two: "Persona B", ceremony_venue: "Lugar de prueba",
    form_intro: "Introducción de prueba", custom_questions: "¿Necesitas transporte?", ask_companion_names: "on", active_tab: "form" });
  assert.equal(response.status, 303);
  assert.equal(new URL(response.headers.get("location"), origin).searchParams.get("tab"), "form");
  response = await post(path, { action: "publish" });
  assert.equal(response.status, 303);
  response = await fetch(`${origin}/i/${slug}`);
  assert.equal(response.status, 200);
  const invitationHtml = await response.text();
  assert.ok(invitationHtml.includes("Lugar de prueba"));
  assert.ok(!invitationHtml.includes('name="code"'));
  response = await fetch(`${origin}/i/${slug}?code=${guest.invite_code}`);
  const personalInvitation = await response.text();
  assert.ok(personalInvitation.includes("Invitado editado"));
  assert.match(personalInvitation,/data-invitation-recipient/);
  assert.match(personalInvitation,/name="response" value="declined"/);
  response = await fetch(`${origin}/i/${slug}/rsvp?status=declined`);
  assert.ok((await response.text()).includes("Abre el enlace"));
  response = await fetch(`${origin}/i/${slug}/rsvp?status=declined&code=${guest.invite_code}`);
  const declineHtml = await response.text();
  assert.match(declineHtml, /name="status" value="declined"/);
  assert.ok(declineHtml.includes("No asistir"));
  response = await fetch(`${origin}/i/${slug}/rsvp?code=${guest.invite_code}`);
  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes("¿Necesitas transporte?"));

  response = await fetch(`${origin}/api/rsvp`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ slug, invite_code: guest.invite_code, status: "confirmed", seats_confirmed: 2,
      plus_ones: ["Acompañante editado"], custom_answers: ["Sí, gracias"] }) });
  assert.equal(response.status, 200, await response.text());
  const rsvp = await check(admin.from("rsvps").select("status, seats_confirmed, message").eq("guest_id", guest.id).single());
  assert.equal(rsvp.status, "confirmed");
  assert.equal(rsvp.seats_confirmed, 2);
  assert.ok(rsvp.message.includes("Sí, gracias"));

  response = await fetch(`${origin}/api/rsvp`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ slug, invite_code: guest.invite_code, status: "declined", seats_confirmed: 0 }) });
  assert.equal(response.status, 200, await response.text());
  const declined = await check(admin.from("rsvps").select("status, seats_confirmed").eq("guest_id", guest.id).single());
  assert.equal(declined.status, "declined");
  assert.equal(declined.seats_confirmed, 0);
  assert.equal((await check(admin.from("guests").select("id").eq("wedding_id", weddingId))).length, 2);

  const beforeTemplate = await check(admin.from("weddings").select("*").eq("id", weddingId).single());
  const guestsBefore = await check(admin.from("guests").select("*").eq("wedding_id", weddingId).order("id"));
  const rsvpBefore = await check(admin.from("rsvps").select("*").eq("guest_id", guest.id).single());
  response = await post(libraryPath, { theme_id: "floral_romance" }, { Cookie: plannerHeaders.Cookie });
  assert.equal(response.status, 303, "El esquema existente debe aceptar el identificador del template sin migración");
  const afterTemplate = await check(admin.from("weddings").select("*").eq("id", weddingId).single());
  assert.deepEqual(afterTemplate, { ...beforeTemplate, theme_id: "floral_romance" });
  assert.deepEqual(await check(admin.from("guests").select("*").eq("wedding_id", weddingId).order("id")), guestsBefore);
  assert.deepEqual(await check(admin.from("rsvps").select("*").eq("guest_id", guest.id).single()), rsvpBefore);
  assert.equal((await check(admin.from("weddings").select("theme_id").eq("id", secondWeddingId).single())).theme_id, "theme_1");
  response = await fetch(`${origin}/i/${slug}?code=${guest.invite_code}`);
  assert.match(await response.text(), /data-template="floral_romance"/);
  response = await fetch(`${origin}/i/${slug}/rsvp?code=${guest.invite_code}`);
  assert.match(await response.text(), /data-template="floral_romance"/);
  response = await fetch(`${origin}${previewPath}?screen=rsvp`, { headers: { Cookie: plannerHeaders.Cookie } });
  assert.match(await response.text(), /data-preview="true"/);
  response = await post(libraryPath, { theme_id: "not-a-template" }, { Cookie: plannerHeaders.Cookie });
  assert.equal(response.status, 200);
  assert.equal((await check(admin.from("weddings").select("theme_id").eq("id", weddingId).single())).theme_id, "floral_romance");

  if (process.env.RSVP_PLAYWRIGHT_MODULE) {
    const { browserChecks } = await import("./wedding-browser-checks.mjs");
    await browserChecks({ origin, path, slug, weddingId, cookies, code: guest.invite_code });
  }
  response = await post(libraryPath, { theme_id: "theme_1" }, { Cookie: plannerHeaders.Cookie });
  assert.equal(response.status, 303);
  response = await fetch(`${origin}/i/${slug}`);
  assert.match(await response.text(), /data-template="theme_1"/);
  response = await post(previewPath, {}, { Cookie: plannerHeaders.Cookie });
  assert.equal(response.status, 303);
  assert.equal((await check(admin.from("weddings").select("theme_id").eq("id", secondWeddingId).single())).theme_id, "theme_1");

  response = await post(path, { action: "delete_guest", guest_id: guest.id });
  assert.equal(response.status, 303);
  guests = await check(admin.from("guests").select("id").eq("wedding_id", weddingId));
  assert.equal(guests.length, 0);
  const orphanRsvps = await check(admin.from("rsvps").select("id").eq("guest_id", guest.id));
  assert.equal(orphanRsvps.length, 0);

  const renewed = await fetch(accessUrl, { method: "POST", headers: plannerHeaders, body: JSON.stringify({ renew: true }) });
  assert.equal(renewed.status, 200);
  const newPath = (await renewed.json()).path;
  assert.notEqual(newPath, path);
  assert.equal((await fetch(`${origin}${path}`)).status, 404);
  assert.equal((await fetch(`${origin}${newPath}`)).status, 200);
  assert.equal((await fetch(`${origin}/couple/invalid`)).status, 404);
  console.log("OK: autenticación, pestañas, invitados, RSVP, templates por boda, vista previa, conservación de datos y revocación.");
} finally {
  try {
    if (weddingId) {
      const { data: guests } = await admin.from("guests").select("id").eq("wedding_id", weddingId);
      if (guests?.length) await check(admin.from("rsvps").delete().in("guest_id", guests.map(g => g.id)));
      await check(admin.from("guests").delete().eq("wedding_id", weddingId).eq("is_primary", false));
      await check(admin.from("guests").delete().eq("wedding_id", weddingId));
      await check(admin.from("weddings").delete().eq("id", weddingId));
      console.log("Datos temporales eliminados.");
    }
    if (secondWeddingId) await check(admin.from("weddings").delete().eq("id", secondWeddingId));
  } finally {
    try {
      if (membershipId) await check(admin.from("workspace_users").delete().eq("id", membershipId));
      if (temporaryUserId) {
        const { error } = await admin.auth.admin.deleteUser(temporaryUserId);
        if (error) throw error;
        console.log("Cuenta temporal eliminada.");
      }
    } finally { await vite.close(); }
  }
}
