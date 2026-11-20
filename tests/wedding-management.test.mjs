import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "vite";

const vite = await createServer({ cacheDir: "node_modules/.vite-tests", server: { middlewareMode: true, hmr: false }, appType: "custom" });
after(() => vite.close());
const { signCoupleToken, verifyCoupleToken } = await vite.ssrLoadModule("/src/lib/coupleToken.ts");
const { parseWeddingForm, getRsvpSettings } = await vite.ssrLoadModule("/src/lib/weddingSettings.ts");
const { handleGuestAction } = await vite.ssrLoadModule("/src/lib/guestManagementServer.ts");
const { submitRsvp, deadlinePassed } = await vite.ssrLoadModule("/src/lib/rsvpSubmissionServer.ts");
const { getInvitationGuest } = await vite.ssrLoadModule("/src/lib/invitationGuestServer.ts");
const { weddingTimestamp, countdownParts } = await vite.ssrLoadModule("/src/lib/weddingCountdown.ts");
const { updateWedding } = await vite.ssrLoadModule("/src/lib/weddingsServer.ts");
const { getWeddingTemplate, findWeddingTemplate } = await vite.ssrLoadModule("/src/lib/weddingTemplates.ts");
const { guestFilters, matchesGuest, normalizeGuestSearch } = await vite.ssrLoadModule("/src/lib/guestList.ts");
const { guestName, guestEmail, guestPhone, formatGuestPhone } = await vite.ssrLoadModule("/src/lib/guestForm.ts");
const { getDashboardStats } = await vite.ssrLoadModule("/src/lib/dashboardData.ts");
const { getDashboardPageData } = await vite.ssrLoadModule("/src/lib/dashboardPageData.ts");
const { weddingSection, weddingSectionPath, singleWeddingSectionPath } = await vite.ssrLoadModule("/src/lib/nav.ts");
const { guestExportRows, guestExportSheet } = await vite.ssrLoadModule("/src/lib/guestExport.ts");

const form = (values) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
};

// In-memory database with FK restrictions: exercises mutations and wedding scoping.
function database(seed = {}) {
  const tables = { weddings: [], guests: [], rsvps: [], ...structuredClone(seed) };
  const operations = [];
  return { tables, operations, from(table) {
    let action = "select", values, single = false;
    const filters = [];
    const query = {
      select() { return query; },
      eq(key, value) { filters.push(row => row[key] === value); return query; },
      in(key, values) { filters.push(row => values.includes(row[key])); return query; },
      gte(key,value) { filters.push(row=>row[key]>=value); return query; },
      limit() { return query; },
      order() { return query; },
      maybeSingle() { single = true; return query; },
      insert(value) { action = "insert"; values = value; return query; },
      update(value) { action = "update"; values = value; return query; },
      delete() { action = "delete"; return query; },
      upsert(value) { action = "upsert"; values = value; return query; },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          let rows = tables[table].filter(row => filters.every(filter => filter(row)));
          operations.push({ table, action });
          if (action === "insert") {
            const additions = (Array.isArray(values) ? values : [values]).map(row => ({ id: randomUUID(), ...row }));
            tables[table].push(...additions);
            rows = additions;
          } else if (action === "update") {
            rows.forEach(row => Object.assign(row, values));
          } else if (action === "delete") {
            if (table === "guests" && rows.some(row => tables.rsvps.some(r => r.guest_id === row.id)
              || tables.guests.some(g => g.primary_guest_id === row.id && !rows.includes(g)))) {
              return { data: null, error: { message: "Foreign key restriction" } };
            }
            tables[table] = tables[table].filter(row => !rows.includes(row));
          } else if (action === "upsert") {
            if (table === "rsvps" && values.seats_confirmed === null) {
              return { data: null, error: { code: "23502", message: "null value in column seats_confirmed violates not-null constraint" } };
            }
            const row = tables[table].find(row => row.guest_id === values.guest_id);
            if (row) Object.assign(row, values);
            else tables[table].push({ id: randomUUID(), ...values });
          }
          return { data: single ? rows[0] ?? null : rows, error: null };
        }).then(resolve, reject);
      },
    };
    return query;
  } };
}

