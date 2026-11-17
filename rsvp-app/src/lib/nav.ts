export function isActivePath(currentPath: string, target: string) {
  if (target === "/dashboard") return currentPath === "/dashboard";
  return currentPath.startsWith(target);
}

export type WeddingSection = "guests" | "templates";

export function weddingSection(value: string | null): WeddingSection | null {
  return value === "guests" || value === "templates" ? value : null;
}

export function weddingSectionPath(currentPath: string, section: WeddingSection) {
  const id = currentPath.match(/^\/weddings\/([^/?#]+)/)?.[1];
  return id ? `/weddings/${id}/${section}` : `/weddings?section=${section}`;
}

export function singleWeddingSectionPath(weddings: {id:string}[], section: WeddingSection) {
  return section === "guests" && weddings.length === 1 ? `/weddings/${weddings[0].id}/${section}` : null;
}
