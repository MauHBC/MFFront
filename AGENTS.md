# MFFrontend

Aplicação React das clínicas, com landing pública e módulos autenticados. É um
repositório Git independente de MFBackend e MFPlatformAdmin; a pasta habitual
usa `main`.

## Comandos

- Instalar: `npm install`
- Desenvolvimento: `npm start` em `http://localhost:3000`
- Testes: `npm test -- --watchAll=false --runInBand`
- Lint: `npx eslint src`
- Mojibake e build: `npm run check:mojibake` e `npm run build`

## Regras obrigatórias

- O tenant público é resolvido pelo domínio no backend; não aceite `clinic_id`
  do navegador para escolher clínica.
- A landing normal lê somente o perfil publicado. Prévia temporária usa token,
  é `noindex` e não publica conteúdo.
- Dados do banco prevalecem; fallbacks estáticos apenas completam campos
  ausentes. Preserve assets e contratos legados até migração autorizada.
- Renderize seções editoriais somente quando houver conteúdo aplicável.
- Mídias novas usam URLs opacas; assets legados `/assets/...` continuam
  compatíveis.
- Landing pública e módulos autenticados usam contextos separados. O domínio
  público nunca troca o tenant da sessão autenticada.
- Produção usa `/api` same-origin e o bundle não pode conter URLs localhost.
- Regras operacionais pertencem ao Backend; não as implemente apenas na UI.
- Produção, deploy, domínios, dados reais e infraestrutura exigem autorização.
  Não use worktrees sem necessidade explícita.
- Mudança de comportamento exige documentação. Concluído requer testes, lint,
  build, mojibake e `git diff --check`, conforme o escopo.

## Documentos canônicos

- [frontend-module-architecture.md](docs/frontend-module-architecture.md):
  landing, contextos e padrões dos módulos.
- [regras-negocio.md](docs/regras-negocio.md): ponte para as regras oficiais do
  MFBackend.
