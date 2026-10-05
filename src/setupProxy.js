const { createProxyMiddleware } = require("http-proxy-middleware");
const { proxyTargetForEnvironment } = require("../scripts/run-local-development.cjs");

function setupProxy(app) {
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
