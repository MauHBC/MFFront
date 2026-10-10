# WhatsApp integrado à Agenda — prévia local

## Correção da revisão autenticada — 10/10/2026

Referências reais relidas antes de editar: AGENTS.md e fluxo/checklist de
`docs/frontend-module-architecture.md` da worktree a5fbc9a, confrontados com
MFFrontend principal (último commit documental 4ca4727 e checklist local ainda
não commitado). A worktree já contém o fluxo obrigatório e a extensão aprovada
AgendaDrawerShell; não foram incorporadas alterações alheias. Referências de código:
`AppShell/navigation.js`, `Agendamentos/index.js`, `agendaDrawerComponents.js`,
`AppDrawer`, `AppForm`, `AppButton`, `AppToolbar`, `AppTable` e tokens.

Decisão: reusar o drawer compacto vigente, X, foco, Escape, backdrop, dirty-state,
campo date de AppForm e botões/toolbar; estender somente o conteúdo de lembretes.
Nenhum styled-component ou override novo. O detalhe de eventos compõe HTML details
com controles existentes; não há outra página/drawer para o cliente.

WhatsApp não aparece no menu principal clínico. A entrada fica em Agenda >
Lembretes WhatsApp; permissões e configuração do módulo no Platform Admin
permanecem intactas. O painel abre na data selecionada, oferece data/Hoje/Amanhã e
consulta somente o dia civil de São Paulo pelo endpoint canônico de sessões.
O período do painel independe da pesquisa de paciente da Agenda, com contexto
visível. Respostas antigas são descartadas ao trocar data, fechar/reabrir ou
mudar autorização. Loading, vazio e erro/retry não autorizam envio.

Diagnóstico read-only na Modelo: atendimento 97 tinha quatro IDs de lembretes,
quatro revisões distintas e quatro tentativas distintas; 98 tinha três de cada.
A API repete a confirmação vigente por lembrete; não eram quatro cópias do mesmo
registro/evento. A UI consolida exclusivamente por ID de atendimento e mostra a
confirmação vigente uma vez. Preserva cada envio/tentativa e os eventos técnicos
no histórico expansível. Nunca reúne por paciente, telefone ou data, nem apaga dados.
O mutex síncrono impede comandos concorrentes por clique repetido; a confirmação
persistente da mesma revisão continua idempotente no Backend (gate MariaDB anterior).

Na prévia local, administrador com manage pode expandir o histórico de um lembrete
aceito e aplicar uma resposta simulada; o controle fica dentro do drawer. O modo
simulado do servidor e a flag local/loopback são cumulativos. Build normal não
expõe os controles. Nenhuma chave, Meta, permissão ou atendimento real foi alterado.

Evidências de referência: tela autenticada de http://127.0.0.1:3020/agendamentos,
Chrome 2018579851. Desktop observado 1536x711: AppDrawer 440px, header 16px 20px,
body 16px 20px 20px, título Khula 24px; X 17.6px com padding 1px 6px.
Referência móvel: override solicitado 390x844, viewport CSS efetivo 312x675 por zoom,
drawer 280.8px (90vw), mesmo padding/tipografia. Capturas reais inspecionadas.
As quatro imagens Library não foram inspecionadas: o helper de materialização
falhou no Windows por ausência de os.setxattr; nenhum download foi apresentado
como artefato qualificado. Usou-se a tela autenticada real conforme a alternativa autorizada.

Gates da correção: 58/58 testes focados em cinco suítes (drawer, histórico, flag,
menu e integração App Shell). Incluem quatro envios, múltiplos atendimentos,
repetição de clique/reabertura, HTTP atrasado, dia, atualização por poll, erro,
contato, permissões e descarte. Lint focado, mojibake e diffcheck PASS; aviso de Browserslist preexistente.
Build separado e DOM do bundle atualizado aguardam janela CPU de Monitoramento;
não declarar esta correção disponível no servidor antes desses gates.
DOCUMENTATION_IMPACT: UPDATE_REQUIRED.

## Histórico anterior

