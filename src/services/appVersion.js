const APP_VERSION_FILE = "app-version.json";

export const APP_VERSION_CHECK_THROTTLE_MS = 15 * 60 * 1000;

function buildVersionUrl() {
  const publicUrl = process.env.PUBLIC_URL || "";
  const basePath = publicUrl.endsWith("/") ? publicUrl.slice(0, -1) : publicUrl;
  const cacheBust = Date.now();

  return `${basePath}/${APP_VERSION_FILE}?t=${cacheBust}`;
}

export function getAppVersionId(versionPayload) {
  const mainJs = versionPayload?.assets?.mainJs;
  const mainCss = versionPayload?.assets?.mainCss;
  const assetVersion = [mainJs, mainCss].filter(Boolean).join("|");

  return String(
    assetVersion ||
      versionPayload?.buildId ||
      versionPayload?.commit ||
      versionPayload?.generatedAt ||
      "",
  ).trim();
}

function getLoadedAssetPath(selector) {
  const element = document.querySelector(selector);
  if (!element) return "";

  const assetUrl = element.getAttribute("src") || element.getAttribute("href");
  if (!assetUrl) return "";

  return assetUrl.replace(window.location.origin, "");
}

export function getLoadedAppVersionId() {
  const mainJs = getLoadedAssetPath('script[src*="/static/js/main."]');
  const mainCss = getLoadedAssetPath('link[href*="/static/css/main."]');

  return [mainJs, mainCss].filter(Boolean).join("|");
}

export async function fetchAppVersion() {
  const response = await fetch(buildVersionUrl(), {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Could not load app version: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
}