test("couple links are signed and reject tampering, other secrets and malformed input", () => {
  const id = randomUUID(), version = randomUUID();
  const token = signCoupleToken(id, version, "test-secret");
  assert.deepEqual(verifyCoupleToken(token, "test-secret"), { weddingId: id, version });
  assert.equal(verifyCoupleToken(token.replace(id, randomUUID()), "test-secret"), null);
  assert.equal(verifyCoupleToken(token, "other-secret"), null);
  assert.equal(verifyCoupleToken(`${token}.extra`, "test-secret"), null);
  assert.equal(verifyCoupleToken("invalid", "test-secret"), null);
});

test("legacy and unknown theme identifiers keep the classic invitation", () => {
  assert.equal(getWeddingTemplate(null).id, "theme_1");
  assert.equal(getWeddingTemplate("unknown").id, "theme_1");
  assert.equal(getWeddingTemplate("floral_romance").name, "Floral Romance");
  assert.equal(findWeddingTemplate("unknown"), undefined);
  assert.equal(getWeddingTemplate("seda_promesas").name,"Seda & Promesas");
});

test("wedding countdown resolves local wedding time, including summer time, without using the visitor's zone", () => {
  assert.equal(weddingTimestamp("2028-02-29","17:30","America/Santo_Domingo"),Date.parse("2028-02-29T21:30:00Z"));
  assert.equal(weddingTimestamp("2027-06-20","17:30","America/New_York"),Date.parse("2027-06-20T21:30:00Z"));
  assert.equal(weddingTimestamp("2027-01-20","17:30","America/New_York"),Date.parse("2027-01-20T22:30:00Z"));
  assert.equal(weddingTimestamp("2027-06-20","00:00","Europe/Madrid"),Date.parse("2027-06-19T22:00:00Z"));
  for (const args of [[null],["2027-02-29"],["2027-02-30"],["2027-01-01","25:00"],["2027-01-01","12:00","invalid"],["2027-03-14","02:30","America/New_York"]]) {
    assert.equal(weddingTimestamp(...args),null);
  }
});

test("countdown carries days, hours and minutes correctly and never becomes negative", () => {
  assert.deepEqual(countdownParts(90061000,0),{days:1,hours:1,minutes:1,seconds:1});
  assert.deepEqual(countdownParts(60000,1000),{days:0,hours:0,minutes:0,seconds:59});
  assert.deepEqual(countdownParts(1000,2000),{days:0,hours:0,minutes:0,seconds:0});
});

test("activating Seda & Promesas changes only the wedding's template", async () => {
  const db=database({weddings:[{id:"w1",theme_id:"floral_romance",settings:{partner_one:"Nombre",welcome_message:"Mensaje real"},event_date:"2028-02-29"}],
    guests:[{id:"g1",wedding_id:"w1",invite_code:"personal",full_name:"Invitado"}],
    rsvps:[{guest_id:"g1",status:"confirmed",seats_confirmed:2}]});
  const before=structuredClone(db.tables);
  await updateWedding(db,"w1",{theme_id:getWeddingTemplate("seda_promesas").id});
  assert.deepEqual(db.tables,{...before,weddings:[{...before.weddings[0],theme_id:"seda_promesas"}]});
});

test("guest search handles accents and combines actual RSVP and companion filters", () => {
  const search = normalizeGuestSearch("María Pérez acompañante Lucía maria@example.com");
  assert.ok(matchesGuest(search, "confirmed", true, guestFilters(new URLSearchParams("q=lucia&guest_status=confirmed&companions=with"))));
  assert.ok(!matchesGuest(search, "pending", true, guestFilters(new URLSearchParams("q=maria&guest_status=confirmed"))));
  assert.ok(!matchesGuest(search, "confirmed", true, guestFilters(new URLSearchParams("companions=without"))));
  assert.equal(guestFilters(new URLSearchParams("guest_status=invalid")).status, "all");
});

test("Excel export preserves contacts and literal guest text while counting group seats only once", () => {
  const principal={full_name:"María & José",phone:"+18095550123",email:"maria@example.com",max_seats:3,
    rsvps:[{status:"confirmed",seats_confirmed:2,dietary:"Sin nueces",message:'=HYPERLINK("https://example.com")'}]};
  const companion={full_name:"Lucía Pérez",phone:null,email:null,max_seats:1,rsvps:{status:"declined",seats_confirmed:0}};
  const rows=guestExportRows(principal,[companion]);
  assert.deepEqual(rows[0],["María & José","Principal","María & José","+18095550123","maria@example.com","Confirmado",3,2,"Sin nueces",'=HYPERLINK("https://example.com")']);
  assert.deepEqual(rows[1],["Lucía Pérez","Acompañante","María & José","","","No asiste",null,null,"",""]);
  const sheet=guestExportSheet(rows);
  assert.equal(sheet[1][3].type,String);
  assert.equal(sheet[1][9].type,String,"Messages are literal strings, never formulas");
  assert.equal(sheet[1][7].type,Number);
  assert.equal(sheet[2][7],null);
  assert.equal(guestExportRows({...principal,rsvps:null},[])[0][5],"Pendiente");
});

