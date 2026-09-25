/* eslint-env jest */
import { fetchAppVersion, getAppVersionId, getLoadedAppVersionId } from "./appVersion";

afterEach(() => { document.head.innerHTML = ""; document.body.innerHTML = ""; jest.restoreAllMocks(); });
test("build identity uses actual JS/CSS assets before commit or timestamp", () => {
  document.head.innerHTML = '<link href="/static/css/main.old.css" rel="stylesheet" />';
  document.body.innerHTML = '<script src="/static/js/main.old.js"></script>';
  const assets = { mainJs: "/static/js/main.old.js", mainCss: "/static/css/main.old.css" };
  expect(getAppVersionId({ assets, commit: "different-commit", generatedAt: "later" }))
    .toBe(getLoadedAppVersionId());
  expect(getAppVersionId({ assets: { ...assets, mainJs: "/static/js/main.new.js" } }))
    .not.toBe(getLoadedAppVersionId());
});
test("manifest fetch bypasses cache with timestamp, no-store and no-cache", async () => {
  const payload = { commit: "test" };
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200,
    headers: { get: () => "application/json" }, json: async () => payload });
  expect(await fetchAppVersion()).toEqual(payload);
  expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/app-version\.json\?t=\d+$/), {
    cache: "no-store", headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  });
});
