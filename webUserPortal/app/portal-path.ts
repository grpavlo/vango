export const PORTAL_BASE_PATH = "/portal";

export function portalPath(path = "/") {
  if (!path.startsWith("/")) return path;
  if (path === "/") return PORTAL_BASE_PATH;
  if (path === PORTAL_BASE_PATH || path.startsWith(`${PORTAL_BASE_PATH}/`)) return path;
  return `${PORTAL_BASE_PATH}${path}`;
}
