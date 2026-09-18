// Presentation routing only. These hosts NEVER select a clinic or authorize access.
export const CENTRAL_ORIGIN = "https://app.motria.com.br";
// Explicit empty fragment prevents inheritance (RFC 9110 section 10.2.2).
export const CENTRAL_LOGIN = `${CENTRAL_ORIGIN}/login#`;
export const PUBLIC_SITE_HOSTS = Object.freeze([
  "espacocuidarvix.com.br", "www.espacocuidarvix.com.br",
  "cmtrfisio.com.br", "www.cmtrfisio.com.br",
]);
export const FORWARDING_HOSTS = Object.freeze([
  "camila.motria.com.br", "gabi.motria.com.br",
]);
export const INTERNAL_PATHS = Object.freeze([
  /^\/(login|menu|register|painel|dashboard|equipe)\/?$/i,
  /^\/agendamentos(?:\/eventos)?\/?$/i,
  /^\/pacientes(?:\/(?:novo|consultar|[0-9]+(?:\/avaliacoes\/(?:nova|[0-9]+))?))?\/?$/i,
  /^\/planos(?:\/pacientes\/[0-9]+)?\/?$/i,
  /^\/financeiro(?:\/(?:visao-geral|receitas|despesas|configuracoes(?:\/(?:formas-pagamento|categorias-despesas))?))?\/?$/i,
  /^\/configuracoes(?:\/documentos)?\/?$/i,
  /^\/platform(?:\/clinics\/[0-9]+)?\/?$/i,
]);

export function hostRole(hostname) {
  const host = String(hostname).toLowerCase();
  if (host === "app.motria.com.br") return "central";
  if (PUBLIC_SITE_HOSTS.includes(host)) return "site";
  if (FORWARDING_HOSTS.includes(host)) return "forwarding";
  return "unmanaged";
}

export function entryDestination({ hostname, pathname, hash = "", enabled }) {
  if (!enabled) return null;
  const role = hostRole(hostname);
  if (role === "central" && pathname === "/") return "/login";
  if (!["site", "forwarding"].includes(role)) return null;
  if (INTERNAL_PATHS.some((pattern) => pattern.test(pathname))) return CENTRAL_LOGIN;
  if (role === "forwarding" && pathname === "/") {
    const fragment = new URLSearchParams(hash.replace(/^#/, ""));
    // This only retains the preview renderer. Its existing Backend validates
    // the token/clinic pair; the marker grants no authenticated context.
    if (fragment.has("landing_preview")) return null;
    return CENTRAL_LOGIN;
  }
  return null;
}

export async function loadEntryPolicy({
  hostname = window.location.hostname,
  development = process.env.NODE_ENV === "development",
  fetcher,
  signal,
} = {}) {
  if (development || hostRole(hostname) === "unmanaged") return false;
  const fetchPolicy = fetcher || window.fetch.bind(window);
  const response = await fetchPolicy("/entry-policy.json", {
    cache: "no-store", credentials: "omit", redirect: "error", signal,
  });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("ENTRY_POLICY_UNAVAILABLE");
  }
  const policy = await response.json();
  if (policy?.version !== 1 || typeof policy.enabled !== "boolean") {
    throw new Error("ENTRY_POLICY_INVALID");
  }
  // The same-origin switch supplies no destination and no tenant.
  return policy.enabled;
}