Retomada Modelo 10/10: ferramentas existentes de cenários são reutilizadas no build
local `build-whatsapp-preview`, com `REACT_APP_WHATSAPP_SIMULATION_PREVIEW=true` e
`BUILD_PATH=build-whatsapp-preview`. O gerador de versão recusa a flag em outro destino.
O bundle normal permanece separado. A rota exige host loopback, gerenciamento WhatsApp,
administrador e configuração simulada retornada pelo servidor. O backend mantém a
negação em produção. Não há alteração do desenho da Agenda; o painel mantém revisão,
consentimento e aviso de simulação. A rota auxiliar é `/whatsapp-cenarios`.
Referências reaproveitadas: `WhatsAppReminders`, `WhatsAppScenarioTools`, `AppShell`,
`MyRoute` e tokens existentes. Gates e revisão técnica da prévia combinada pendentes;
aprovação visual cabe exclusivamente ao Maurício.

DOCUMENTATION_IMPACT: UPDATE_REQUIRED. O painel `WhatsAppReminders` usa a API autenticada,
seleção de atendimentos visíveis na Agenda, revisão de mensagem/destinatário e confirmação
explícita antes de enfileirar. Permissão de leitura acompanha; gerenciamento respeita
contexto canônico; registro de autorização de contato exige administrador e ação explícita.
Resultado incerto não oferece retentativa. A troca de clínica fecha o painel e descarta
respostas HTTP pendentes do contexto anterior.

Regras, persistência, segurança e limites têm fonte única no MFBackend:
`docs/arquitetura/whatsapp-piloto-local.md`. A integração Meta permanece bloqueada.

Perfil fechado `MOTRIA_LOCAL_STACK_SLOT=whatsapp-pilot`: Frontend loopback3050,
Backend descartável3056. Execute npm ci nesta worktree e npm run dev com BROWSER=none.
Acesse http://127.0.0.1:3050/agendamentos, autentique-se na conta local fictícia
mauricio.preview@example.test e use Lembretes WhatsApp. Há Ana Costa e Bruno Lima,
com autorizações explícitas fictícias e atendimentos futuros na Clínica Horizonte.
A senha local é definida pelo runner Backend, sem credenciais reais.

Ferramentas técnicas ficam separadas em http://127.0.0.1:3050/whatsapp-cenarios.
Antes de confirmar o envio na Agenda, escolha resultado enviado/falha/incerto; depois
simule entrega, confirmação, indisponibilidade, interrupção ou texto livre. Para resposta
obsoleta, remarque o atendimento na Agenda e responda ao lembrete antigo nessa ferramenta.
A rota e o módulo de cenários não entram no bundle de produção; a API também exige
ambiente local/test, provedor simulado, banco descartável e administrador.
Não há qualquer envio externo. A interface clínica mantém linguagem normal por ajuste
de UX da coordenação; simulação e controles de teste ficam fora do fluxo assistencial.

Validação técnica: 186/186 testes em 10 suítes da Agenda, incluindo revisão obrigatória,
resultado incerto, perfil de leitura e descarte de resposta após troca de clínica;
build de produção e lint focado PASS. Ferramenta técnica ausente no JavaScript produzido.
Warnings preexistentes React act/Browserslist não foram corrigidos nesta sprint.
A validação visual é exclusivamente de Maurício.

O gate final usou --silent --testTimeout=15000. Uma repetição anterior teve dois
timeouts de cinco segundos em casos existentes de cancelamento; os três casos
envolvidos passaram isoladamente no limite original. Após ajustar a guarda ao
contexto real de autorização (sem pressupor clinic_id), o painel passou 4/4.

## Correção do acesso direto da prévia — 09/10/2026

