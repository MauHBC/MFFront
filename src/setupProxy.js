const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function setupProxy(app) {
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://127.0.0.1:3006",
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
};
