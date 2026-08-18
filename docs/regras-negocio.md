# Regras de negócio

Este frontend não é a fonte oficial das regras de negócio do Motria. A fonte
canônica fica no MFBackend, no
[catálogo de regras de negócio](https://github.com/MauHBC/MFBackend/blob/main/docs/regras-negocio/README.md).

Consulte principalmente:

- [Agenda](https://github.com/MauHBC/MFBackend/blob/main/docs/regras-negocio/agenda.md)
- [Financeiro](https://github.com/MauHBC/MFBackend/blob/main/docs/regras-negocio/financeiro.md)
- [Planos](https://github.com/MauHBC/MFBackend/blob/main/docs/regras-negocio/planos.md)
- [Pacientes](https://github.com/MauHBC/MFBackend/blob/main/docs/regras-negocio/pacientes.md)
- [Prontuário](https://github.com/MauHBC/MFBackend/blob/main/docs/regras-negocio/prontuario.md)
- [Documentos](https://github.com/MauHBC/MFBackend/blob/main/docs/regras-negocio/documentos.md)
- [Equipe e autorizações](https://github.com/MauHBC/MFBackend/blob/main/docs/regras-negocio/equipe-autorizacoes.md)
- [Tenant e clínica](https://github.com/MauHBC/MFBackend/blob/main/docs/regras-negocio/tenant-clinica.md)

Quando a mudança atravessar domínios, use os mapas do Backend:

- [Lifecycle de Plano Mensal](https://github.com/MauHBC/MFBackend/blob/main/docs/fluxos/plano-mensal-lifecycle.md)
- [Sessão e impactos cross-domain](https://github.com/MauHBC/MFBackend/blob/main/docs/fluxos/sessao-impactos-cross-domain.md)
- [Provisionamento e entrada em operação do tenant](https://github.com/MauHBC/MFBackend/blob/main/docs/fluxos/provisionamento-tenant.md)

O frontend implementa a experiência visual e deve preservar os contratos do
backend. Não mova regra financeira, saldo, status, cobrança, plano, pacote,
reposição ou remarcação para uma proteção apenas visual.

Se o MFBackend não estiver disponível no workspace, use os links canônicos
acima ou solicite os documentos antes de alterar fluxos de negócio.