test("guest and template navigation has distinct entry points and preserves an open wedding",()=>{
  for(const path of ["/dashboard","/weddings"]){
    assert.equal(weddingSectionPath(path,"guests"),"/weddings?section=guests");
    assert.equal(weddingSectionPath(path,"templates"),"/weddings?section=templates");
  }
  assert.equal(weddingSectionPath("/weddings/w1/guests","templates"),"/weddings/w1/templates");
  assert.equal(weddingSectionPath("/weddings/w2/templates/preview/seda_promesas","guests"),"/weddings/w2/guests");
  assert.equal(weddingSection("guests"),"guests");assert.equal(weddingSection("templates"),"templates");
  assert.equal(weddingSection("other"),null);assert.equal(weddingSection(null),null);
});

test("guest entry redirects for one wedding while Templates always opens its catalogue",()=>{
  assert.equal(singleWeddingSectionPath([],"guests"),null);
  assert.equal(singleWeddingSectionPath([{id:"w1"},{id:"w2"}],"templates"),null);
  assert.equal(singleWeddingSectionPath([{id:"w1"}],"guests"),"/weddings/w1/guests");
  assert.equal(singleWeddingSectionPath([{id:"w1"}],"templates"),null);
  assert.equal(singleWeddingSectionPath([],"templates"),null);
});

test("dashboard summaries use actual publication flags and only primary RSVPs from their workspace",async()=>{
  const now=new Date().toISOString();
  const db=database({weddings:[{id:"w1",workspace_id:"space",is_published:true},{id:"w2",workspace_id:"space",is_published:false},{id:"other",workspace_id:"other-space",is_published:true}],
    guests:[{id:"g1",wedding_id:"w1",is_primary:true,full_name:"Invitado propio"},{id:"c1",wedding_id:"w1",is_primary:false,primary_guest_id:"g1"},{id:"foreign",wedding_id:"other",is_primary:true}],
    rsvps:[{id:"r1",guest_id:"g1",status:"confirmed",updated_at:now},{id:"r2",guest_id:"c1",status:"confirmed",updated_at:now},{id:"r3",guest_id:"foreign",status:"confirmed",updated_at:now}],
    wedding_rsvp_stats:[{wedding_id:"w1",confirmed:1},{wedding_id:"other",confirmed:50}]});
  assert.deepEqual(await getDashboardStats(db,"space"),{published:1,drafts:1,rsvpToday:1});
  const page=await getDashboardPageData(db,"space");
  assert.deepEqual(page.weddings.map(row=>row.id),["w1","w2"]);
  assert.deepEqual(Object.keys(page.statsByWedding),["w1"]);
  assert.deepEqual(page.recentRsvps.map(row=>[row.id,row.guest_name]),[["r1","Invitado propio"]]);
  assert.ok(db.operations.every(operation=>operation.action==="select"));
});

test("editing wedding details preserves unrelated settings and the access version", () => {
  const input = form({ title: "Nuestra boda", event_date: "2027-06-20", ceremony_venue: "La capilla",
    custom_questions: "¿Necesitas transporte?\n\n¿A qué hora llegas?", show_dietary: "on" });
  const result = parseWeddingForm(input, { couple_access_version: "keep", theme_color: "blue" });
  assert.equal(result.settings.couple_access_version, "keep");
  assert.equal(result.settings.theme_color, "blue");
  assert.equal(result.settings.ceremony_venue, "La capilla");
  assert.deepEqual(result.settings.rsvp_form.custom_questions, ["¿Necesitas transporte?", "¿A qué hora llegas?"]);
  assert.equal(result.settings.rsvp_form.show_message, false);
});

