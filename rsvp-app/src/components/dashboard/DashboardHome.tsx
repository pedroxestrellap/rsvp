import { useMemo, useState } from "react";
import type { Workspace, WeddingRow } from "../../types/dashboard";

type Props={initialWorkspace:Workspace|null;initialWeddings:WeddingRow[];initialStatsByWedding:Record<string,any>;initialRecentRsvps:any[]};
const Arrow=()=> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>;
const Calendar=()=> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /></svg>;

export default function DashboardHome({initialWorkspace,initialWeddings,initialStatsByWedding,initialRecentRsvps}:Props) {
  const [filter,setFilter]=useState("all");
  const published=initialWeddings.filter(wedding=>wedding.is_published).length;
  const visible=initialWeddings.filter(wedding=>filter==="all" || (filter==="published"?wedding.is_published:!wedding.is_published));
  const statsAvailable=Object.keys(initialStatsByWedding).length>0;
  const stats=useMemo(()=>{
    if(!statsAvailable)return {confirmed:initialRecentRsvps.filter(row=>row.status==="confirmed").length,pending:initialRecentRsvps.filter(row=>row.status==="pending").length,declined:initialRecentRsvps.filter(row=>row.status==="declined").length};
    return initialWeddings.reduce((total,wedding)=>{
      const value=initialStatsByWedding[wedding.id];
      return {confirmed:total.confirmed+Number(value?.confirmed??0),pending:total.pending+Number(value?.pending??0),declined:total.declined+Number(value?.declined??0)};
    },{confirmed:0,pending:0,declined:0});
  },[initialWeddings,initialStatsByWedding,initialRecentRsvps,statsAvailable]);
  return <div className="planner-home">
    <header className="planner-home-heading"><span className="admin-kicker">{initialWorkspace?.name || "Tu espacio de trabajo"}</span><h1>Cada gran día,<br/>bien organizado.</h1><p>Diseña invitaciones, reúne a las personas y cuida cada detalle de tus bodas.</p></header>
    <div className="planner-filter-tabs" aria-label="Filtrar bodas">{[["all",`Todas · ${initialWeddings.length}`],["published",`Publicadas · ${published}`],["draft",`Borradores · ${initialWeddings.length-published}`]].map(([value,label])=><button key={value} type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div>
    <div className="planner-section-heading"><h2>Tus celebraciones</h2><a href="/weddings#new-wedding">+ Nueva boda</a></div>
    {visible.length?<div className="planner-wedding-grid">{visible.slice(0,4).map((wedding,index)=>{
      const information=initialStatsByWedding[wedding.id];
      return <a className={`planner-wedding-card planner-card-${index%4}`} href={`/weddings/${wedding.id}`} key={wedding.id}>
        <div className="planner-card-top"><span><Calendar/>Boda</span><span className="planner-card-status">{wedding.is_published?"Publicada":"Borrador"}</span></div>
        <h3>{wedding.title || "Boda sin título"}</h3>
        <div className="planner-card-bottom"><span>{wedding.event_date?new Date(`${wedding.event_date}T12:00:00`).toLocaleDateString("es",{day:"numeric",month:"long",year:"numeric"}):"Fecha por definir"}{information && ` · ${information.confirmed??0} confirmadas`}</span><Arrow/></div>
      </a>;
    })}</div>:<section className="planner-home-panel"><h2>{initialWeddings.length?"No hay bodas en esta categoría":"Aquí empieza la próxima historia"}</h2><p>{initialWeddings.length?"Cambia el filtro para ver tus otras celebraciones.":"Crea tu primera boda y prepara su invitación personal."}</p><a className="admin-button admin-button-dark" href="/weddings#new-wedding">Crear boda</a></section>}
    <div className="planner-home-bottom">
      <section className="planner-home-panel"><h2>{statsAvailable?"Confirmaciones de tus bodas":"Últimas confirmaciones"}</h2><p>Las personas que darán vida a cada celebración.</p><div className="planner-metric-list"><div><span>Confirmadas</span><strong>{stats.confirmed}</strong></div><div><span>Pendientes</span><strong>{stats.pending}</strong></div><div><span>No asistirán</span><strong>{stats.declined}</strong></div></div></section>
      <section className="planner-home-panel"><h2>Actividad reciente</h2>{initialRecentRsvps.length?<div className="planner-recent-list">{initialRecentRsvps.slice(0,5).map(row=><div className="planner-recent-item" key={row.id}><span className={`planner-recent-dot planner-recent-${row.status}`} aria-hidden="true"></span><span>{row.guest_name || "Invitación"} · {row.status==="confirmed"?"Asiste":row.status==="declined"?"No asiste":"Pendiente"}</span>{row.updated_at && <time dateTime={row.updated_at}>{new Date(row.updated_at).toLocaleDateString("es",{day:"numeric",month:"short"})}</time>}</div>)}</div>:<p>Las respuestas aparecerán aquí cuando tus invitados comiencen a confirmar.</p>}</section>
    </div>
  </div>;
}
