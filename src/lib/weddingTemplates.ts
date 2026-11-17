// Presentation metadata only. A wedding's content and access remain in their existing services.
export const weddingTemplates = [
  {
    id: "theme_1", name: "Clásico", eyebrow: "Sencillo y atemporal",
    description: "Una invitación luminosa y directa, con todos los detalles de vuestro gran día.",
    thumbnail: "/templates/classic-preview.svg", style: "Minimalista", colors: ["#ECFDF5", "#047857", "#FFFFFF"],
  },
  {
    id: "floral_romance", name: "Floral Romance", eyebrow: "Una carta de amor",
    description: "Botánica de autor, papel marfil y un sobre con sello de cera. Romance europeo en cada detalle.",
    thumbnail: "/templates/floral-romance/preview.svg", style: "Editorial · Botánico", colors: ["#FAEDA1", "#ABBD98", "#8AACCA", "#A79DBB", "#F6CFD3"],
  },
  {
    id: "seda_promesas", name: "Seda & Promesas", eyebrow: "Un romance entre velos",
    description: "Seda marfil, corazón de encaje y marcos barrocos entre flores blancas. Una invitación delicada y ceremonial.",
    thumbnail: "/templates/seda-promesas/preview.svg", style: "Romántico · Barroco", colors: ["#FAEDA1", "#ABBD98", "#8AACCA", "#A79DBB", "#F6CFD3"],
  },
] as const;

export type WeddingTemplateId = typeof weddingTemplates[number]["id"];
export function findWeddingTemplate(id: string | null | undefined) {
  return weddingTemplates.find(template => template.id === id);
}
export function getWeddingTemplate(id: string | null | undefined) {
  return findWeddingTemplate(id) ?? weddingTemplates[0];
}