test("wedding forms reject script URLs and deadlines after the wedding", () => {
  assert.throws(() => parseWeddingForm(form({ title: "Boda", ceremony_map_url: "javascript:alert(1)" })), /enlace/);
  assert.throws(() => parseWeddingForm(form({ title: "Boda", event_date: "2027-01-01", rsvp_deadline: "2027-01-02" })), /fecha límite/);
  assert.equal(getRsvpSettings().show_dietary, true);
  assert.deepEqual(getRsvpSettings({ rsvp_form: { custom_questions: ["Pregunta", 123] } }).custom_questions, ["Pregunta"]);
});

test("editorial settings preserve ordered midnight activities and wedding-specific dress colors", () => {
  const result = parseWeddingForm(form({ title: "Boda", main_photo_url: "https://example.com/portrait.jpg",
    gifts_url: "https://example.com/list", dress_colors: "#EAB7BD, #B4C5DD",
    itinerary: "21:00 | Pastel | Compartimos el postre\n01:00 | Despedida | Hasta pronto" }), { unrelated: "keep" });
  assert.deepEqual(result.settings.itinerary, [
    { time: "21:00", title: "Pastel", description: "Compartimos el postre" },
    { time: "01:00", title: "Despedida", description: "Hasta pronto" },
  ]);
  assert.deepEqual(result.settings.dress_colors, ["#EAB7BD", "#B4C5DD"]);
  assert.equal(result.settings.unrelated, "keep");
  const legacy = parseWeddingForm(form({title:"Boda"}), result.settings);
  assert.deepEqual(legacy.settings.itinerary,result.settings.itinerary);
  assert.deepEqual(legacy.settings.dress_colors,result.settings.dress_colors);
  assert.equal(legacy.settings.main_photo_url,result.settings.main_photo_url);
  const empty = parseWeddingForm(form({title:"Boda",itinerary:"",dress_colors:""}),result.settings);
  assert.deepEqual(empty.settings.itinerary,[]);
  assert.deepEqual(empty.settings.dress_colors,[]);
});

test("editorial fields reject invalid activities, dress colors and unsafe links", () => {
  for (const itinerary of ["25:00 | Cena | Texto", "18:60 | Cena", "18:00 | ", "Cena a las ocho"]) {
    assert.throws(() => parseWeddingForm(form({title:"Boda",itinerary})), /actividad/);
  }
  assert.throws(() => parseWeddingForm(form({title:"Boda",dress_colors:"red; background:url(test)"})), /colores/);
  for (const name of ["main_photo_url","gifts_url","dress_examples_url"]) {
    assert.throws(() => parseWeddingForm(form({title:"Boda",[name]:"javascript:alert(1)"})), /enlace/);
  }
});

test("creating and editing an invitation changes its companion allowance", async () => {
  const db = database();
  await handleGuestAction(db, "w1", form({ action: "create_guest", full_name: "Invitado", companions: 2 }));
  const guest = db.tables.guests[0];
  assert.equal(guest.max_seats, 3);
  assert.match(guest.invite_code, /^[a-f0-9]{24}$/);
  await handleGuestAction(db, "w1", form({ action: "update_guest", guest_id: guest.id, full_name: "Nombre editado", companions: 4 }));
  assert.equal(guest.full_name, "Nombre editado");
  assert.equal(guest.max_seats, 5);
});

test("guest contacts validate and normalize names, emails and international phones", () => {
  assert.equal(guestName("  María   de la Cruz  "),"María de la Cruz");
  assert.equal(guestName("",true),"");
  assert.equal(guestEmail(" Ana+familia@EXAMPLE.COM "),"Ana+familia@example.com");
  assert.equal(guestEmail(""),null);
  assert.equal(guestPhone("809 555 0123","+1"),"+18095550123");
  assert.equal(guestPhone("612 345 678","+34"),"+34612345678");
  assert.equal(guestPhone("+52 555 123 4567","+1"),"+525551234567");
  assert.equal(formatGuestPhone("8095550123","+1"),"809 555 0123");
  assert.equal(formatGuestPhone("no-es-un-telefono","+1"),"no-es-un-telefono");
  for(const value of [" ","12345","<b>Nombre</b>","A".repeat(201)])assert.throws(()=>guestName(value));
  for(const value of ["nombre","a@","a@domain","a..b@example.com","a@-domain.com","a@example.c","a b@example.com"])assert.throws(()=>guestEmail(value));
  for(const value of ["abc8095550123","12","+10005550123","+18091234","+340612345678","+1234567890123456"])assert.throws(()=>guestPhone(value));
});

