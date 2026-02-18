export function isActivePath(currentPath: string, target: string) {
  if (target === "/dashboard") return currentPath === "/dashboard";
  return currentPath.startsWith(target);
}
