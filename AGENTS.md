# MFFrontend

Aplicação React das clínicas. É um repositório independente; a pasta habitual
usa `main`. Não inclui MFBackend, MFPlatformAdmin, MFMobile ou infraestrutura.

## Estrutura e comandos

- `src/pages`: fluxos; `src/components`: UI compartilhada; `src/services`: API.
- `src/store`: estado; `src/templates`: shells; `docs`: padrões e referências.
- Instalar: `npm install`
- Desenvolvimento local: `npm start` em `http://localhost:3000`
- Testes: `npm test -- --watchAll=false --runInBand`
- Lint: `npx eslint src`
- Mojibake/build: `npm run check:mojibake` e `npm run build`

## Regras obrigatórias

- O frontend não é fonte de verdade de regras operacionais ou financeiras.
  Consulte `../MFBackend/docs/regras-negocio/`; esses documentos prevalecem.
- Preserve o tenant autenticado e nunca permita troca de `clinic_id` pela UI.
- Em produção use `/api` same-origin. Não misture autenticação operacional com
  a autenticação do MFPlatformAdmin.
- Produção, deploy, dados reais, domínios e infraestrutura exigem autorização
  explícita. Nunca altere produção por inferência.
- Não use worktrees sem necessidade explícita. A validação visual é feita pelo
  usuário; valide internamente testes, lint, build, mojibake e `git diff --check`.
- Mudança de comportamento exige documentação correspondente na mesma tarefa.

## Mapa da documentação

- [AGENTS.md](AGENTS.md): instruções práticas deste repositório.
- [docs/frontend-module-architecture.md](docs/frontend-module-architecture.md):
  fonte oficial dos shells, componentes e padrões de módulos.
- [docs/regras-negocio.md](docs/regras-negocio.md): ponte para as regras oficiais
  mantidas no MFBackend; não duplica regras.