test("creating a guest saves named companions atomically and reserves blank companion slots", async () => {
  const db=database();
  const data=form({action:"create_guest",full_name:"Ana Pérez",phone:"809 555 0123",phone_country:"+1",email:"ana@EXAMPLE.COM",companion_mode:"names",allow_unnamed_companions:"1"});
  for(const name of ["Luis Pérez","","María Pérez"])data.append("companion_names",name);
  await handleGuestAction(db,"w1",data);
  assert.equal(db.tables.guests.length,3);
  const principal=db.tables.guests.find(guest=>guest.is_primary);
  assert.equal(principal.max_seats,4);
  assert.equal(principal.phone,"+18095550123");
  assert.equal(principal.email,"ana@example.com");
  assert.deepEqual(db.tables.guests.filter(guest=>!guest.is_primary).map(guest=>[guest.full_name,guest.primary_guest_id]),[["Luis Pérez",principal.id],["María Pérez",principal.id]]);
  assert.equal(db.operations.filter(operation=>operation.action==="insert").length,1);
});

test("empty companion names require acknowledgement and invalid form data never partially creates an invitation", async () => {
  for(const fields of [
    {full_name:"   "},{email:"invalid"},{phone:"not-a-phone"},
    {companion_mode:"names",companion_names:""},
    {companion_mode:"names",companion_names:"<script>bad</script>",allow_unnamed_companions:"1"},
  ]) {
    const db=database();
    await assert.rejects(handleGuestAction(db,"w1",form({action:"create_guest",full_name:"Invitado",...fields})));
    assert.equal(db.tables.guests.length,0);
    assert.equal(db.operations.filter(operation=>operation.action==="insert").length,0);
  }
  const db=database();
  const data=form({action:"create_guest",full_name:"Invitado",companion_mode:"names",allow_unnamed_companions:"1"});
  for(let i=0;i<100;i++)data.append("companion_names","");
  await assert.rejects(handleGuestAction(db,"w1",data),/cupo/);
  assert.equal(db.tables.guests.length,0);
});

test("adding a named companion expands capacity without changing another wedding", async () => {
  const db = database({ guests: [{ id: "g1", wedding_id: "w1", is_primary: true, max_seats: 1 }] });
  await handleGuestAction(db, "w1", form({ action: "add_companion", guest_id: "g1", full_name: "Acompañante" }));
  assert.equal(db.tables.guests[0].max_seats, 2);
  assert.equal(db.tables.guests[1].primary_guest_id, "g1");
  await assert.rejects(handleGuestAction(db, "w2", form({ action: "delete_guest", guest_id: "g1" })), /no pertenece/);
  assert.equal(db.tables.guests.length, 2);
});

test("capacity cannot fall below named companions or already confirmed seats", async () => {
  const db = database({ guests: [
    { id: "g1", wedding_id: "w1", is_primary: true, max_seats: 3 },
    { id: "g2", wedding_id: "w1", is_primary: false, primary_guest_id: "g1" },
  ], rsvps: [{ guest_id: "g1", seats_confirmed: 3 }] });
  await assert.rejects(handleGuestAction(db, "w1", form({ action: "update_guest", guest_id: "g1", full_name: "Invitado", companions: 0 })), /acompañantes ya añadidos/);
  await assert.rejects(handleGuestAction(db, "w1", form({ action: "update_guest", guest_id: "g1", full_name: "Invitado", companions: 1 })), /ya confirmadas/);
});

test("legacy guests can get a personal invite code and companions can be edited or removed separately", async () => {
  const db = database({ guests: [
    { id: "g1", wedding_id: "w1", full_name: "Principal", is_primary: true, max_seats: 2 },
    { id: "g2", wedding_id: "w1", full_name: "Nombre anterior", is_primary: false, primary_guest_id: "g1" },
  ] });
  await handleGuestAction(db, "w1", form({ action: "create_invite_code", guest_id: "g1" }));
  const code = db.tables.guests[0].invite_code;
  assert.match(code, /^[a-f0-9]{24}$/);
  await handleGuestAction(db, "w1", form({ action: "create_invite_code", guest_id: "g1" }));
  assert.equal(db.tables.guests[0].invite_code, code);
  await handleGuestAction(db, "w1", form({ action: "update_guest", guest_id: "g2", full_name: "Nombre nuevo" }));
  assert.equal(db.tables.guests[1].full_name, "Nombre nuevo");
  await handleGuestAction(db, "w1", form({ action: "delete_guest", guest_id: "g2" }));
  assert.equal(db.tables.guests.length, 1);
  assert.equal(db.tables.guests[0].id, "g1");
});

