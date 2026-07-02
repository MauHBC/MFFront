# Instrucoes para agentes no MFFrontend

## Regras de negocio

O frontend nao e a fonte oficial das regras de negocio. Antes de mexer em
Agenda, Financeiro, Planos, Reposicao, Cancelamento/Falta, Pacotes ou
Remarcacao, consulte:

```text
../MFBackend/docs/regras-negocio/
```

Se o backend nao estiver disponivel no workspace, peca os documentos antes de
alterar qualquer regra de negocio.

## Diretrizes

- O frontend deve respeitar as regras do backend.
- Nao crie regra financeira apenas no frontend.
- UX pode simplificar texto e fluxo, mas nao pode mudar status, cobranca, saldo,
  credito, reposicao ou uso de plano sem regra documentada.
- Componentes e padroes visuais devem seguir
  `docs/frontend-module-architecture.md` quando aplicavel.
- Nao faca deploy ou push sem autorizacao explicita.

Ao final de tarefas, informe o que mudou, validacoes executadas, riscos e
pendencias.
