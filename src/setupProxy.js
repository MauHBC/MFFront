const { createProxyMiddleware } = require("http-proxy-middleware");
const { proxyTargetForEnvironment } = require("../scripts/run-local-development.cjs");

function clinicalPreviewFallback(req, res, next) {
  const pathname = req.url.split('?')[0];
  if (['GET', 'HEAD'].includes(req.method) && !/^\/api(?:\/|$)/.test(pathname)) {
    const appPath = !pathname.includes('.') && /^\/(?:$|(?:login|pacientes|cadastro|confirmar-email|termos|privacidade|situacao-comercial|menu|recuperar-senha|credencial|politica|c|register|agendamentos|painel|dashboard|equipe|configuracoes|financeiro|platform|planos|semAcesso)(?:\/|$))/.test(pathname);
    // CRA's history fallback requires an Accept header. Restrict HTML fallback
    // to application routes so absent static files retain their actual 404.
    req.headers.accept = appPath ? 'text/html' : 'application/octet-stream';
  }
  next();
}
function setupProxy(app) {
  if (process.env.MOTRIA_LOCAL_STACK_SLOT === 'clinical-export') app.use(clinicalPreviewFallback);
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
setupProxy.clinicalPreviewFallback = clinicalPreviewFallback;

module.exports = setupProxy;