test("deleting a primary removes dependent RSVPs and companions, leaving other weddings intact", async () => {
  const db = database({ guests: [
    { id: "g1", wedding_id: "w1", is_primary: true },
    { id: "g2", wedding_id: "w1", is_primary: false, primary_guest_id: "g1" },
    { id: "other", wedding_id: "w2", is_primary: true },
  ], rsvps: [{ guest_id: "g1" }, { guest_id: "g2" }, { guest_id: "other" }] });
  await handleGuestAction(db, "w1", form({ action: "delete_guest", guest_id: "g1" }));
  assert.deepEqual(db.tables.guests.map(g => g.id), ["other"]);
  assert.deepEqual(db.tables.rsvps.map(r => r.guest_id), ["other"]);
});

function rsvpDatabase() {
  return database({ weddings: [{ id: "w1", slug: "boda", is_published: true, settings: {
    rsvp_form: { show_message: false, show_dietary: false, custom_questions: ["¿Transporte?"] },
  } }], guests: [{ id: "g1", wedding_id: "w1", full_name: "Invitado", invite_code: "code", is_primary: true, max_seats: 3 }] });
}

test("RSVP validates the wedding, seat limits and integer quantities", async () => {
  for (const override of [{ slug: "another" }, { seats_confirmed: -1 }, { seats_confirmed: 4 }, { seats_confirmed: 1.5 }]) {
    const db = rsvpDatabase();
    await assert.rejects(submitRsvp(db, { slug: "boda", invite_code: "code", status: "confirmed", seats_confirmed: 2, ...override }));
    assert.equal(db.tables.rsvps.length, 0);
  }
});

test("RSVP saves custom answers and companion names, ignoring disabled fields", async () => {
  const db = rsvpDatabase();
  await submitRsvp(db, { slug: "boda", invite_code: "code", status: "confirmed", seats_confirmed: 2,
    plus_ones: ["Mi acompañante"], dietary: "hidden", message: "hidden", custom_answers: ["Sí"] });
  assert.equal(db.tables.guests[1].full_name, "Mi acompañante");
  assert.equal(db.tables.rsvps[0].status, "confirmed");
  assert.equal(db.tables.rsvps[0].message, "¿Transporte?: Sí");
  assert.equal(db.tables.rsvps[0].dietary, "");
});

test("declining an invitation keeps the named guest list and confirms zero seats", async () => {
  const db = rsvpDatabase();
  db.tables.guests.push({ id: "c1", wedding_id: "w1", primary_guest_id: "g1", full_name: "Acompañante", is_primary: false });
  await submitRsvp(db, { slug: "boda", invite_code: "code", status: "declined", seats_confirmed: 2 });
  assert.equal(db.tables.guests.length, 2);
  assert.equal(db.tables.rsvps[0].seats_confirmed, 0);
  assert.equal(deadlinePassed({ rsvp_deadline: "2000-01-01" }), true);
  assert.equal(deadlinePassed({}), false);
});

