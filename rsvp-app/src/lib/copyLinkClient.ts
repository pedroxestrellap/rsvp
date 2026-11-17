// Shared delegation also handles personal links generated after the page loads.
document.addEventListener("click", async event => {
  const button = (event.target as Element).closest<HTMLButtonElement>("[data-copy-url]");
  if (!button) return;
  const status = button.parentElement?.querySelector(".copy-status");
  try {
    await navigator.clipboard.writeText(button.dataset.copyUrl ?? "");
    if (status) status.textContent = "¡Enlace copiado!";
  } catch {
    if (status) status.textContent = "Copia el enlace del campo de abajo.";
    if (!button.parentElement?.querySelector("input")) {
      const input = document.createElement("input");
      input.value = button.dataset.copyUrl ?? "";
      input.readOnly = true;
      input.className = "w-full rounded border p-2 text-xs";
      button.parentElement?.append(input);
      input.select();
    }
  }
});
