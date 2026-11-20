// Disposable development fixture: exercises the real guest action service with an in-memory DB.
import assert from "node:assert/strict";
import {readFile,writeFile,unlink} from "node:fs/promises";
import {createRequire} from "node:module";
const {unzipSync}=createRequire(import.meta.resolve("write-excel-file/node"))("fflate");
if(!process.env.RSVP_PLAYWRIGHT_MODULE)throw new Error("Configura RSVP_PLAYWRIGHT_MODULE.");
const {chromium}=await import(process.env.RSVP_PLAYWRIGHT_MODULE);
const AxeBuilder=process.env.RSVP_AXE_MODULE?(await import(process.env.RSVP_AXE_MODULE)).default:null;
const origin=process.env.RSVP_TEST_ORIGIN || "http://localhost:4321";
const base=`${origin}/admin-visual-check`;
const route=new URL("../src/pages/admin-visual-check.astro",import.meta.url);
await writeFile(route,await readFile(new URL("./fixtures/admin-preview.astro",import.meta.url),"utf8"),{flag:"wx"});
let browser;
const errors=[];
const screenshot=async(page,name,fullPage=true)=>{if(process.env.RSVP_SCREENSHOTS){if(fullPage)await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${process.env.RSVP_SCREENSHOTS}/admin-${name}.png`,fullPage});}};
try{
  browser=await chromium.launch({executablePath:process.env.RSVP_BROWSER_EXECUTABLE,headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(()=>{
    Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async text=>{window.__copiedInvitation=text;}}});
    Object.defineProperty(navigator,"share",{configurable:true,value:undefined});
  });
  const page=await context.newPage();page.on("pageerror",error=>errors.push(error.message));
  const goto=async url=>{await page.goto(url,{waitUntil:"networkidle"});await page.addStyleTag({content:"astro-dev-toolbar{display:none!important}"});await page.evaluate(()=>document.fonts.ready);};
  const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"No horizontal overflow");
  const downloadExcel=async()=>{
    const downloading=page.waitForEvent("download");
    await page.getByRole("button",{name:"Exportar a Excel",exact:true}).click();
    const download=await downloading;
    assert.equal(download.suggestedFilename(),"invitados-elena-gabriel.xlsx");
    assert.equal(await download.failure(),null);
    const files=unzipSync(new Uint8Array(await readFile(await download.path())));
    assert.ok(files["[Content_Types].xml"],"Download is an actual XLSX archive");
    const decode=name=>files[name]?new TextDecoder().decode(files[name]):"";
    const data=await page.evaluate(({sheet,strings})=>{
      const parser=new DOMParser();
      const shared=[...parser.parseFromString(strings,"application/xml").getElementsByTagName("si")].map(cell=>cell.textContent);
      return [...parser.parseFromString(sheet,"application/xml").getElementsByTagName("row")].map(row=>{
        const values=Array(10).fill(null);
        for(const cell of row.getElementsByTagName("c")){
          const column=cell.getAttribute("r").match(/[A-Z]+/)[0].split("").reduce((total,letter)=>total*26+letter.charCodeAt(0)-64,0)-1;
          const value=cell.getElementsByTagName("v")[0]?.textContent;
          const type=cell.getAttribute("t");
          values[column]=type==="s"?shared[Number(value)]:type==="inlineStr"?cell.textContent:value===undefined?null:Number(value);
          if(cell.getElementsByTagName("f").length)throw new Error("Guest text must not become a formula");
        }
        return values;
      });
    },{sheet:decode("xl/worksheets/sheet1.xml"),strings:decode("xl/sharedStrings.xml")});
    await page.locator("[data-guest-action-status]").filter({hasText:"Excel descargado"}).waitFor();
    assert.equal(await page.getByRole("button",{name:"Exportar a Excel",exact:true}).isEnabled(),true);
    return data;
  };
  const axe=async()=>{
    if(!AxeBuilder)return;
    const result=await new AxeBuilder({page}).exclude("astro-dev-toolbar").withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
    assert.deepEqual(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(node=>({target:node.target,summary:node.failureSummary}))})),[]);
  };
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:950});
    await goto(`${base}?reset=1`);
    await noOverflow();
    assert.equal(await page.locator("[data-guest-row]").count(),4);
    assert.equal(await page.getByRole("button",{name:"Agregar invitado",exact:true}).isVisible(),true);
    assert.equal(await page.getByRole("button",{name:"Exportar a Excel",exact:true}).isVisible(),true);
    await screenshot(page,`guests-${width}`);
    if(width===390 || width===1440)await axe();
    await page.getByRole("button",{name:"Agregar invitado",exact:true}).click();
    const modal=page.getByRole("dialog",{name:"Agregar invitado",exact:true});
    assert.ok(await modal.isVisible());
    assert.equal(await modal.locator('[name="companions"]').count(),0,"Creation has dynamic companion fields, not a numeric count");
    assert.equal(await modal.locator('[name="full_name"]').evaluate(input=>input===document.activeElement),true);
    await modal.getByRole("button",{name:"Agregar acompañante",exact:true}).click();
    await modal.getByRole("button",{name:"Agregar acompañante",exact:true}).click();
    assert.equal(await modal.locator('[name="companion_names"]').count(),2);
    await modal.getByRole("button",{name:"Quitar acompañante 1",exact:true}).click();
    assert.equal(await modal.locator('[name="companion_names"]').count(),1);
    assert.equal(await modal.getByLabel("Acompañante 1",{exact:true}).count(),1);
    await noOverflow();
    await screenshot(page,`create-modal-${width}`,false);
    if(width===390 || width===1440)await axe();
    await page.keyboard.press("Escape");
    assert.equal(await modal.isVisible(),false);
    assert.equal(await page.getByRole("button",{name:"Agregar invitado",exact:true}).evaluate(button=>button===document.activeElement),true);
    if(width<1024){
      await page.getByRole("button",{name:"Abrir menú",exact:true}).click();
      assert.equal(await page.getByRole("dialog",{name:"Wedding Suite",exact:true}).isVisible(),true);
      await page.keyboard.press("Escape");
    }
    await goto(`${base}?screen=dashboard`);
    assert.equal(await page.locator(".planner-wedding-card").count(),4);
    await noOverflow();
    await screenshot(page,`dashboard-${width}`);
    if(width===390 || width===1440)await axe();
    await page.getByRole("button",{name:"Borradores · 2",exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll(".planner-wedding-card").length===2);
    assert.deepEqual(await page.locator(".planner-wedding-card h3").allTextContents(),["María & Sebastián","Julia & Daniel"]);
    console.log(`PASS dashboard, guest panel, modal, companions, keyboard and responsive layout: ${width}px`);
  }
  // Supply fixture wedding data for the authenticated entry page, while following
  // the real sidebar URLs and rendering the production section picker component.
  await page.route("**/weddings?section=*",async route=>{
    const section=new URL(route.request().url()).searchParams.get("section");
    const response=await page.request.get(`${base}?screen=picker&section=${section}`);
    await route.fulfill({response});
  });
  for(const width of [390,1440]){
    await page.setViewportSize({width,height:950});
    await goto(`${base}?screen=dashboard`);
    for(const [label,section] of [["Invitados","guests"],["Templates","templates"]]){
      const menu=width<1024?page.locator("[data-admin-menu]"):page.locator(".admin-desktop-sidebar");
      if(width<1024)await page.getByRole("button",{name:"Abrir menú",exact:true}).click();
      await menu.getByRole("link",{name:label,exact:true}).click();
      await page.getByRole("heading",{name:label,exact:true}).waitFor();
      assert.equal(new URL(page.url()).pathname,"/weddings");
      assert.equal(new URL(page.url()).searchParams.get("section"),section);
      assert.equal(await menu.getByRole("link",{name:label,exact:true,includeHidden:true}).getAttribute("aria-current"),"page");
      if(section==="guests"){
        assert.deepEqual(await page.locator("[data-wedding-section-destination]").evaluateAll(links=>links.map(link=>new URL(link.href).pathname)),["w1","w2","w3","w4"].map(id=>`/weddings/${id}/guests`));
      }else{
        assert.equal(await page.locator("[data-wedding-section-destination]").count(),0);
        assert.deepEqual(await page.locator("[data-template-card] h3").allTextContents(),["Clásico","Floral Romance","Seda & Promesas"]);
        assert.deepEqual(await page.locator("[data-template-card] img").evaluateAll(images=>images.filter(image=>!image.complete || !image.naturalWidth).map(image=>image.src)),[]);
      }
      await noOverflow();
      await screenshot(page,`${section}-navigation-${width}`);
    }
    await axe();
    const template=page.locator('[data-template-card="seda_promesas"]');
    await template.getByRole("button",{name:"Ampliar diseño",exact:true}).click();
    const zoom=page.getByRole("dialog",{name:"Seda & Promesas",exact:true});
    assert.equal(await zoom.isVisible(),true);
    assert.ok(await zoom.locator("img").evaluate(image=>image.complete && image.naturalWidth>0));
    await noOverflow();
    await page.keyboard.press("Escape");
    await template.getByRole("button",{name:"Usar template",exact:true}).click();
    const apply=page.getByRole("dialog",{name:"Usar template",exact:true});
    assert.equal(await apply.getByRole("button",{name:"Usar template",exact:true}).isDisabled(),true);
    await apply.getByLabel("Boda",{exact:true}).selectOption("w1");
    assert.equal(await apply.getByRole("link",{name:"Vista previa en esta boda",exact:true}).getAttribute("href"),"/weddings/w1/templates/preview/seda_promesas");
    assert.equal(await apply.locator("form").evaluate(form=>new URL(form.action).pathname),"/weddings/w1/templates");
    assert.equal(await apply.locator('[name="theme_id"]').inputValue(),"seda_promesas");
    await axe();
    await screenshot(page,`apply-template-${width}`,false);
    // Applying reuses the existing authenticated per-wedding endpoint.
    await page.route("**/weddings/w1/templates",async route=>{
      assert.equal(route.request().method(),"POST");
      const fields=new URLSearchParams(route.request().postData());
      assert.equal(fields.get("theme_id"),"seda_promesas");
      assert.equal(fields.get("wedding_id"),"w1");
      await route.fulfill({status:303,headers:{Location:`${base}?screen=picker&section=templates&saved=1`}});
    });
    const applied=page.waitForURL(url=>url.pathname==="/admin-visual-check" && url.searchParams.get("saved")==="1");
    await apply.getByRole("button",{name:"Usar template",exact:true}).click();
    await applied;
    await page.unroute("**/weddings/w1/templates");
  }
  for(const variant of ["single-wedding","no-weddings"]){
    await goto(`${base}?screen=picker&section=templates&${variant}`);
    assert.equal(await page.locator("[data-template-card]").count(),3);
    await page.locator('[data-template-card="seda_promesas"]').getByRole("button",{name:"Usar template",exact:true}).click();
    const apply=page.getByRole("dialog",{name:"Usar template",exact:true});
    if(variant==="single-wedding"){
      assert.equal(await apply.getByLabel("Boda",{exact:true}).inputValue(),"w1");
      assert.equal(await apply.getByRole("button",{name:"Usar template",exact:true}).isEnabled(),true);
    }else{
      assert.equal(await apply.getByRole("link",{name:"Crear primera boda",exact:true}).getAttribute("href"),"/weddings#new-wedding");
      assert.equal(await apply.locator("form").count(),0);
    }
    await page.keyboard.press("Escape");
  }
  console.log("PASS guest navigation and direct template catalogue with thumbnails, zoom, wedding selection and existing application endpoint on mobile and desktop");
  await page.setViewportSize({width:390,height:900});
  await goto(`${base}?reset=1`);
  const fullExport=await downloadExcel();
  assert.deepEqual(fullExport[0],["Nombre","Tipo","Invitado principal","Teléfono","Email","Estado RSVP","Cupo de la invitación","Personas confirmadas (grupo)","Restricciones alimentarias","Mensaje para los novios"]);
  assert.deepEqual(fullExport.slice(1).map(row=>row[0]),["Camila Rosario","Andrés Rosario","Mateo Hernández","Lucía de la Cruz","Rafael Martínez"]);
  assert.equal(fullExport[1][3],"+18095550123","Phone retains its plus sign and text type");
  assert.equal(fullExport[1][7],2);
  assert.deepEqual(fullExport[2].slice(1,3),["Acompañante","Camila Rosario"]);
  assert.equal(fullExport[2][6],null);
  assert.equal(fullExport[2][7],null,"Companions do not duplicate the group's confirmed total");
  await page.getByLabel("Buscar invitados",{exact:true}).fill("Andrés");
  const filteredExport=await downloadExcel();
  assert.deepEqual(filteredExport.slice(1).map(row=>row[0]),["Camila Rosario","Andrés Rosario"]);
  await page.getByLabel("Buscar invitados",{exact:true}).fill("no existe esta persona");
  assert.equal(await page.getByRole("button",{name:"Exportar a Excel",exact:true}).isDisabled(),true);
  await page.getByLabel("Buscar invitados",{exact:true}).fill("");
  await page.locator("[data-guest-status]").selectOption("declined");
  const declinedExport=await downloadExcel();
  assert.equal(declinedExport.length,2);
  assert.deepEqual(declinedExport[1].slice(5,8),["No asiste",2,0]);
  await page.locator("[data-guest-status]").selectOption("all");
  console.log("PASS actual XLSX download, accented names, text phones, companions, group totals, active filters and empty results");
  await page.getByRole("button",{name:"Agregar invitado",exact:true}).click();
  let modal=page.getByRole("dialog",{name:"Agregar invitado",exact:true});
  let posts=0;const watch=request=>{if(request.method()==="POST" && request.url().includes("admin-visual-check"))posts++;};page.on("request",watch);
  await modal.getByRole("button",{name:"Crear invitado",exact:true}).click();
  assert.equal(await modal.locator('[name="full_name"]').getAttribute("aria-invalid"),"true");
  await modal.locator('[name="full_name"]').fill("Sofía Méndez");
  await modal.locator('[name="email"]').fill("correo-invalido");
  await modal.locator('[name="phone"]').fill("no-es-un-telefono");
  await modal.getByRole("button",{name:"Crear invitado",exact:true}).click();
  assert.equal(await modal.locator('[name="email"]').getAttribute("aria-invalid"),"true");
  assert.equal(await modal.locator('[name="phone"]').getAttribute("aria-invalid"),"true");
  assert.equal(posts,0);
  await modal.locator('[name="email"]').fill("sofia@EXAMPLE.COM");
  await modal.locator('[name="phone"]').fill("8095550123");
  await modal.locator('[name="phone"]').press("Tab");
  assert.equal(await modal.locator('[name="phone"]').inputValue(),"809 555 0123");
  await modal.getByRole("button",{name:"Agregar acompañante",exact:true}).click();
  await modal.getByRole("button",{name:"Agregar acompañante",exact:true}).click();
  await modal.getByLabel("Acompañante 1",{exact:true}).fill("Pedro Méndez");
  await modal.getByRole("button",{name:"Crear invitado",exact:true}).click();
  assert.equal(await modal.locator("[data-empty-companions-warning]").isVisible(),true);
  assert.match(await modal.locator("[data-empty-companions-message]").textContent(),/completar el nombre al confirmar/);
  assert.equal(posts,0);
  await screenshot(page,"unnamed-companion-warning-mobile",false);
  await modal.getByRole("button",{name:"Completar nombres",exact:true}).click();
  assert.equal(await modal.getByLabel("Acompañante 2",{exact:true}).evaluate(input=>input===document.activeElement),true);
  await modal.getByRole("button",{name:"Crear invitado",exact:true}).click();
  await modal.getByRole("button",{name:"Crear de todas formas",exact:true}).click();
  await page.getByRole("heading",{name:"Sofía Méndez",exact:true}).waitFor();
  await page.waitForLoadState("networkidle");
  await page.evaluate(()=>document.fonts.ready);
  await page.addStyleTag({content:"astro-dev-toolbar{display:none!important}"});
  assert.equal(posts,1,"Only one invitation is created after acknowledgement");
  const created=page.locator("[data-guest-row]").filter({has:page.getByRole("heading",{name:"Sofía Méndez",exact:true})});
  assert.match(await created.textContent(),/3 lugares reservados · 1 acompañante con nombre/);
  await created.locator("summary").click();
  assert.equal(await created.locator('[data-guest-edit-form] [name="email"]').inputValue(),"sofia@example.com");
  assert.equal(await created.locator('[data-guest-edit-form] [name="phone"]').inputValue(),"+18095550123");
  assert.equal(await created.getByLabel("Nombre del acompañante",{exact:true}).inputValue(),"Pedro Méndez");
  await created.locator("summary").click();

  const camila=page.locator('[data-guest-id="guest-one"]');
  await camila.getByRole("button",{name:"Compartir",exact:true}).click();
  const share=page.getByRole("dialog",{name:"Compartir invitación",exact:true});
  assert.equal(await share.isVisible(),true);
  assert.match(await share.getByLabel("Mensaje de invitación").inputValue(),/personal-camila/);
  assert.match(await share.getByRole("link",{name:"Enviar por WhatsApp",exact:true}).getAttribute("href"),/wa\.me\/18095550123/);
  assert.match(await share.getByRole("link",{name:"Enviar por email",exact:true}).getAttribute("href"),/^mailto:camila@example.com/);
  await share.getByRole("button",{name:"Copiar mensaje",exact:true}).click();
  assert.match(await page.evaluate(()=>window.__copiedInvitation),/Camila Rosario/);
  await screenshot(page,"share-mobile",false);
  await page.keyboard.press("Escape");
  await page.evaluate(()=>Object.defineProperty(navigator,"share",{configurable:true,value:async data=>{window.__sharedInvitation=data;}}));
  await page.locator('[data-guest-id="guest-two"]').getByRole("button",{name:"Compartir",exact:true}).click();
  await page.waitForFunction(()=>Boolean(window.__sharedInvitation));
  assert.match((await page.evaluate(()=>window.__sharedInvitation)).text,/personal-mateo/);

  await camila.getByRole("checkbox",{name:"Seleccionar a Camila Rosario",exact:true}).check();
  await created.getByRole("checkbox",{name:"Seleccionar a Sofía Méndez",exact:true}).check();
  await page.getByRole("button",{name:"Copiar enlaces",exact:true}).click();
  await page.locator("[data-guest-action-status]").filter({hasText:"Invitaciones copiadas"}).waitFor();
  let copied=await page.evaluate(()=>window.__copiedInvitation);
  assert.match(copied,/Camila Rosario/);assert.match(copied,/Sofía Méndez/);assert.ok(!copied.includes("Mateo Hernández"));
  await page.getByLabel("Buscar invitados",{exact:true}).fill("Mateo");
  assert.match(await page.locator("[data-selection-count]").textContent(),/2 fuera del filtro/);
  await page.getByRole("button",{name:/Seleccionar toda la lista/}).click();
  assert.match(await page.locator("[data-selection-count]").textContent(),/5 invitados seleccionados/);
  await page.getByRole("button",{name:"Copiar enlaces",exact:true}).click();
  await page.locator("[data-guest-action-status]").filter({hasText:"Invitaciones copiadas: 5"}).waitFor();
  copied=await page.evaluate(()=>window.__copiedInvitation);
  assert.equal((copied.match(/\/i\/elena-gabriel\?code=/g)||[]).length,5);
  assert.equal(new Set(copied.split("\n").filter(line=>line.startsWith("http"))).size,5);
  assert.equal(await page.locator('[data-guest-id="guest-legacy"] [data-copy-url]').count(),1,"Bulk copy generates legacy personal links");
  await page.locator("[data-bulk-share]").click();
  assert.equal(await share.isVisible(),true);
  assert.match(await share.locator("[data-share-description]").textContent(),/5 invitaciones/);
  await page.keyboard.press("Escape");
  await page.getByLabel("Buscar invitados",{exact:true}).fill("");
  assert.equal(await page.locator("[data-select-visible]").isChecked(),true);
  await screenshot(page,"bulk-selected-mobile");
  await page.setViewportSize({width:1440,height:1000});await screenshot(page,"bulk-selected-desktop");
  await page.getByRole("button",{name:"Limpiar selección",exact:true}).click();
  assert.equal(await page.locator("[data-bulk-actions]").isVisible(),false);
  assert.equal(await page.locator("[data-select-guest]:checked").count(),0);
  await noOverflow();assert.deepEqual(errors,[]);
  console.log("PASS contact validation, phone formatting, empty companion warning, atomic creation, native/fallback sharing, filtered selection and bulk link generation");
}catch(error){
  const page=browser?.contexts()[0]?.pages()[0];
  if(page)await screenshot(page,"failure",false);
  console.log("Browser errors:",errors);
  throw error;
}finally{try{await browser?.close();}finally{await unlink(route);}}
