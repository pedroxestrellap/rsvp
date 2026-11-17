import assert from "node:assert/strict";

// Optional browser tooling is supplied externally; the application gains no dependency.
export async function browserChecks({ origin, path, slug, weddingId, cookies, code }) {
  const { chromium } = await import(process.env.RSVP_PLAYWRIGHT_MODULE);
  const browser = await chromium.launch({ executablePath: process.env.RSVP_BROWSER_EXECUTABLE, headless: true });
  const failures = [];
  const screenshots = process.env.RSVP_SCREENSHOTS;
  const screenshot = async (page, name) => {
    if (screenshots) await page.screenshot({ path: `${screenshots}/rsvp-${name}.png`, fullPage: true });
  };
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    await context.addCookies([...cookies].filter(([, value]) => value).map(([name, value]) => ({ name, value, url: origin })));
    const page = await context.newPage();
    page.on("pageerror", error => failures.push(error.message));
    const library = `/weddings/${weddingId}/templates`;
    await page.goto(`${origin}${library}`);
    assert.equal(await page.locator("[data-template-card]").count(), 3);
    assert.equal(await page.locator(".invitation-shell").count(), 0);
    await screenshot(page, "template-library-desktop");
    await page.setViewportSize({ width: 390, height: 844 });
    await screenshot(page, "template-library-mobile");

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}/i/${slug}?code=${code}`);
      await page.locator(".envelope-stage").waitFor({ state: "visible" });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `El sobre debe caber a ${width}px`);
      if (width === 390) await screenshot(page, "floral-envelope-mobile");
      await page.locator(".envelope-stage").click();
      await page.locator(".floral-hero h1").waitFor({ state: "visible" });
      assert.ok(await page.getByRole("button", { name: "No asistir", exact: true }).isVisible());
      assert.match(await page.locator("[data-invitation-recipient]").textContent(), /Invitado editado/);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `La invitación debe caber a ${width}px`);
      if ([390, 1440].includes(width)) await screenshot(page, `floral-invitation-${width}`);
    }

    await page.goto(`${origin}${library}/preview/floral_romance?screen=rsvp`);
    let apiRequests = 0;
    const watchRequest = request => { if (request.url().endsWith("/api/rsvp")) apiRequests++; };
    page.on("request", watchRequest);
    await page.getByRole("button",{name:"Asistir",exact:true}).click();
    await page.locator("#result").filter({ hasText: "No se ha guardado" }).waitFor();
    assert.equal(apiRequests, 0, "Una vista previa no debe enviar respuestas reales");
    page.off("request", watchRequest);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}${path}`);
    assert.equal(await page.locator(".invitation-shell").count(), 0);
    const originalRow = page.locator("[data-guest-row]").filter({ has: page.getByRole("heading", { name: "Invitado editado", exact: true }) });
    assert.equal(await originalRow.locator("details").getAttribute("open"), null);
    await originalRow.locator("summary").click();
    assert.ok(await originalRow.getByLabel("Nombre completo", { exact: true }).isVisible());
    await originalRow.locator("summary").click();
    await page.getByRole("button",{name:"Agregar invitado",exact:true}).click();
    const create = page.getByRole("dialog",{name:"Agregar invitado",exact:true});
    await create.getByLabel("Nombre completo", { exact: true }).fill("Lucía sin acompañantes");
    await Promise.all([page.waitForEvent("framenavigated", frame => frame === page.mainFrame()), create.getByRole("button", { name: "Crear invitado", exact: true }).click()]);
    await page.waitForLoadState("domcontentloaded");
    assert.deepEqual(await page.getByRole("alert").allTextContents(), [], "La creación desde el formulario no debe producir errores");
    assert.equal(new URL(page.url()).searchParams.get("saved"), "1");

    const search = page.getByLabel("Buscar invitados", { exact: true });
    await search.fill("acompanante editado");
    assert.equal(await page.locator("[data-guest-row]:visible").count(), 1);
    await page.locator("[data-guest-status]").selectOption("declined");
    assert.equal(await page.locator("[data-guest-row]:visible").count(), 1);
    await page.locator("[data-guest-status]").selectOption("pending");
    assert.equal(await page.locator("[data-guest-row]:visible").count(), 0);
    assert.ok(await page.locator("[data-guest-empty]").isVisible());
    await search.fill("");
    await page.locator("[data-guest-status]").selectOption("all");
    await page.locator("[data-guest-companions]").selectOption("without");
    assert.equal(await page.locator("[data-guest-row]:visible").count(), 1);
    await search.fill("lucia");
    const row = page.locator("[data-guest-row]:visible");
    await row.locator("summary").click();
    await row.getByLabel("Nombre completo", { exact: true }).fill("Lucía actualizada");
    await Promise.all([page.waitForEvent("framenavigated", frame => frame === page.mainFrame()), row.getByRole("button", { name: "Guardar invitado", exact: true }).click()]);
    await page.getByRole("heading", { name: "Lucía actualizada", exact: true }).waitFor();
    assert.equal(await page.getByLabel("Buscar invitados", { exact: true }).inputValue(), "lucia");
    assert.equal(await page.locator("[data-guest-companions]").inputValue(), "without");
    await screenshot(page, "couple-guest-list-mobile");
    await page.getByRole("tab", { name: "Información de la boda", exact: true }).click();
    await page.getByLabel("Nombre de uno de los novios", { exact: true }).fill("Cambio sin guardar");
    await page.getByRole("tab", { name: "Formulario RSVP", exact: true }).click();
    await page.getByRole("tab", { name: "Información de la boda", exact: true }).click();
    assert.equal(await page.getByLabel("Nombre de uno de los novios", { exact: true }).inputValue(), "Cambio sin guardar");

    await page.goto(`${origin}${path}`);
    const createdRow = page.locator("[data-guest-row]").filter({ has: page.getByRole("heading", { name: "Lucía actualizada", exact: true }) });
    await createdRow.locator("summary").click();
    page.once("dialog", dialog => dialog.accept());
    await Promise.all([page.waitForEvent("framenavigated", frame => frame === page.mainFrame()), createdRow.getByRole("button", { name: "Eliminar invitado", exact: true }).click()]);
    await page.locator("[data-guest-row]").first().waitFor();

    await page.goto(`${origin}/i/${slug}/rsvp?code=${code}&status=declined`);
    assert.equal(await page.locator("input[name=status]").inputValue(), "declined");
    await page.getByRole("button", { name: "No asistir", exact:true }).click();
    await page.locator("#result").filter({ hasText: "no podrás asistir" }).waitFor();
    await screenshot(page, "floral-rsvp-mobile");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    assert.deepEqual(failures, [], "No debe haber errores JavaScript en las vistas");
    console.log("OK navegador: biblioteca, sobre, invitación a 320/390/768/1440px, filtros, edición, persistencia de pestañas y RSVP sin asistencia.");
    await context.close();
  } finally { await browser.close(); }
}
