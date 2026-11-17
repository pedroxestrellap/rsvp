export const phoneCountries = [
  { value: "+1", label: "RD / EE. UU. (+1)", length: 10 },
  { value: "+52", label: "México (+52)", length: 10 },
  { value: "+34", label: "España (+34)", length: 9 },
  { value: "+57", label: "Colombia (+57)", length: 10 },
  { value: "+54", label: "Argentina (+54)", length: 0 },
  { value: "+56", label: "Chile (+56)", length: 9 },
  { value: "+51", label: "Perú (+51)", length: 9 },
  { value: "+58", label: "Venezuela (+58)", length: 10 },
  { value: "+593", label: "Ecuador (+593)", length: 9 },
  { value: "", label: "Otro país (incluye +código)", length: 0 },
] as const;

export function guestName(value: unknown, optional = false) {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!name && optional) return "";
  if (!name || !/\p{L}/u.test(name)) throw new Error("Escribe un nombre válido.");
  if (name.length > 200 || /[<>\x00-\x1f\x7f]/.test(name)) throw new Error("El nombre debe tener hasta 200 caracteres y no incluir símbolos < o >.");
  return name;
}

export function guestEmail(value: unknown) {
  const email = String(value ?? "").trim();
  if (!email) return null;
  const parts = email.split("@");
  if (parts.length !== 2 || email.length > 254 || parts[0].length > 64
    || !/^[a-z\d.!#$%&'*+/=?^_`{|}~-]+$/i.test(parts[0]) || /^\.|\.$|\.\./.test(parts[0])) {
    throw new Error("Escribe un email válido, por ejemplo nombre@dominio.com.");
  }
  const labels = parts[1].toLowerCase().split(".");
  if (labels.length < 2 || labels.some(label => !/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))
    || !/^(?:[a-z]{2,63}|xn--[a-z\d-]+)$/i.test(labels.at(-1)!)) {
    throw new Error("Escribe un email válido, por ejemplo nombre@dominio.com.");
  }
  return `${parts[0]}@${labels.join(".")}`;
}

export function guestPhone(value: unknown, country?: string) {
  const phone = String(value ?? "").trim();
  if (!phone) return null;
  if (!/^\+?[\d\s().-]+$/.test(phone) || !/^(?:\+\d{1,3})?$/.test(country ?? "")) throw new Error("Escribe un teléfono válido, sin letras.");
  if(country === "" && !phone.startsWith("+"))throw new Error("Incluye el código de país con + al indicar un teléfono de otro país.");
  const digits = phone.replace(/\D/g, "");
  const international = phone.startsWith("+") ? `+${digits}` : country ? `${country}${digits}` : digits;
  const total = international.replace(/\D/g, "");
  if (total.length < 8 || total.length > 15 || total.startsWith("0")) throw new Error("El teléfono debe tener entre 8 y 15 dígitos, incluido el código de país.");
  if (international.startsWith("+1") && !/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(international)) throw new Error("Para +1, escribe los 10 dígitos: área y número. Ejemplo: 809 555 0123.");
  const rule = phoneCountries.find(item => item.value && international.startsWith(item.value));
  if (rule?.length && total.length !== rule.value.length - 1 + rule.length) throw new Error(`El número de ${rule.label} debe tener ${rule.length} dígitos, sin el código de país.`);
  return international;
}

export function formatGuestPhone(value: string, country = "") {
  const raw = value.trim();
  // Keep invalid input visible so validation can explain it instead of silently
  // turning a mistyped optional phone into an empty value.
  if(!/^\+?[\d\s().-]+$/.test(raw))return raw;
  const digits = raw.replace(/\D/g, "");
  const local = raw.startsWith("+1") ? digits.slice(1) : digits;
  if ((country === "+1" && !raw.startsWith("+")) || raw.startsWith("+1")) {
    const formatted = [local.slice(0, 3), local.slice(3, 6), local.slice(6)].filter(Boolean).join(" ");
    return raw.startsWith("+1") ? `+1 ${formatted}` : formatted;
  }
  if (country === "+34" && !raw.startsWith("+")) return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)].filter(Boolean).join(" ");
  return raw;
}
