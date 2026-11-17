import { guestName, guestEmail, guestPhone, formatGuestPhone } from "./guestForm";

document.querySelectorAll<HTMLDialogElement>("[data-guest-dialog]").forEach(dialog => {
  const form = dialog.querySelector<HTMLFormElement>("[data-create-guest-form]")!;
  const list = dialog.querySelector<HTMLElement>("[data-new-companions]")!;
  const country = form.elements.namedItem("phone_country") as HTMLSelectElement;
  const warning = dialog.querySelector<HTMLElement>("[data-empty-companions-warning]")!;
  const allowed = form.elements.namedItem("allow_unnamed_companions") as HTMLInputElement;
  const submit = dialog.querySelector<HTMLButtonElement>("[data-create-guest-submit]")!;
  const error = dialog.querySelector<HTMLElement>("[data-create-guest-error]")!;
  let opener: HTMLElement | null = null;
  const close = () => { if (!submit.disabled) dialog.close(); };
  document.querySelectorAll<HTMLButtonElement>("[data-open-guest-dialog]").forEach(button => button.addEventListener("click", () => {
    opener = button;
    dialog.showModal();
    (form.elements.namedItem("full_name") as HTMLInputElement).focus();
  }));
  dialog.querySelectorAll("[data-close-guest-dialog]").forEach(button => button.addEventListener("click", close));
  dialog.addEventListener("cancel", event => { if (submit.disabled) event.preventDefault(); });
  dialog.addEventListener("close", () => opener?.focus());
  dialog.addEventListener("click", event => { if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  }});
  const resetWarning = () => { allowed.value = ""; warning.hidden = true; };
  const renumber = () => {
    [...list.querySelectorAll<HTMLElement>(".guest-new-companion")].forEach((row, i) => {
      row.querySelector(".guest-companion-number")!.textContent = `${i + 1}`;
      row.querySelector("[data-companion-label]")!.textContent = `Acompañante ${i + 1}`;
      row.querySelector("[data-remove-companion]")!.setAttribute("aria-label", `Quitar acompañante ${i + 1}`);
      const input = row.querySelector<HTMLInputElement>("input")!;
      const message = row.querySelector<HTMLElement>("[data-field-error]")!;
      message.id = `new-companion-error-${i}`;
      input.setAttribute("aria-describedby",message.id);
    });
    const count = list.querySelectorAll("input").length;
    dialog.querySelector("[data-companion-count]")!.textContent = String(count);
    (dialog.querySelector("[data-add-companion]") as HTMLButtonElement).disabled = count >= 99;
    resetWarning();
  };
  dialog.querySelector("[data-add-companion]")!.addEventListener("click", () => {
    if (list.querySelectorAll("input").length >= 99) return;
    const template = dialog.querySelector<HTMLTemplateElement>("[data-companion-template]")!;
    list.append(template.content.cloneNode(true));
    renumber();
    list.querySelector<HTMLInputElement>(".guest-new-companion:last-child input")?.focus();
  });
  list.addEventListener("click", event => {
    const button = (event.target as Element).closest("[data-remove-companion]");
    if (!button) return;
    const row = button.closest(".guest-new-companion")!;
    const next = row.nextElementSibling?.querySelector<HTMLInputElement>("input") ?? row.previousElementSibling?.querySelector<HTMLInputElement>("input");
    row.remove(); renumber();
    (next ?? dialog.querySelector<HTMLButtonElement>("[data-add-companion]"))?.focus();
  });
  const validate = (input: HTMLInputElement) => {
    let message = "";
    try {
      if (input.name === "full_name" || input.name === "companion_names") guestName(input.value, input.name === "companion_names");
      if (input.name === "email") guestEmail(input.value);
      if (input.name === "phone") guestPhone(input.value,country.value);
    } catch (exception) { message = (exception as Error).message; }
    input.setCustomValidity(message);
    input.setAttribute("aria-invalid",String(Boolean(message)));
    const feedback = input.closest("label")?.querySelector<HTMLElement>("[data-field-error]");
    if (feedback) { feedback.textContent = message; feedback.hidden = !message; }
    return !message;
  };
  form.addEventListener("focusout", event => {
    const input = event.target as HTMLInputElement;
    if (!input.matches("[data-guest-validate]")) return;
    if (input.name === "phone") input.value = formatGuestPhone(input.value,country.value);
    if (input.name === "email") input.value = input.value.trim();
    // Do not move an action button between pointer-down and pointer-up by
    // inserting a blur error above it. Submission validates the whole form.
    if(event.relatedTarget instanceof Element && event.relatedTarget.closest("button"))return;
    validate(input);
  });
  form.addEventListener("input", event => {
    resetWarning();
    const input = event.target as HTMLInputElement;
    if (input.getAttribute("aria-invalid") === "true") validate(input);
  });
  country.addEventListener("change", () => {
    const phone = form.elements.namedItem("phone") as HTMLInputElement;
    phone.placeholder = country.value === "+1" ? "809 555 0123" : country.value === "+34" ? "612 345 678" : "Número de teléfono";
    if (phone.value) validate(phone);
  });
  dialog.querySelector("[data-review-companions]")!.addEventListener("click", () => {
    warning.hidden = true;
    [...list.querySelectorAll<HTMLInputElement>("input")].find(input=>!input.value.trim())?.focus();
  });
  dialog.querySelector("[data-confirm-empty-companions]")!.addEventListener("click", () => { allowed.value = "1"; form.requestSubmit(submit); });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (submit.disabled) return;
    const invalid = [...form.querySelectorAll<HTMLInputElement>("[data-guest-validate]")].filter(input=>!validate(input));
    if (invalid.length) { invalid[0].focus(); return; }
    const unnamed = [...list.querySelectorAll<HTMLInputElement>("input")].filter(input=>!input.value.trim()).length;
    if (unnamed && allowed.value !== "1") {
      dialog.querySelector("[data-empty-companions-message]")!.textContent = `${unnamed} ${unnamed === 1 ? "acompañante quedó sin nombre. Se reservará su lugar y el invitado tendrá" : "acompañantes quedaron sin nombre. Se reservarán sus lugares y el invitado tendrá"} la opción de completar ${unnamed === 1 ? "el nombre" : "los nombres"} al confirmar su asistencia.`;
      warning.hidden = false;
      dialog.querySelector<HTMLButtonElement>("[data-confirm-empty-companions]")!.focus();
      return;
    }
    submit.disabled = true; form.setAttribute("aria-busy","true"); error.hidden = true;
    try {
      const response = await fetch(window.location.href,{method:"POST",body:new FormData(form)});
      const html = new DOMParser().parseFromString(await response.text(),"text/html");
      const failure = html.querySelector('[data-page-error], [role="alert"]:not([hidden])');
      if (!response.ok || failure || !response.redirected) throw new Error(failure?.textContent?.trim() || "No se pudo crear el invitado. Revisa los datos e inténtalo de nuevo.");
      window.location.assign(response.url);
    } catch (exception) {
      error.textContent = exception instanceof Error ? exception.message : "No se pudo guardar. Revisa tu conexión.";
      error.hidden = false; error.tabIndex = -1; error.focus(); submit.disabled = false; form.removeAttribute("aria-busy");
    }
  });
});
