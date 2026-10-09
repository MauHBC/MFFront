const { createProxyMiddleware } = require("http-proxy-middleware");
const { proxyTargetForEnvironment } = require("../scripts/run-local-development.cjs");
const { localPreviewRouting } = require("../scripts/lib/local-preview-routing.cjs");

function setupProxy(app) {
  app.use(localPreviewRouting());
  app.use(
    "/api",
    createProxyMiddleware({
      target: proxyTargetForEnvironment(process.env),
      changeOrigin: false,
      xfwd: true,
      onProxyReq(proxyReq, req) {
        const originalHost = req.headers["x-forwarded-host"] || req.headers.host;

        if (originalHost) {
          proxyReq.setHeader("host", originalHost);
          proxyReq.setHeader("x-forwarded-host", originalHost);
        }
      },
    }),
  );
}

setupProxy.proxyTargetForEnvironment = proxyTargetForEnvironment;

module.exports = setupProxy;
