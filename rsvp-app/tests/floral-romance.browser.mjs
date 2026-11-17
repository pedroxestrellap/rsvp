// Visual/functional checks against a disposable DEV-only route. No database writes.
// Run alongside `npm run dev`; supply external Playwright/axe modules (see README).
import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";

if (!process.env.RSVP_PLAYWRIGHT_MODULE) throw new Error("Configura RSVP_PLAYWRIGHT_MODULE con un módulo Playwright externo.");
const { chromium } = await import(process.env.RSVP_PLAYWRIGHT_MODULE);
const AxeBuilder = process.env.RSVP_AXE_MODULE ? (await import(process.env.RSVP_AXE_MODULE)).default : null;
const origin = process.env.RSVP_TEST_ORIGIN || "http://localhost:4321";
const base = `${origin}/floral-visual-check`;
const route = new URL("../src/pages/floral-visual-check.astro", import.meta.url);
const fixture = await readFile(new URL("./fixtures/floral-preview.astro", import.meta.url), "utf8");
await writeFile(route, fixture, { flag: "wx" }); // Never overwrite a real page.
let browser;
const errors = [];
const screenshot = async (locator, name) => {
  if (process.env.RSVP_SCREENSHOTS) await locator.screenshot({ path: `${process.env.RSVP_SCREENSHOTS}/floral-${name}.png` });
};
try {
  browser = await chromium.launch({ executablePath: process.env.RSVP_BROWSER_EXECUTABLE, headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "astro-dev-toolbar { display: none !important; }" });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator("[data-invitation-recipient]").isVisible(), true);
    assert.match(await page.locator("[data-invitation-recipient]").textContent(), /Invitada de verificación/);
    await page.locator("summary").waitFor();
    if ([390, 1440].includes(width)) await screenshot(page, `envelope-${width}`);
    await page.locator("summary").focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    assert.equal(await page.locator(".floral-envelope").evaluate(el => el.open && el.classList.contains("is-opening")), true);
    if (width === 390) await screenshot(page, "opening-390");
    await page.locator(".floral-hero h1").waitFor({ state: "visible" });
    await page.waitForTimeout(850);
    assert.equal(await page.locator("[data-invitation-title]").evaluate(el => el === document.activeElement), true);
    assert.equal(await page.locator("[data-floral-section]").count(), 8); // Envelope is the ninth composition.
    assert.equal(await page.locator(".floral-activity").count(), 5);
    assert.equal(await page.locator(".calendar-wedding-day").textContent(), "29");
    assert.equal(await page.locator(".calendar-wedding-day").evaluate(el => el.closest("td").cellIndex), 1, "29/02/2028 is Tuesday");
    assert.equal(await page.locator(".floral-dress-colors li").count(), 3, "Use the wedding's colors, not the template palette");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow ${width}px`);
    assert.deepEqual(await page.locator("img").evaluateAll(els => els.filter(el => !el.complete || !el.naturalWidth).map(el => el.src)), []);
    const palette = await page.locator(".invitation-shell").evaluate(el => {
      const css = getComputedStyle(el);
      return ["--butter", "--sage", "--blue", "--lavender", "--pink"].map(name => css.getPropertyValue(name).trim());
    });
    assert.deepEqual(palette, ["#FAEDA1", "#ABBD98", "#8AACCA", "#A79DBB", "#F6CFD3"]);
    assert.equal(await page.locator(".floral-embedded-form #rsvpForm").count(), 1);
    if ([390, 1440].includes(width) && process.env.RSVP_SCREENSHOTS) {
      await page.screenshot({ path: `${process.env.RSVP_SCREENSHOTS}/floral-invitation-${width}.png`, fullPage: true });
      for (const section of ["cover", "welcome", "calendar", "itinerary", "location", "gifts", "dress", "rsvp"]) {
        await screenshot(page.locator(`[data-floral-section="${section}"]`), `${section}-${width}`);
      }
    }
    console.log(`PASS compositions, envelope animation/keyboard, leap day, colors, embedded RSVP, images and layout: ${width}px`);
  }
  if (AxeBuilder) {
    await page.setViewportSize({ width: 390, height: 844 });
    const results = await new AxeBuilder({ page }).exclude("astro-dev-toolbar").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    assert.deepEqual(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.failureSummary) })), []);
  }
  await page.getByRole("checkbox",{name:"Segundo acompañante",exact:true}).check();
  assert.equal(await page.locator("[name=seats_confirmed]").inputValue(), "2");
  assert.equal(await page.locator("[name=code]").count(), 0);
  assert.equal(await page.locator("select[name=status]").count(), 0);
  let requests = 0;
  await page.route("**/api/rsvp", async route => {
    requests++;
    const body = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true, companions:body.companions.map((companion,i)=>({...companion,id:companion.id || (companion.attending ? `created-${i}` : undefined)})) } });
  });
  await page.getByRole("button",{name:"Asistir",exact:true}).click();
  assert.match(await page.locator("#result").textContent(), /No se ha guardado/);
  assert.equal(requests, 0, "Preview never posts a real RSVP");
  await page.getByRole("button", { name: "No asistir", exact: true }).click();
  assert.equal(await page.locator("[name=status]").inputValue(), "declined");
  assert.equal(requests,0);

  await page.goto(`${base}?form&submit`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "astro-dev-toolbar { display: none !important; }" });
  await page.getByRole("checkbox",{name:"Segundo acompañante",exact:true}).check();
  const post = page.waitForRequest("**/api/rsvp");
  await page.getByRole("button",{name:"Asistir",exact:true}).click();
  const payload = (await post).postDataJSON();
  assert.equal(payload.invite_code, "local-check");
  assert.equal(payload.seats_confirmed, 2);
  assert.deepEqual(payload.companions.map(companion=>[companion.id,companion.attending]), [["companion-one",false],["companion-two",true]]);
  await page.locator("#result").filter({ hasText: "Tu respuesta se ha guardado" }).waitFor();
  if (AxeBuilder) {
    const results = await new AxeBuilder({ page }).exclude("astro-dev-toolbar").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    assert.deepEqual(results.violations.map(v => v.id), []);
  }
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await screenshot(page.locator(".invitation-form-page"), `form-${width}`);
  }
  const declinePost = page.waitForRequest("**/api/rsvp");
  await page.getByRole("button",{name:"No asistir",exact:true}).click();
  const declined = (await declinePost).postDataJSON();
  assert.equal(declined.status,"declined");
  assert.equal(declined.seats_confirmed,0);
  assert.ok(declined.companions.every(companion=>!companion.attending));
  await page.locator("#result").filter({hasText:"no podrás asistir"}).waitFor();
  await page.goto(`${base}?form&submit&unnamed`);
  await page.getByRole("checkbox",{name:"Acompañante 2",exact:true}).check();
  await page.getByLabel("Nombre del acompañante 2 (opcional)",{exact:true}).fill("Acompañante de prueba");
  await page.getByRole("button",{name:"Asistir",exact:true}).click();
  await page.locator("#result").filter({hasText:"Tu respuesta se ha guardado"}).waitFor();
  assert.equal(await page.locator("[data-companion-row]").nth(1).getAttribute("data-companion-id"),"created-1");
  await page.goto(`${base}?form&submit&unnamed&optional-names`);
  await page.getByRole("checkbox",{name:"Acompañante 1",exact:true}).check();
  await page.locator("[data-companion-row]").first().locator("summary").click();
  await page.getByLabel("Nombre del acompañante 1 (opcional)",{exact:true}).fill("Nombre elegido por el invitado");
  const optionalPost=page.waitForRequest("**/api/rsvp");
  await page.getByRole("button",{name:"Asistir",exact:true}).click();
  assert.equal((await optionalPost).postDataJSON().companions[0].full_name,"Nombre elegido por el invitado");
  await page.locator("#result").filter({hasText:"Tu respuesta se ha guardado"}).waitFor();
  await page.goto(`${base}?classic`);
  assert.match(await page.locator("[data-invitation-recipient]").textContent(),/Invitada de verificación/);
  assert.equal(await page.getByRole("button",{name:"Asistir",exact:true}).isVisible(),true);
  await page.goto(`${base}?form&solo`);
  assert.equal(await page.getByRole("checkbox").count(),0);
  await page.goto(`${base}?general`);
  await page.locator("summary").click();
  assert.equal(await page.locator("[name=code], #rsvpForm").count(),0);
  assert.equal(await page.locator("[data-personal-link-required]").count(),1);

  await context.addInitScript(() => Object.defineProperty(navigator,"clipboard",{value:{writeText:async value=>{window.__copiedInvitation=value;}}}));
  await page.goto(`${base}?guests`);
  for (const width of [390,1440]) {
    await page.setViewportSize({width,height:900});
    const rows = page.locator("[data-guest-row]");
    assert.equal(await rows.count(),3);
    const copied=[];
    for (let i=0;i<3;i++) {
      assert.equal(await rows.nth(i).locator("details").getAttribute("open"),null);
      await rows.nth(i).getByRole("button",{name:"Copiar invitación",exact:true}).click();
      await rows.nth(i).getByRole("status").filter({hasText:"Enlace copiado"}).waitFor();
      const url = new URL(await page.evaluate(()=>window.__copiedInvitation));
      assert.equal(url.pathname,"/i/visual-test");
      assert.equal(url.searchParams.get("code"),["personal-one","personal-two","legacy-personal"][i]);
      copied.push(url.href);
    }
    assert.notEqual(copied[0],copied[1]);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await screenshot(page,`personal-guest-list-${width}`);
  }
  await page.goto(`${base}?guests&legacy-only`);
  assert.equal(await page.locator("[data-copy-url]").count(),0);
  await page.getByRole("button",{name:"Copiar invitación",exact:true}).click();
  await page.locator(".copy-status").filter({hasText:"Enlace copiado"}).waitFor();
  assert.equal(new URL(await page.evaluate(()=>window.__copiedInvitation)).searchParams.get("code"),"legacy-personal");
  await page.goto(`${base}?empty`);
  await page.locator("summary").click();
  await page.locator(".floral-hero h1").waitFor({ state: "visible" });
  assert.equal(await page.locator(".floral-gifts, .floral-itinerary, .floral-dress, .floral-calendar-section, .floral-couple-photo").count(), 0);
  assert.equal(await page.locator(".floral-portrait-initials").count(), 1);
  const nojs = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  await nojs.goto(base);
  await nojs.locator("summary").click();
  assert.equal(await nojs.locator(".floral-hero").isVisible(), true);
  const reduced = await browser.newPage({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  await reduced.goto(base);
  await reduced.locator("summary").click();
  await reduced.locator(".floral-hero h1").waitFor({ state: "visible" });
  assert.deepEqual(errors, []);
  console.log("PASS companions, personal code, preview isolation, mocked submission, empty content, no-JS, reduced motion, browser errors and optional WCAG AA");
} finally {
  try { await browser?.close(); } finally { await unlink(route); }
}
