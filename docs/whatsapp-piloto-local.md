# WhatsApp integrado à Agenda — prévia local

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
