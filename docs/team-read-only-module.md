# Equipe — pessoas, acessos, perfis e atribuições

O módulo autenticado `/equipe` usa exclusivamente contratos tenant-scoped do
backend. `AuthorizationProvider` consulta `/team/authorization-context` em
memória após o login; não persiste autorização em `localStorage` e falha
fechado. O item Equipe aparece no App Shell somente para Administrador
estrutural que possua `access_profiles.manage`.

A página consulta pessoas, perfis, catálogo, atribuições e contas vinculáveis.
As junções de apresentação usam `person_id`, `profile_id` e o sujeito oficial da
autoridade atual: `user_id` no legacy ou `membership_id` no modo membership.
Conta sem pessoa permanece um estado distinto. Profissional histórico sem acesso
é exibido como vínculo incompleto e não recebe o fluxo genérico de criação de conta.

O fluxo de pessoas reutiliza somente os contratos oficiais para:

- criar pessoa sem conta de acesso;
- criar profissional com e-mail, dados profissionais, acesso canônico e perfil
  nativo na mesma operação;
- editar nome, e-mail e telefone;
- reativar somente a pessoa, sem reativar profissional ou conta.

Os payloads nunca incluem `clinic_id`, senha, grupo ou autoridade. O marcador de
profissional solicita ao backend o caso de uso completo; o frontend não monta
conta, membership nem atribuição por conta própria.
Ao marcar Profissional em “Nova pessoa”, o formulário revela profissão e CREFITO
com as validações canônicas. “Conferi os dados profissionais” começa desmarcado:
é uma declaração administrativa, não uma consulta automática ao conselho. Sem
confirmação, o cadastro segue com verificação pendente; o backend revalida a
autorização antes de aceitar uma confirmação explícita. Credencial e verificação
continuam exibidas como estados independentes.
O formulário preserva valores após erro, bloqueia envio duplicado e confirma o
descarte de alterações pendentes. O drawer de permissões continua estritamente
somente para consulta.

O fluxo de perfis permite criar e editar perfis personalizados e atribuir um ou
vários perfis a contas existentes. Administrador e Profissional são
exibidos como nativos e bloqueados para edição, conforme o contrato oficial.
Pessoa sem conta não recebe controles de atribuição. Profissional histórico com
vínculo incompleto só pode ser reconciliado pelo fluxo de Dados profissionais. Módulos,
níveis, escopos, exportação e capacidades são renderizados a partir do catálogo
recebido; o frontend não calcula permissões efetivas. A composição exibida vem
do backend, que usa o resolvedor oficial.

Cada inclusão ou remoção é enviada aos endpoints tenant-scoped já existentes.
Inclusões são processadas antes de remoções, e cada operação é transacional,
auditada e preserva a proteção do último Administrador. Legacy invalida
`auth_version`; membership invalida somente `access_version` do vínculo alvo.

O catálogo recebido define módulos, combinações, capacidades, dependências e
poderes exclusivos. O frontend mantém somente rótulos de apresentação em
português; não replica a matriz de autorização nem decide permissões clínicas.
O backend continua como autoridade final.

Todos os módulos do App Shell usam esse mesmo contexto oficial. Sidebar,
atalhos e guards de URL exigem o nível do respectivo módulo; configurações
também exigem a capacidade específica. Durante `loading`, em `invalid`,
`no_permissions`, `403` ou erro de carregamento, o componente protegido não é
montado.

O carregamento do contexto é vinculado ao estado autenticado, ao usuário e ao
token atuais por uma geração opaca. Logout ou troca de identidade fecha o App
Shell imediatamente e invalida respostas pendentes; sucesso ou erro atrasado de
uma sessão anterior nunca substitui o contexto da sessão atual.

Agenda usa os contratos reduzidos `/schedule/references/*` e não consulta os
diretórios amplos `/patients` e `/users`. O frontend não implementa nem replica
o resolvedor: apenas interpreta o resultado fechado entregue pelo backend.

No modo legacy, o fluxo de contas gerais permite, somente para pessoa ativa já
cadastrada:

- criação de conta com e-mail global e senha inicial manual;
- redefinição de senha;
- bloqueio e desbloqueio explícitos;
- exibição separada dos estados da pessoa e da conta.

No modo membership, criação/vínculo envia somente o e-mail, aceita identidade
global existente e pode deixar o acesso em `pending_credential`. A interface não
solicita senha inicial nem oferece redefinição administrativa. Identidade nova
recebe uma intenção transacional de primeiro acesso pelo Backend; a interface
não afirma que houve envio ou entrega, e a recuperação fica disponível na tela
pública de login. Bloqueio e desbloqueio atuam somente no membership da clínica
ativa.

Os formulários não enviam `clinic_id`, preservam os campos depois de conflito e
bloqueiam duplo envio. Redefinição, bloqueio e desbloqueio exigem confirmação.
Criar uma conta geral não cria profissional, grupo, perfil ou permissão; as
atribuições adicionais continuam no drawer de perfis. O cadastro profissional,
por sua vez, recebe automaticamente o perfil nativo Profissional pelo backend.
Vínculo marcado como
inválido pelo backend não oferece mutações na interface.

A entrega de contas não oferece exclusão, convite ou edição de perfis nativos.
A seleção de clínica fica exclusivamente no cabeçalho global, usa a lista do
Backend e nunca é inferida por e-mail ou domínio público. Os guards melhoram a
experiência; o backend continua responsável pelo enforcement autoritativo.

Para atuação profissional ativa, o drawer de inativação só aparece quando o
contexto oficial informa a disponibilidade do fluxo e
a capacidade `professionals.lifecycle.manage`. O operador escolhe entre:

- transferir sessões, recorrências, responsabilidades, rascunhos e mudanças de
  plano para um profissional ativo e autorizado da mesma clínica; ou
- cancelar sessões futuras tratáveis, encerrar recorrências e responsabilidades
  e preservar os registros históricos.

Antes da confirmação, a interface exige motivo, solicita a prévia oficial e
mostra contagens e bloqueios retornados pelo backend. Qualquer mudança na
intenção descarta a prévia; mudança concorrente, token expirado ou divergente
exige uma nova prévia. A confirmação possui checkbox explícito, chave de
idempotência e proteção contra duplo envio. O resultado distingue itens
cancelados, transferidos e preservados.

O frontend apenas apresenta destinos elegíveis e o contrato recebido. Tenant,
autoridade, permissões, conflitos, último Administrador e estado operacional
são revalidados pelo backend dentro da transação. Com o default seguro da flag,
a ação profissional permanece oculta e as rotas permanecem indisponíveis.

O histórico administrativo é somente leitura. A seção
consulta `/team/audit-events` sem enviar `clinic_id` e oferece filtros por
período, ator, ação e pessoa. A paginação usa exclusivamente os cursores opacos
do backend; o frontend não calcula offsets nem interpreta identidade tenant.

Rótulos de ação, resultado e campos de antes/depois vêm do contrato oficial. A
interface nunca renderiza `metadata` ou JSON arbitrário e não mantém um catálogo
paralelo de eventos. Os estados de carregamento, vazio, erro, filtros aplicados,
sucesso e detalhes sanitizados são explícitos. Não existe controle para criar,
editar ou excluir auditoria, e abrir a consulta não registra um novo evento.