Causa comprovada: connect-history-api-fallback do CRA recusava rotas internas
quando Accept estava ausente/vazio ou preferia application/json. Esses GETs
retornavam 404; com text/html ou */* a entrada React era servida. Além disso,
static/missing.js retornava HTML200 quando o fallback aceitava HTML.

`src/setupProxy.js` registra `scripts/lib/local-preview-routing.cjs` somente
com efeito no slot whatsapp-pilot em development. Raízes canônicas da aplicação
servem index.html para GET/HEAD direto, independentemente de Accept. API não é
reescrita; pedidos de arquivos deixam o handler estático responder e impedem
fallback HTML em recursos ausentes. Outros slots e produção permanecem sem
esse comportamento. Acesso não substitui autorização: as rotas React e API
continuam protegidas. Nenhum processo ou porta das outras sprints foi alterado.

Gates:13/13 PASS em `npm run test:local-development -- tests/local-preview-routing.test.cjs`;
38/38 verificações HTTP no servidor real, incluindo root/login/Agenda/cenários,
quatro Accepts, query, HEAD, bundle existente, API404 autenticada e assets404.
Menu/pacientes/configurações também verificados com Accept vazio:200 com React.
Lint focado e diffcheck PASS. No Chrome, login fictício realizado, navegação direta
à Agenda e refresh confirmados com sessão mantida, Agendamentos e Lembretes WhatsApp
presentes. Verificação técnica de acesso; avaliação visual permanece com Maurício.


## Módulo por prestador (extensão local de 09/10)

O menu WhatsApp e o botão na Agenda dependem do contrato canônico de autorização 9:
permissão individual WhatsApp + Agenda e `available: true`, catálogo de disponibilidade 1.
Não existe flag comercial no navegador. Os contratos 7/8 continuam compatíveis com oito
módulos e não habilitam WhatsApp; versões desconhecidas falham fechados. O editor de
perfis usa o catálogo da API, incluindo WhatsApp view/manage e alcance own/clinic.
A autorização de contato continua explícita e independente da disponibilidade comercial.

`/whatsapp` abre o painel já integrado à Agenda. A entrada direta também exige Agenda;
endpoints do servidor e worker revalidam disponibilidade e interseção de permissões.
O Platform Admin configurará o tenant na aba Módulos; desligar interrompe itens pendentes
e reativar não retoma backlog. `blocked_module` explica o encerramento no histórico.
A disponibilidade não ativa a Meta e não equivale à aprovação final da UX.

Prévia: http://127.0.0.1:3050/whatsapp. Cenários separados em
http://127.0.0.1:3050/whatsapp-cenarios; administração em http://127.0.0.1:3057/clinicas/4.
Somente simulação com dados fictícios, sem credenciais ou chamadas reais.


A rota WhatsApp usa somente o App Shell vigente, sem montar a navbar legada.
O hostname público reconhece essas rotas como internas, sem expor o aplicativo clínico.
Na conferência técnica de 09/10, o módulo desativado não apareceu na Agenda e a API
retornou 403. Reativar não reaplicou a revisão anterior: `blocked_module`, zero tentativas
e confirmação HTTP 403. O módulo do tenant fictício fica desligado ao final; habilitá-lo
na aba Módulos permite revisar a experiência simulada. Nenhuma habilitação comercial
liga o transporte real.


Fechamento técnico: 99/99 testes em sete suítes pertinentes; oito regressões selecionadas
da Agenda, launcher 11/11, build, lint focado e UTF-8 aprovados. Após a reconexão, a
execução integral inicialmente teve 126 aprovados e oito timeouts de 5.000 ms (463,744 s).
O recorte desses oito teve sete aprovados e um timeout; o caso restante também falhou
sozinho e passou em diagnóstico separado com o componente WhatsApp substituído por null.
O painel agora só monta seus estados e efeitos após disponibilidade e permissão válidas.
Sem alterar testes ou timeouts, a nova execução integral aprovou 134/134 (216,03 s),
registrada em `whatsapp-agenda-complete-inert-20261009.log`. O diagnóstico não prova uma
causa exclusiva para todos os timeouts; o resultado aprovado pertence à execução completa
da branch após a correção. Os seis testes do painel também passaram.
Lint do componente alterado, UTF-8, build e diffcheck passaram. Uma invocação adicional
de lint incluindo o teste do painel apontou `no-nested-ternary` preexistente no mock de
`WhatsAppReminders.test.js:15`; esse arquivo e a suíte da Agenda não foram alterados.
`DOCUMENTATION_IMPACT = UPDATE_REQUIRED`: este guia e frontend-module-architecture.md.

A promoção para catálogo 9 também preserva o contrato de histórico de unidades de pacote:
sete casos selecionados de autorização/cancelamento em 8/9 PASS, sem alterar as regras
de pacote ou financeiro.

## Drawer compartilhado com Novo agendamento

`AgendaDrawerShell` em `src/pages/Agendamentos/agendaDrawerComponents.js` foi extraído
do markup real de Novo agendamento. Ambos os consumidores usam o mesmo `AppDrawer`
de `src/components/AppDrawer/index.js`, cabeçalho, corpo e X; o shell não conhece APIs,
permissões, pacientes ou comandos. A estrutura paralela de WhatsApp (painel de 680 px,
backdrop e cabeçalho próprios, botão Voltar à Agenda) foi removida. Botões, campos e
tabela usam AppButton, AppForm e AppTable; ações longas podem quebrar linha com `$wrap`.

O shell recebe abertura, título/subtítulo, conteúdo e callback de fechar. WhatsApp usa
a variante compacta de Novo agendamento, rótulo acessível/ref para foco e desabilita o
X durante comandos. `useDrawerInteraction`, no AppDrawer, mantém foco com Tab, oferece
Escape, trava scroll externo e restaura o foco/scroll ao sair. X, backdrop e Escape
passam pelo mesmo guard: seleção, revisão ou edição de opt-in pendente usam o
`UnsavedChangesDialog` existente. Continuar editando preserva os dados; descarte é
explícito. Operação em curso impede fechamento. Revogação de acesso/contexto continua
fechando o painel imediatamente para impedir vazamento entre tenants.

Na comparação técnica de 09/10 no Chrome, Novo agendamento e WhatsApp apresentaram
440 px de largura, topo em 52 px, altura de 704 px naquela janela, cabeçalho 16px 20px,
corpo 16px 20px 20px, título 24px/peso 700 e X de 29,6×24,4px. Ambos mantêm o limite
responsivo de 90vw. O botão Revisar envio mediu 35,6px de altura. Não é aprovação visual.
X/Escape/backdrop limpos, guard de seleção e restauração de foco/scroll foram conferidos
no navegador sem criar revisão ou enviar. A sessão e as configurações do usuário foram
preservadas; o Admin3057 foi conferido sem ativação/desativação adicional.

Gates deste ajuste: 18/18 testes do painel; 38 casos pertinentes em três suítes dos
consumidores (121 fora do recorte), 63,573 s, incluindo 19 casos de Agenda e a rota
integrada. Lint de todos os arquivos alterados, UTF-8, build e diffcheck passaram.
A suíte integral 134/134 acima pertence ao fechamento anterior à extração deste shell;
não foi repetida neste ajuste de UI. Logs `whatsapp-shared-shell-consumers-20261009.log`
e `whatsapp-shared-shell-final-{tests,lint,encoding,build}-20261009.log`.

## Complemento de revisão técnica mobile — 09/10/2026

Checklists oficiais consultados via Git: workspace `eea4300d:AGENTS.md`,
Frontend `352ffa09:AGENTS.md` e `docs/frontend-module-architecture.md`,
Platform Admin `a05ad588:AGENTS.md` e `README.md`. Esses MD não foram sincronizados
sobre candidatos em teste; incorporar de forma controlada antes de eventual merge.
Nenhuma mudança de produto neste complemento. Reuso efetivo do mesmo
`AgendaDrawerShell`/`AppDrawer` verificado nos dois consumidores, com medidas
no Chrome da prévia 3050, worktree WhatsApp, código Frontend `a1316e5`.

| Medida CSS | Novo agendamento | Lembretes WhatsApp |
| --- | --- | --- |
| Viewport 390 × 844: drawer | 351,35 × 792 px | 351,35 × 792 px |
| Topo | 52 px | 52 px |
| Cabeçalho em 390 px | 77,2 px; padding 16px 20px | 77,2 px; padding 16px 20px |
| Corpo em 390 px | 714,8 px; padding 16px 20px 20px | 714,8 px; padding 16px 20px 20px |
| Título | 24px; peso 700 | 24px; peso 700 |
| X | 29,6 × 24,4 px | 29,6 × 24,4 px |
| Viewport 320 × 844: drawer | 288 × 792 px | 288 × 792 px |
| Cabeçalho em 320 px | 115,6 px, texto quebra linha | 115,6 px, texto quebra linha |

Sem overflow horizontal no documento, drawer ou corpo em ambos os viewports;
o corpo mantém scroll interno `auto`. Fundo branco e borda/padding do shell
compartilhados. Deslocamento horizontal de 12 px entre as capturas em 390 px:
WhatsApp bloqueia o scroll externo e elimina a reserva do scrollbar; Novo
agendamento conserva o comportamento anterior. Não há largura paralela.
O navegador usa escala 1,25: override físico 488 × 1055 corresponde ao viewport
CSS observado de 390 × 844; 400 × 1055 corresponde a 320 × 844. Medidas usam
`getBoundingClientRect` e `getComputedStyle`, não dimensões presumidas da captura.

WhatsApp: foco inicial no X; Tab e Shift+Tab contidos no drawer quando o botão
de revisão está desabilitado; X, backdrop e Escape fecham; foco retorna ao
botão Lembretes WhatsApp; overflow do body restaura ao valor anterior. Reabertura
conferida. Estado vazio e histórico fictício não causaram overflow. Nenhuma revisão,
tentativa, autorização de contato ou alteração de módulo foi criada nesta etapa.

Lacuna preexistente da referência: Novo agendamento não move o foco inicial do
opener e Escape não fecha o drawer; X fecha. O hook de interação é opt-in do
WhatsApp, como documentado acima. Não declarar paridade integral desses handlers
nem expandir a sprint para alterar o fluxo original. A avaliação visual final
continua sendo exclusivamente do Maurício.

Capturas: `motria-mobile-agenda-390.jpg`, `motria-mobile-whatsapp-390.jpg`;
medidas: `motria-whatsapp-mobile-metrics-20261009.json`, na pasta temporária do
executor. Viewport temporário restaurado ao terminar, sessão fictícia preservada.
Nenhuma suíte pesada executada neste complemento. Gate integral pós-shell:
134/134 PASS, 1 suíte, 184,921s, sem ampliar timeouts, em
`whatsapp-agenda-after-shared-shell-20261009.log`.

A API/worker vivos em 3056 ainda carregam a versão anterior ao complemento
Backend `0c98168`. Esta inspeção valida o drawer servido, não o novo adaptador
Meta por essa API. O adaptador permanece exclusivamente offline e envio real
bloqueado. Não houve configuração de credenciais, alteração Meta ou envio.
`DOCUMENTATION_IMPACT = UPDATE_REQUIRED`: evidência técnica atualizada nesta fonte.

### Prévia isolada preservável — 10/10/2026

MOTRIA_LOCAL_STACK_SLOT=whatsapp-preserved seleciona somente endpoints locais fechados. Frontend 3060 e API 3066. Launcher 12/12 PASS. Clínica Aurora fictícia, sem modificar a prévia whatsapp-pilot anterior. Interface e componentes compartilhados permanecem iguais.

### Qualificação sobre a main publicada — 10/10/2026

Base integrada e6c5af4edd8b368dc9c2d417fab5731cf9e4fed3. Preservados o menu
publicado de Relatórios, Painel oculto e launchers clínico/relatórios. Sem
redesenho ou alteração do drawer WhatsApp já aceito. O acesso direto corrigido
agora cobre os dois slots fechados WhatsApp; API e assets ausentes conservam
seus erros. Gate launcher/routing 18/18; contratos/menu/painel/rotas/paciente
115/115 em cinco suítes; Agenda/Equipe/drawer 182/182 em três suítes, sem
alterar timeouts. Lint de todos os JS/CJS do candidato contra main PASS;
mojibake e UTF-8 PASS. Testes de HTTP da prévia declaram express 4.21.0 e
connect-history-api-fallback 2.0.0 como devDependencies diretas, versões
já presentes no lock/node_modules, licenças MIT; nenhuma atualização de
transitivo ou dependência de produção acrescentada.

A prévia preservada 3060/3066/3067 permanece parada até atualização aditiva do
schema do seu banco próprio. A revisão automática não aceitou essa mutação
com a autorização disponível. Não recriar/reseed/resetar a fixture, trocar
senha ou gerar novas chaves; a retomada deve usar o contexto DPAPI existente.
Build de produção e conferência da versão/bundle servido são gates separados;
prévia não foi declarada acessível nesta etapa.

Complemento do gate de produção: o agrupamento da rota técnica em AppShell
também exige development; sua string não deve permanecer no bundle otimizado.
Regressão de rotas 9/9 PASS após esse ajuste. Build inicial e07ffac PASS;
o build do novo commit é conferido novamente para ausência da rota/código
de cenários. Isso não muda os componentes clínicos aprovados.

Build final 1c6aa5549467ec77b84e7e51ca92841be7176208 PASS. Bundle
main.f9a69c33.js, SHA-256 a5b7c33321cd141fa61cbddd4f08c803058cb43a9f39d9136ad8bc393dc8d8b7.
Ausentes rota, título e chamada de API do simulador nos JS de produção.
Assets/commit identificados em build/app-version.json. Build não foi servido:
retomada da prévia e publicação de drafts dependem das aprovações operacionais
registradas no checkpoint canônico Backend. Sem nova revisão visual requerida.