test("personal links resolve only their wedding and restore individually selected companions", async () => {
  const db = rsvpDatabase();
  db.tables.guests.push(
    { id:"c1", wedding_id:"w1", primary_guest_id:"g1", full_name:"Primera persona", is_primary:false },
    { id:"c2", wedding_id:"w1", primary_guest_id:"g1", full_name:"Segunda persona", is_primary:false });
  const unanswered = await getInvitationGuest(db,"w1","code");
  assert.equal(unanswered.initialStatus,"confirmed","The default button value is not a saved confirmation");
  assert.equal(unanswered.isConfirmed,false);
  await submitRsvp(db, { slug:"boda", invite_code:"code", status:"confirmed", seats_confirmed:99,
    companions:[{id:"c1",attending:false},{id:"c2",attending:true}] });
  assert.equal(db.tables.rsvps.find(row=>row.guest_id==="g1").seats_confirmed,2,"Server derives seats from checks");
  assert.equal(db.tables.rsvps.find(row=>row.guest_id==="c1").status,"declined");
  assert.equal(db.tables.rsvps.find(row=>row.guest_id==="c2").status,"confirmed");
  assert.equal(db.tables.rsvps.find(row=>row.guest_id==="c1").seats_confirmed,0);
  assert.equal(db.tables.rsvps.find(row=>row.guest_id==="c2").seats_confirmed,0,"Companion seats must be non-null without counting the group twice");
  assert.equal(db.tables.rsvps.reduce((total,row)=>total+row.seats_confirmed,0),2);
  assert.equal(db.tables.guests.find(row=>row.id==="c1").full_name,"Primera persona");
  const personal = await getInvitationGuest(db,"w1","code");
  assert.equal(personal.isConfirmed,true);
  assert.equal(personal.guest.full_name,"Invitado");
  assert.deepEqual(personal.companions.map(row=>[row.id,row.attending]),[["c1",false],["c2",true]]);
  assert.equal(await getInvitationGuest(db,"w2","code"),null);
  assert.equal(await getInvitationGuest(db,"w1","wrong"),null);
  await submitRsvp(db,{slug:"boda",invite_code:"code",status:"declined",companions:[{id:"c1",attending:false},{id:"c2",attending:true}]});
  assert.equal(db.tables.guests.length,3);
  assert.ok(db.tables.rsvps.every(row=>row.status==="declined"));
  assert.ok(db.tables.rsvps.every(row=>row.seats_confirmed===0));
  assert.equal((await getInvitationGuest(db,"w1","code")).isConfirmed,false);
  await submitRsvp(db,{slug:"boda",invite_code:"code",status:"pending",companions:[]});
  assert.ok(db.tables.rsvps.every(row=>row.status==="pending" && row.seats_confirmed===0));
  assert.equal((await getInvitationGuest(db,"w1","code")).isConfirmed,false);
});

test("companion checks reject foreign IDs, duplicates, invalid selections and over-capacity before writing", async () => {
  for (const companions of [[{id:"foreign",attending:true}],[{attending:"true"}],
    [{id:"c1",attending:true},{id:"c1",attending:false}],
    [{attending:true},{attending:true},{attending:true}],{}]) {
    const db = rsvpDatabase();
    db.tables.guests.push({id:"c1",wedding_id:"w1",primary_guest_id:"g1",full_name:"Acompañante",is_primary:false});
    await assert.rejects(submitRsvp(db,{slug:"boda",invite_code:"code",status:"confirmed",companions}));
    assert.equal(db.tables.rsvps.length,0);
    assert.equal(db.tables.guests.length,2);
  }
});

test("new checked companions return stable IDs and repeated confirmations do not duplicate guests", async () => {
  const db = rsvpDatabase();
  const first = await submitRsvp(db,{slug:"boda",invite_code:"code",status:"confirmed",companions:[
    {full_name:"",attending:false},{full_name:"Persona elegida",attending:true}]});
  assert.equal(db.tables.guests.length,2);
  assert.equal(first.companions[1].full_name,"Persona elegida");
  assert.ok(first.companions[1].id);
  await submitRsvp(db,{slug:"boda",invite_code:"code",status:"confirmed",companions:first.companions});
  assert.equal(db.tables.guests.length,2);
  await assert.rejects(submitRsvp(db,{slug:"boda",invite_code:"code",status:"confirmed",companions:[
    {full_name:"",attending:false},{full_name:"Persona elegida",attending:true}]}),/lista de acompañantes cambió/);
  assert.equal(db.tables.guests.length,2);
});

test("reserved unnamed slots can be optionally named even when companion names are not proactively requested",async()=>{
  const db=rsvpDatabase();
  db.tables.weddings[0].settings.rsvp_form.ask_companion_names=false;
  await submitRsvp(db,{slug:"boda",invite_code:"code",status:"confirmed",companions:[{full_name:"Nombre completado por el invitado",attending:true}]});
  assert.equal(db.tables.guests[1].full_name,"Nombre completado por el invitado");
  assert.equal(db.tables.guests[1].primary_guest_id,"g1");
  assert.equal(db.tables.rsvps.find(row=>row.guest_id==="g1").seats_confirmed,2);
});

test("unnamed legacy primary guests can receive a personal link without changing an existing token", async () => {
  const db = database({guests:[{id:"legacy",wedding_id:"w1",full_name:"Invitado antiguo",is_primary:null,primary_guest_id:null}]});
  await handleGuestAction(db,"w1",form({action:"create_invite_code",guest_id:"legacy"}));
  const code = db.tables.guests[0].invite_code;
  assert.equal(db.tables.guests[0].is_primary,true);
  await handleGuestAction(db,"w1",form({action:"create_invite_code",guest_id:"legacy"}));
  assert.equal(db.tables.guests[0].invite_code,code);
});
