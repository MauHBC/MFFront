# Governança documental do MFFrontend

Esta política define como o MFFrontend organiza e mantém conhecimento durável.
Ela é autossuficiente: vale também quando o repositório é clonado fora da
workspace Multifisio. Regras de negócio cuja autoridade é do Backend não são
recriadas aqui.

## Papéis e fontes atuais

- `AGENTS.md` reúne instruções frequentes para trabalhar com segurança no
  repositório, comandos usuais e referências curtas. Não deve acumular detalhes
  de arquitetura, comportamento ou operação.
- Um eventual `README.md` deve servir ao onboarding humano: propósito,
  pré-requisitos, execução local e entrada para a documentação. Enquanto ele
  não existe, `AGENTS.md` contém os comandos de desenvolvimento. O README não
  substitui fontes especializadas.
- [frontend-module-architecture.md](frontend-module-architecture.md) é a fonte
  canônica para arquitetura transversal, landing pública, App Shell, padrões de
  composição e comportamento de UI compartilhado.
- Documentos específicos de módulo em `docs/`, como
  [team-read-only-module.md](team-read-only-module.md), registram o comportamento
  vigente da interface e os contratos do Backend consumidos por aquele módulo.
- [regras-negocio.md](regras-negocio.md) registra a fronteira de autoridade com
  o MFBackend e ajuda a localizar regras operacionais. Não deve copiar essas
  regras para o Frontend.
- [deploy-production.md](deploy-production.md) é o runbook canônico de produção,
  incluindo identificação da versão, deploy e rollback. O procedimento
  executável correspondente é
  [scripts/deploy-production.sh](../scripts/deploy-production.sh).
- `package.json` é a fonte executável dos scripts disponíveis. Os testes ficam
  junto ao código em `src/**/*.test.*`; comandos e gates obrigatórios de entrega
  são declarados de forma curta no `AGENTS.md`, e expectativas especializadas
  permanecem junto ao documento canônico do comportamento que validam.

O conjunto atual é pequeno e não requer outro índice, mapa de domínios, matriz
de testes ou catálogo de invariantes. Este arquivo é o ponto de roteamento da
documentação e deve ser atualizado quando as fontes ou seus papéis mudarem.

## Onde registrar mudanças

- Contrato consumido, limite entre contextos, padrão compartilhado ou
  comportamento transversal de UI: `frontend-module-architecture.md`.
- Fluxo, estado visual, capacidade ou contrato específico de um módulo:
  documento vigente desse módulo; se não houver e o conhecimento for durável,
  crie um documento curto em `docs/` somente quando o arquivo transversal não
  for uma fonte adequada.
- Regra de negócio autoritativa: documentação do MFBackend. No Frontend,
  registre apenas o comportamento de apresentação e o contrato consumido.
- Procedimento de produção, verificação ou recuperação:
  `deploy-production.md` e, quando executável, o script correspondente.
- Novo gate obrigatório: comando executável em `package.json`, quando aplicável,
  e referência curta no `AGENTS.md`. Não mantenha uma matriz paralela enquanto
  testes e gates continuarem descobríveis dessa forma.

## Precedência e divergências

Dentro de cada assunto, prevalece a fonte canônica indicada acima. Um documento
de módulo prevalece para detalhes daquele módulo; a arquitetura transversal
prevalece para padrões compartilhados. O runbook prevalece em operação. README,
AGENTS, índices, comentários e documentos históricos apenas orientam e não
substituem a fonte especializada.

Se duas fontes canônicas cobrirem o mesmo escopo de forma incompatível, ou se
documentação, implementação e testes divergirem, não escolha uma versão por
conveniência. Confirme vigência, autoria e evidências, registre a divergência
quando necessário e corrija somente a fonte cuja autoridade foi comprovada.

## Histórico

Conteúdo histórico deve ser identificado com data e status, separado do estado
vigente e ligado à fonte canônica atual. Não apague históricos para resolver
duplicação. Não existe diretório histórico obrigatório hoje; crie
`docs/historico/` apenas se o volume justificar, sem promover planos, sprints ou
checkpoints antigos a regras atuais.

## Impacto e fechamento

Toda entrega deve encerrar com uma classificação:

```text
DOCUMENTATION_IMPACT: NONE | UPDATE_REQUIRED
```

Use `UPDATE_REQUIRED` quando mudar comportamento durável de UI, contrato
consumido, limite arquitetural, procedimento operacional, gate obrigatório ou a
localização/autoridade de uma fonte. Atualize na mesma entrega apenas a fonte
canônica afetada e este roteamento se a descoberta tiver mudado.

Use `NONE` quando não houver mudança de conhecimento durável, como refatoração
interna sem efeito material, teste que somente cobre regra já documentada ou
correção editorial. `NONE` não é válido se uma fonte vigente ficar falsa,
incompleta ou difícil de localizar.

No fechamento de sprint ou entrega, registre a classificação no resumo do
trabalho, atualize as fontes exigidas, valide os links tocados e execute
`git diff --check`. Informe os gates executados e os não executados. Não crie um
diário de sprint permanente salvo quando houver necessidade documental própria.
