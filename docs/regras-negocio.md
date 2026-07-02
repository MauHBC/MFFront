# Regras de negocio

Este frontend nao e a fonte oficial das regras de negocio do MultiFisio/Espaco
Cuidar.

A fonte oficial fica no backend:

```text
../MFBackend/docs/regras-negocio/
```

Consulte principalmente:

- `../MFBackend/docs/regras-negocio/agenda.md`
- `../MFBackend/docs/regras-negocio/financeiro.md`
- `../MFBackend/docs/regras-negocio/planos-mensais.md`
- `../MFBackend/docs/regras-negocio/pacientes.md`
- `../MFBackend/docs/regras-negocio/despesas-clinica.md`

O frontend implementa a experiencia visual e deve preservar os contratos do
backend. Nao mova regra financeira, saldo, status, cobranca, plano, pacote,
reposicao ou remarcacao para uma protecao apenas visual.

Se a pasta `../MFBackend/docs/regras-negocio/` nao estiver disponivel no
workspace, solicite os documentos antes de alterar fluxos de negocio.
