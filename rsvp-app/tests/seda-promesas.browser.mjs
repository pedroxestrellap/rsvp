// Runs against a temporary DEV-only fixture; no Supabase writes or extra app dependencies.
import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
if (!process.env.RSVP_PLAYWRIGHT_MODULE) throw new Error("Configura RSVP_PLAYWRIGHT_MODULE.");
const { chromium } = await import(process.env.RSVP_PLAYWRIGHT_MODULE);
const AxeBuilder = process.env.RSVP_AXE_MODULE ? (await import(process.env.RSVP_AXE_MODULE)).default : null;
const origin = process.env.RSVP_TEST_ORIGIN || "http://localhost:4321";
const base = `${origin}/floral-visual-check?template=seda_promesas`;
const route = new URL("../src/pages/floral-visual-check.astro", import.meta.url);
await writeFile(route, await readFile(new URL("./fixtures/floral-preview.astro", import.meta.url), "utf8"), { flag: "wx" });
let browser;
const errors = [];
const capture = async (locator, name, fullPage = false) => {
  if (process.env.RSVP_SCREENSHOTS) await locator.screenshot({path:`${process.env.RSVP_SCREENSHOTS}/seda-${name}.png`, ...(fullPage ? {fullPage:true} : {})});
};
try {
  browser = await chromium.launch({executablePath:process.env.RSVP_BROWSER_EXECUTABLE,headless:true});
  const context = await browser.newContext({viewport:{width:390,height:844}});
  const page = await context.newPage();
  page.on("pageerror",error=>errors.push(error.message));
  const goto = async url => {
    await page.goto(url,{waitUntil:"networkidle"});
    await page.addStyleTag({content:"astro-dev-toolbar { display:none !important; }"});
    await page.evaluate(()=>document.fonts.ready);
  };
  const letteringInsideHeart = () => page.locator('.seda-heart').evaluate(heart=>{
    const paper=heart.querySelector('.seda-heart-paper');
    const intoPaper=paper.getScreenCTM().inverse();
    const context=document.createElement('canvas').getContext('2d');
    context.textAlign='center';
    return [...heart.querySelectorAll('[data-heart-text]')].every(text=>{
      const style=getComputedStyle(text);
      context.font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const ink=context.measureText(text.textContent);
      const box={x:Number(text.getAttribute('x'))-ink.actualBoundingBoxLeft,y:Number(text.getAttribute('y'))-ink.actualBoundingBoxAscent,
        width:ink.actualBoundingBoxLeft+ink.actualBoundingBoxRight,height:ink.actualBoundingBoxAscent+ink.actualBoundingBoxDescent};
      const intoScreen=text.getScreenCTM();
      return [0,.5,1].every(x=>[0,.5,1].every(y=>{
        const point=new DOMPoint(box.x+box.width*x,box.y+box.height*y).matrixTransform(intoScreen).matrixTransform(intoPaper);
        return paper.isPointInFill(point);
      }));
    });
  });
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:900});
    await goto(`${base}&reference`);
    assert.equal(await page.locator('.invitation-shell').getAttribute('data-template'),'seda_promesas');
    assert.match(await page.locator('[data-invitation-recipient]').textContent(),/Invitada de verificación/);
    assert.equal(await page.locator('.seda-heart h1').isVisible(),true);
    assert.ok(await letteringInsideHeart(),`Names and date stay within the actual heart outline at ${width}px`);
    assert.equal(await page.locator('.invitation-shell h1').count(),1);
    assert.equal(await page.locator('.seda-calendar-selected').textContent(),'29');
    assert.equal(await page.locator('.seda-calendar-selected').evaluate(el=>el.closest('td').cellIndex),1);
    assert.equal(await page.locator('.seda-frame-oval').count(),1);
    assert.equal(await page.locator('.seda-program li').count(),3);
    assert.equal(await page.getByRole('button',{name:'Asistir',exact:true}).count(),1);
    assert.equal(await page.getByRole('button',{name:'No asistir',exact:true}).count(),1);
    assert.equal(await page.locator('input[name=code]').count(),0);
    assert.deepEqual(await page.locator('img').evaluateAll(els=>els.filter(el=>!el.complete||!el.naturalWidth).map(el=>el.src)),[]);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow ${width}px`);
    const palette = await page.locator('.invitation-shell').evaluate(el=>{
      const css=getComputedStyle(el);
      return ['butter','sage','blue','lavender','pink','ivory','paper','text','muted'].map(name=>css.getPropertyValue(`--wedding-${name}`).trim());
    });
    assert.deepEqual(palette,['#FAEDA1','#ABBD98','#8AACCA','#A79DBB','#F6CFD3','#FFF9F0','#FFFCF6','#343B32','#77766E']);
    if ([390,1440].includes(width)) {
      await capture(page,`invitation-${width}`,true);
      for (const section of ['cover','welcome-calendar','location','program','rsvp','footer']) {
        await capture(page.locator(`[data-seda-section="${section}"]`),`${section}-${width}`);
      }
    }
    console.log(`PASS Seda & Promesas: heart, lace, real leap-day calendar, ornamental frames, personal RSVP, palette and layout at ${width}px`);
  }
  await page.setViewportSize({width:390,height:844});
  if (AxeBuilder) {
    const results=await new AxeBuilder({page}).exclude('astro-dev-toolbar').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.deepEqual(results.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),[]);
  }
  const readClock = () => page.locator('[data-countdown-value]').evaluateAll(els=>els.map(el=>Number(el.textContent)).reduce((sum,value,i)=>sum+value*[86400,3600,60,1][i],0));
  const before=await readClock();
  await page.waitForTimeout(1250);
  assert.ok(await readClock()<before,'Countdown ticks toward the actual wedding date');
  await page.getByRole('checkbox',{name:'Segundo acompañante',exact:true}).check();
  let requests=0;
  await page.route('**/api/rsvp',async route=>{requests++;await route.fulfill({json:{ok:true}});});
  await page.getByRole('button',{name:'Asistir',exact:true}).click();
  assert.match(await page.locator('#result').textContent(),/No se ha guardado/);
  assert.equal(requests,0);

  await goto(`${base}&reference&submit`);
  await page.getByRole('checkbox',{name:'Segundo acompañante',exact:true}).check();
  const post=page.waitForRequest('**/api/rsvp');
  await page.getByRole('button',{name:'Asistir',exact:true}).click();
  const payload=(await post).postDataJSON();
  assert.equal(payload.invite_code,'local-check');
  assert.equal(payload.status,'confirmed');
  assert.equal(payload.seats_confirmed,2);
  assert.deepEqual(payload.companions.map(c=>[c.id,c.attending]),[['companion-one',false],['companion-two',true]]);
  await page.locator('#result').filter({hasText:'Tu respuesta se ha guardado'}).waitFor();
  const decline=page.waitForRequest('**/api/rsvp');
  await page.getByRole('button',{name:'No asistir',exact:true}).click();
  assert.equal((await decline).postDataJSON().seats_confirmed,0);
  await page.locator('#result').filter({hasText:'no podrás asistir'}).waitFor();

  for (const width of [320,1440]) {
    await page.setViewportSize({width,height:900});
    await goto(`${base}&long`);
    assert.equal(await page.locator('.seda-program li').count(),12);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.equal(await page.locator('.seda-heart-long-names').count(),1);
    assert.match(await page.locator('.seda-heart h1').textContent(),/María Alejandra de la Cruz/);
    assert.ok(await letteringInsideHeart(),'Long names and date stay within the actual heart outline');
    await capture(page.locator('.seda-heart'),`heart-long-${width}`);
    await capture(page.locator('.seda-program'),`program-long-${width}`);
    assert.equal(await page.locator('[data-seda-section=gifts]').count(),1);
    assert.equal(await page.locator('.seda-dress-colors li').count(),3);
  }
  await goto(`${base}&past&reference`);
  assert.deepEqual(await page.locator('[data-countdown-value]').allTextContents(),['00','00','00','00']);
  assert.match(await page.locator('[data-countdown-caption]').textContent(),/ha llegado/);
  await goto(`${base}&empty`);
  assert.equal(await page.locator('.seda-calendar, .seda-program, .seda-locations, [data-wedding-countdown]').count(),0);
  await goto(`${base}&general`);
  assert.equal(await page.locator('#rsvpForm, input[name=code]').count(),0);
  await goto(`${base}&form`);
  assert.equal(await page.getByRole('button',{name:'Asistir',exact:true}).isVisible(),true);
  if (AxeBuilder) {
    const results=await new AxeBuilder({page}).exclude('astro-dev-toolbar').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.deepEqual(results.violations.map(v=>v.id),[]);
  }
  await capture(page,'form-mobile',true);
  const nojs=await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:844}});
  await nojs.goto(`${base}&reference`);
  assert.equal(await nojs.locator('.seda-heart h1').isVisible(),true);
  assert.equal(await nojs.locator('.seda-program li').count(),3);
  assert.deepEqual(errors,[]);
  console.log('PASS personal RSVP payloads, preview isolation, live countdown, midnight/timezone handling, long itinerary, optional content, past/missing dates, standalone form, no-JS and optional WCAG AA');
} finally {
  try { await browser?.close(); } finally { await unlink(route); }
}
