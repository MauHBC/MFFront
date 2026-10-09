// Restricted to the authorized WhatsApp preview; other local stacks are unchanged.
const appRouteRoots = new Set([
  'login', 'menu', 'agendamentos', 'whatsapp-cenarios', 'painel', 'dashboard',
  'pacientes', 'equipe', 'planos', 'financeiro', 'configuracoes', 'register',
  'cadastro', 'confirmar-email', 'termos', 'privacidade', 'situacao-comercial',
  'recuperar-senha', 'credencial', 'politica', 'c', 'platform', 'semAcesso',
]);

function localPreviewRouting(environment = process.env) {
  const enabled = environment.NODE_ENV === 'development'
    && environment.MOTRIA_LOCAL_STACK_SLOT === 'whatsapp-pilot';
  return (req, _res, next) => {
    if (!enabled || !['GET', 'HEAD'].includes(req.method)) return next();
    const pathname = req.url.split('?')[0];
    if (/^\/api(?:\/|$)/.test(pathname)) return next();
    // Static handlers still serve existing files. The history fallback must not
    // turn missing assets into successful HTML, even when Accept includes HTML.
    if (/^\/(?:static|assets)(?:\/|$)/.test(pathname)
      || /\/[^/]*\.[^/]+$/.test(pathname)) {
      req.headers.accept = 'application/octet-stream';
      return next();
    }
    if (pathname === '/' || appRouteRoots.has(pathname.split('/')[1])) {
      req.url = '/index.html';
    }
    return next();
  };
}

module.exports = { localPreviewRouting };
