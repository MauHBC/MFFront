export const isPatientInvitePath = (pathname) => (
  /^\/cadastro\/paciente\/[^/]+\/?$/.test(pathname)
  || /^\/c\/[^/]+\/?$/.test(pathname)
  || /^\/c\/[^/]+\/[^/]+\/?$/.test(pathname)
);

export const patientInviteApiPath = (resource, token, slug) => (
  `/public/${resource}/${encodeURIComponent(token)}${slug ? `?slug=${encodeURIComponent(slug)}` : ''}`
);
