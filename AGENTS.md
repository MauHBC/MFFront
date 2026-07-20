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
- Serviços da landing são cards editoriais públicos independentes dos serviços
  operacionais. Não derive nem sincronize título, descrição, imagem, ordem ou
  visibilidade com preço, duração, agenda, profissionais, planos, pacientes ou
  financeiro. Preserve contratos legados e prefira nomes novos explícitos como
  `landingServices`, `publicServiceCards` e `LandingServicesSection`.
- Serviços operacionais pertencem ao sistema autenticado. Ambos os contextos
  continuam isolados por `clinic_id`, sem usar o domínio público para trocar o
  tenant autenticado.
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

As suítes específicas da landing são a validação principal das mudanças
editoriais. A suíte global é adicional: falhas externas devem ser identificadas
como externas, e executar testes operacionais não cria dependência da landing
com esses módulos.
