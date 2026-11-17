import { matchesGuest } from "./guestList";
import { guestName, guestEmail, guestPhone, formatGuestPhone } from "./guestForm";

document.querySelectorAll<HTMLElement>("[data-guest-manager]").forEach(root => {
  const search = root.querySelector<HTMLInputElement>("[data-guest-search]")!;
  const status = root.querySelector<HTMLSelectElement>("[data-guest-status]")!;
  const companions = root.querySelector<HTMLSelectElement>("[data-guest-companions]")!;
  const rows = [...root.querySelectorAll<HTMLElement>("[data-guest-row]")];
  const master = root.querySelector<HTMLInputElement>("[data-select-visible]")!;
  const selectAll = root.querySelector<HTMLElement>("[data-select-all]")!;
  const bulk = root.querySelector<HTMLElement>("[data-bulk-actions]")!;
  const feedback = root.querySelector<HTMLElement>("[data-guest-action-status]")!;
  const dialog = root.querySelector<HTMLDialogElement>("[data-share-dialog]")!;
  const shareText = dialog.querySelector<HTMLTextAreaElement>("[data-share-text]")!;
  const selected = () => rows.filter(row=>row.querySelector<HTMLInputElement>("[data-select-guest]")!.checked);
  const announce = (message:string) => { feedback.hidden=false; feedback.textContent=message; };
  const selection = () => {
    const checked=selected(), visible=rows.filter(row=>!row.hidden), visibleSelected=visible.filter(row=>checked.includes(row));
    master.disabled=visible.length===0;
    master.checked=visible.length>0 && visibleSelected.length===visible.length;
    master.indeterminate=visibleSelected.length>0 && visibleSelected.length<visible.length;
    bulk.hidden=checked.length===0;
    const outside=checked.filter(row=>row.hidden).length;
    root.querySelector("[data-selection-count]")!.textContent=`${checked.length} ${checked.length===1?"invitado seleccionado":"invitados seleccionados"}${outside?` · ${outside} fuera del filtro`:""}`;
    rows.forEach(row=>row.classList.toggle("is-selected",checked.includes(row)));
  };
  const applyFilters = (history=true) => {
    const filters={q:search.value,status:status.value,companions:companions.value};
    rows.forEach(row=>row.hidden=!matchesGuest(row.dataset.search??"",row.dataset.status??"pending",row.dataset.hasCompanions==="true",filters));
    const count=rows.filter(row=>!row.hidden).length;
    root.querySelector("[data-guest-count]")!.textContent=`Mostrando ${count} de ${rows.length} invitaciones`;
    (root.querySelector("[data-guest-empty]") as HTMLElement).hidden=count>0 || rows.length===0;
    (root.querySelector("[data-guest-list]") as HTMLElement).hidden=count===0;
    selectAll.hidden=count===rows.length;
    selection();
    if (!history) return;
    const url=new URL(window.location.href);
    for(const [key,value] of [["q",filters.q],["guest_status",filters.status],["companions",filters.companions]]) {
      if(value && value!=="all") url.searchParams.set(key,value); else url.searchParams.delete(key);
    }
    window.history.replaceState(window.history.state,"",url);
  };
  search.addEventListener("input",()=>applyFilters());
  status.addEventListener("change",()=>applyFilters());
  companions.addEventListener("change",()=>applyFilters());
  window.addEventListener("popstate",()=>{
    const params=new URL(window.location.href).searchParams;
    search.value=params.get("q")??"";status.value=params.get("guest_status")??"all";companions.value=params.get("companions")??"all";applyFilters(false);
  });
  root.addEventListener("change",event=>{if((event.target as Element).matches("[data-select-guest]"))selection();});
  master.addEventListener("change",()=>{rows.filter(row=>!row.hidden).forEach(row=>row.querySelector<HTMLInputElement>("[data-select-guest]")!.checked=master.checked);selection();});
  selectAll.addEventListener("click",()=>{rows.forEach(row=>row.querySelector<HTMLInputElement>("[data-select-guest]")!.checked=true);selection();});
  root.querySelector("[data-clear-selection]")!.addEventListener("click",()=>{rows.forEach(row=>row.querySelector<HTMLInputElement>("[data-select-guest]")!.checked=false);selection();});
  selection();

  const ensureLink = async (row:HTMLElement) => {
    if(row.dataset.invitationUrl)return row.dataset.invitationUrl;
    const form=row.querySelector<HTMLFormElement>("[data-create-and-copy-invitation]");
    if(!form)throw new Error("Esta boda todavía no tiene un enlace de invitación.");
    const response=await fetch(window.location.href,{method:"POST",body:new FormData(form)});
    const html=new DOMParser().parseFromString(await response.text(),"text/html");
    const next=html.querySelector<HTMLElement>(`[data-guest-id="${CSS.escape(row.dataset.guestId!)}"]`);
    const url=next?.dataset.invitationUrl || next?.querySelector<HTMLButtonElement>("[data-copy-url]")?.dataset.copyUrl;
    if(!response.ok || !url)throw new Error(html.querySelector('[data-page-error], [role="alert"]:not([hidden])')?.textContent?.trim() || "No se pudo preparar la invitación.");
    const actions=next?.querySelector("[data-guest-invitation]");
    if(actions)row.querySelector("[data-guest-invitation]")!.replaceChildren(...[...actions.childNodes].map(node=>document.importNode(node,true)));
    row.dataset.invitationUrl=url;
    return url;
  };
  const message = (items:{row:HTMLElement;url:string}[]) => items.map(({row,url})=>`Hola ${row.dataset.guestName}, esta es tu invitación personal a ${root.dataset.weddingTitle || "nuestra boda"}. Confirma tu asistencia y la de tus acompañantes aquí:\n${url}`).join("\n\n");
  const fallbackShare = (text:string,items:{row:HTMLElement;url:string}[]) => {
    shareText.value=text;
    dialog.querySelector("[data-share-description]")!.textContent=items.length===1?`Para ${items[0].row.dataset.guestName}`:`${items.length} invitaciones personales seleccionadas`;
    const phone=items.length===1?items[0].row.dataset.guestPhone?.replace(/\D/g,"") || "":"";
    (dialog.querySelector("[data-share-whatsapp]") as HTMLAnchorElement).href=`https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    (dialog.querySelector("[data-share-email]") as HTMLAnchorElement).href=`mailto:${items.length===1?items[0].row.dataset.guestEmail || "":""}?subject=${encodeURIComponent(`Invitación · ${root.dataset.weddingTitle}`)}&body=${encodeURIComponent(text)}`;
    dialog.querySelector("[data-share-status]")!.textContent="";
    if(!dialog.open)dialog.showModal();
  };
  const share = async (items:{row:HTMLElement;url:string}[],useNative=true) => {
    const text=message(items);
    if(useNative && navigator.share) {
      try {await navigator.share({title:`Invitación · ${root.dataset.weddingTitle}`,text});return;}
      catch(error){if(error instanceof Error && error.name==="AbortError")return;}
    }
    fallbackShare(text,items);
  };
  const copy = async (items:{row:HTMLElement;url:string}[],onlyUrls=false) => {
    const text=onlyUrls?items.map(({row,url})=>`${row.dataset.guestName}\n${url}`).join("\n\n"):message(items);
    try{await navigator.clipboard.writeText(text);announce(`${items.length===1?"Invitación copiada":"Invitaciones copiadas"}: ${items.length}.`);}
    catch{fallbackShare(text,items);shareText.focus();shareText.select();}
  };
  dialog.querySelector("[data-close-share]")!.addEventListener("click",()=>dialog.close());
  dialog.querySelector("[data-copy-share-text]")!.addEventListener("click",async()=>{
    const result=dialog.querySelector("[data-share-status]")!;
    try{await navigator.clipboard.writeText(shareText.value);result.textContent="Mensaje copiado.";}catch{shareText.focus();shareText.select();result.textContent="Selecciona y copia el mensaje de arriba.";}
  });
  root.addEventListener("click",async event=>{
    const button=(event.target as Element).closest<HTMLButtonElement>("[data-share-invitation]");
    if(!button)return;
    const row=button.closest<HTMLElement>("[data-guest-row]")!;
    try{
      const existing=row.dataset.invitationUrl;
      if(!existing)button.disabled=true;
      const url=existing || await ensureLink(row);
      if(!existing)row.querySelector<HTMLButtonElement>("[data-share-invitation]")?.focus();
      await share([{row,url}],Boolean(existing));
    }catch(error){announce(error instanceof Error?error.message:"No se pudo compartir la invitación.");}
    finally{button.disabled=false;}
  });
  root.addEventListener("submit",async event=>{
    const form=event.target as HTMLFormElement;
    if(form.matches("[data-delete-guest]") && !window.confirm("¿Eliminar este invitado? Si es el principal, también se eliminarán sus acompañantes y respuestas RSVP.")){event.preventDefault();return;}
    if(!form.matches("[data-create-and-copy-invitation]"))return;
    event.preventDefault();
    const button=form.querySelector<HTMLButtonElement>("button")!;
    button.disabled=true;
    try{
      const row=form.closest<HTMLElement>("[data-guest-row]")!;
      await ensureLink(row);
      row.querySelector<HTMLButtonElement>("[data-copy-url]")?.click();
    }catch(error){announce(error instanceof Error?error.message:"No se pudo preparar la invitación.");button.disabled=false;}
  });
  const batch = async (kind:"copy"|"share") => {
    const snapshot=selected();if(!snapshot.length)return;
    const buttons=[...bulk.querySelectorAll<HTMLButtonElement>("button")];buttons.forEach(button=>button.disabled=true);
    try{
      const items=[];
      for(const [i,row] of snapshot.entries()){announce(`Preparando invitaciones ${i+1} de ${snapshot.length}…`);items.push({row,url:await ensureLink(row)});}
      buttons.forEach(button=>button.disabled=false);
      bulk.querySelector<HTMLButtonElement>(`[data-bulk-${kind}]`)?.focus();
      if(kind==="copy")await copy(items,true);else{await share(items,false);announce(`${items.length} invitaciones listas para compartir.`);}
    }catch(error){announce(error instanceof Error?error.message:"No se pudieron preparar las invitaciones.");}
    finally{buttons.forEach(button=>button.disabled=false);}
  };
  root.querySelector("[data-bulk-copy]")!.addEventListener("click",()=>void batch("copy"));
  root.querySelector("[data-bulk-share]")!.addEventListener("click",()=>void batch("share"));

  root.querySelectorAll<HTMLFormElement>("[data-guest-edit-form]").forEach(form=>{
    const validate = (input:HTMLInputElement) => {
      let message="";
      try{if(input.name==="full_name")guestName(input.value);if(input.name==="email")guestEmail(input.value);if(input.name==="phone")guestPhone(input.value);}catch(error){message=(error as Error).message;}
      input.setCustomValidity(message);input.setAttribute("aria-invalid",String(Boolean(message)));
      const field=input.closest("label")?.querySelector<HTMLElement>("[data-field-error]");if(field){field.textContent=message;field.hidden=!message;}return !message;
    };
    form.addEventListener("focusout",event=>{const input=event.target as HTMLInputElement;if(!input.matches("input:not([type=hidden])"))return;if(input.name==="phone")input.value=formatGuestPhone(input.value);validate(input);});
    form.addEventListener("input",event=>{const input=event.target as HTMLInputElement;if(input.getAttribute("aria-invalid")==="true")validate(input);});
    form.addEventListener("submit",event=>{const invalid=[...form.querySelectorAll<HTMLInputElement>("input:not([type=hidden])")].filter(input=>!validate(input));if(invalid.length){event.preventDefault();invalid[0].focus();}});
  });
});
