# Arquitetura do MFFrontend

Este documento é a fonte oficial para a landing pública, seus contextos e os
padrões dos módulos autenticados.

## Recebido e pago e Distribuição no Financeiro

A Visão geral possui as abas separadas “Recebido e pago” e “Distribuição”,
montadas e consultadas somente para `useAuthorization().isAdministrator === true`.
Os painéis anuais e o modal de configuração da Distribuição reutilizam os
componentes locais. A remoção do botão de mostrar/ocultar e da máscara de valores
abrange **todo o Financeiro**: Visão geral, Receitas e Despesas, incluindo
Recebido e pago e Distribuição. Isso inclui indicadores, tabelas, gráficos,
históricos e modais, não somente Receitas.
Essa decisão é exclusivamente de apresentação: não altera permissões,
capacidades, isolamento por clínica/paciente ou as restrições de Administrador,
nem autoriza acesso a dados financeiros antes restritos. A autorização continua
sendo validada pelo Backend, independentemente da visibilidade dos valores.
Trocas de aba, ano, contexto
oficial ou token desmontam o estado privado;
respostas atrasadas são descartadas. Conflito de gravação recarrega a configuração
para nova edição, sem reaplicar o comando. A UI valida participantes, mas exibe
os totais e rateios entregues pelo Backend. Não há gráfico ou tela de histórico.
Semântica e contratos permanecem em
[FIN-014/015 do Backend](https://github.com/MauHBC/MFBackend/blob/main/docs/regras-negocio/financeiro.md#fin-014--recebido-e-pago).

## Despesas operacionais

A lista exibe “Pago em DD/MM/AAAA” para toda despesa paga, inclusive quando
pagamento e vencimento caem no mesmo dia. Os valores monetários pré-preenchidos
nos formulários de despesas e recebimentos vêm dos centavos da API sem mudança
de escala; salvar sem editar o valor preserva os centavos originais.

A exclusão de despesa aberta exige confirmação, sem campo de motivo. Despesas
pagas oferecem desfazimento como ação separada; a exclusão só fica disponível
depois de reabrir a ocorrência. A confirmação de recorrência informa que apenas
a ocorrência selecionada será removida. As ações respeitam o contexto oficial
de autorização da sessão atual.

No cadastro, “Já foi paga? = Sim” usa somente
`POST /clinic-expenses/with-payment`, com dados da obrigação e objeto `payment`.
Falhas mantêm o formulário, sem criar ou compensar por chamadas separadas.
Cadastro e baixa compartilham campos de confirmação e motivo para quitação
ajustada. Cadastro recorrente pago mostra em vermelho “Somente a primeira
despesa será marcada como paga.”; futuras permanecem abertas. A opção Sim e as
ações de pagamento exigem gestão financeira e `finance.settle`.
As regras autoritativas estão na
[FIN-008 do Backend](https://github.com/MauHBC/MFBackend/blob/main/docs/regras-negocio/financeiro.md#fin-008).

## Landing pública multi-tenant

- O backend resolve o tenant pelo `Host` e entrega
  `/api/public/clinic-context`; o frontend não escolhe clínica por `clinic_id`.
- A landing normal lê somente `clinic_public_profiles`. Rascunhos não participam
  desse endpoint.
- Uma URL com `landing_preview` e `clinic_id` no fragmento usa o endpoint
  temporário de prévia. O token é somente leitura, expira e ativa `noindex`; a
  prévia não altera o perfil publicado.
- O perfil publicado no banco prevalece. `src/config/clinicPublicProfiles.js`
  é compatibilidade transitória e apenas completa campos ausentes.
- Banner, Estrutura/unidades/contato, Serviços, Sobre/diferenciais e Rodapé são condicionais:
  campos vazios não devem criar blocos ou espaços vazios.
- O contrato normalizado expõe separadamente `bannerImage`, a galeria `images`,
  `heroPresentation` e `secondaryAction`. A composição mantém o cabeçalho no
  fluxo, usa `bannerImage` em um banner estático e apresenta `images` na seção
  integrada de Estrutura/unidades/contato imediatamente abaixo. Perfis antigos
  usam a primeira imagem disponível como banner e recebem defaults visuais
  seguros.
- Uma coleção `hero_image_urls` explicitamente vazia não reaproveita a imagem
  legada na galeria inferior; o fallback legado continua válido para o banner.
- Assets legados `/assets/...` e mídias opacas `/api/public/media/...` devem
  coexistir. Não copie nem remova assets de clientes por inferência.
- `PublicClinicContext` atende a landing; `ClinicContext` atende a aplicação
  autenticada. O domínio público não substitui o tenant da sessão.
- Em produção, a API é `/api` same-origin e o bundle não contém localhost. Em
  desenvolvimento, o contrato padrão usa Frontend em `127.0.0.1:3000` e Backend
  em loopback na porta `3006`. A validação persistente preparada pode selecionar
  somente `MOTRIA_LOCAL_STACK_SLOT=persistent-validation` em `.env.local`; esse
  marcador ignorado pelo Git fixa `127.0.0.1:3000` e API
  `127.0.0.1:3006`, sem aceitar endpoints livres. A validação combinada isolada
  pode selecionar
  somente o perfil fechado `MOTRIA_LOCAL_STACK_SLOT=combined-validation`, que
  usa `127.0.0.1:3010` e API `127.0.0.1:3016`; o launcher continua recusando
  endpoints remotos, portas avulsas, persistência de qualquer outro perfil em
  `.env*` e slots desconhecidos.
- `npm run dev` impõe esses destinos locais e recusa overrides remotos em
  variáveis de processo ou arquivos `.env*`; worktrees não exigem `.env` manual.
  No perfil persistente já preparado, o comando não cria nem atualiza banco ou
  fixture; reiniciar o Frontend não altera dados.
  Para subir a validação combinada sem abrir o navegador, use no Git Bash:
  `export MOTRIA_LOCAL_STACK_SLOT=combined-validation`, depois
  `export BROWSER=none` e `npm run dev`. A URL é `http://127.0.0.1:3010`.

### Registro modular da landing

O documento `public_profile.landing_sections` com `schema_version: 1`, já
normalizado pelo Backend, é o contrato oficial de composição. O registro em
`src/components/PublicLanding/publicLandingModules.js` reconhece somente o
catálogo fechado e preserva a ordem fixa: Hero, Gallery, What is, Landing
Services, Differentials, Audience, Conversion, About, Approach, Professionals,
Testimonials, Contact e Footer. Chaves desconhecidas não criam componentes.

Hero e Footer são estruturais. Os demais módulos precisam estar habilitados e
ter conteúdo efetivamente visível. Seções vazias ou desabilitadas não reservam
espaço nem entram na navegação. O navegador não reconstrói o documento legado;
campos legados projetados pelo Backend continuam alimentando os componentes
visuais existentes durante a transição.

No Hero, `heroPresentation.contactIcons` renderiza apenas links de ícone para
Instagram e WhatsApp, visualmente secundários ao CTA principal. A visibilidade
vem de `sections.hero.content.presentation.contact_icons`; os destinos continuam
em `contact_instagram` e `contact_whatsapp` projetados pelo Backend. Um destino
ausente nunca gera link vazio, o bloco não reserva espaço quando nenhum ícone é
renderizado e documentos antigos mantêm Instagram visível quando já havia link
publicado.

Cada chave possui um componente independente na ordem do catálogo. Gallery usa
`#gallery` logo depois do Hero; Contact usa `#contact` no fim. About contém
somente o conteúdo institucional, imagens e a subseção `origin` ("Como
surgiu"), enquanto Differentials mantém seus próprios cards. `what_is`,
`audience`, `conversion`, `approach`, `professionals` e `testimonials` usam os
campos estruturados do contrato, sem HTML arbitrário. Profissionais e
depoimentos são novamente filtrados no navegador por `visible` e
`editorial_authorized`, além da projeção pública do Backend. Não existe feature
flag, ordenação livre ou segundo renderizador permanente.

Gallery interpreta `content.layout` como `horizontal` por padrão. Em
`vertical`, usa fotografias 4:5 e, quando `what_is` também estiver visível,
compõe os dois módulos em uma única seção (Galeria primeiro no mobile), sem
renderizar `what_is` novamente. Galeria sem imagem não reserva espaço e mantém
`what_is` como seção independente.

A navegação principal continua reduzida a Início, Estrutura, Serviços, Sobre e
Contato, cada item condicionado ao respectivo módulo efetivamente visível.

Módulos editoriais recebem `background_variant` somente pelo catálogo fechado
`default`, `neutral`, `brand_soft` e `brand_solid`. A primitiva pública central
normaliza valores desconhecidos para `default`, deriva superfícies da identidade
do tenant e escolhe texto claro ou escuro para `brand_solid`; a API nunca fornece
cores, classes ou CSS livres. Hero, Conversion e Footer preservam suas
composições especializadas. `about.content.origin.background_variant` controla
apenas o bloco interno “Como surgiu”, sem criar outro módulo.

### Serviços da landing e serviços operacionais

Serviços da landing são conteúdo editorial público independente do catálogo
operacional. Seus cards possuem título, descrição, imagem, ordem e visibilidade,
são administrados pelo Motria e participam de rascunho, prévia, publicação,
histórico e restauração. Não devem buscar, alterar, derivar ou sincronizar
automaticamente preço, duração, agenda, profissionais, planos, pacientes ou
financeiro. Preserve `services_json` e estruturas legadas por retrocompatibilidade;
para código novo, prefira `landingServices`, `publicServiceCards`,
`LandingServicesSection` ou `LandingServiceItem`.

Serviços operacionais pertencem à aplicação autenticada e podem envolver preço,
duração, agenda, profissionais, planos e financeiro. Eles não são fonte
automática da landing. O isolamento por `clinic_id` permanece obrigatório nos
dois contextos, sem misturar `PublicClinicContext` e `ClinicContext`.

As suítes específicas da landing são a validação principal das mudanças
editoriais. A suíte global do MFFrontend pode ser usada como validação adicional;
falhas externas devem ser registradas como externas, sem sugerir dependência da
landing. A execução de um teste operacional não significa que a landing dependa
daquele módulo.

## Módulos autenticados — padrão oficial

> Documento de referência para criação e manutenção de módulos administrativos no frontend.
> Reflete o padrão consolidado nas microetapas 1–17 (Planos, Agendamentos, Financeiro).

### Contratos temporais do Frontend

O Frontend distingue instante, data civil `YYYY-MM-DD`, competência `YYYY-MM`,
horário civil de grade e duração. Agenda e Planos projetam seus instantes e o
calendário operacional em `America/Sao_Paulo`; o fuso do navegador e `TZ` do
processo não são autoridade. Marcadores `Date` em UTC podem ser usados apenas
para fazer aritmética de calendário sem deslocar a data civil e nunca representam
um instante de atendimento. Dia, Semana e Mês agrupam e apresentam sessões pelo
dia civil da Agenda. Drag-and-drop e alterações explícitas convertem data e hora
civis para um instante de São Paulo, preservando a duração real. O editor mantém
a regra mais estrita já documentada: se o horário não mudou, reenvia literalmente
os instantes originais.

`GET /sessions` recebe limites date-only semiabertos: `from` inclui o primeiro
dia e `to` é o dia seguinte ao último dia visível. Quando o consumidor envia um
datetime com offset, o limite é o instante exato, sem arredondamento civil; `to`
continua exclusivo. Eventos especiais mantêm seu contrato date-only inclusivo
nas duas pontas; os contratos não compartilham uma compensação implícita de fim
de dia.

No Financeiro, vencimento, referência, filtros e competência permanecem valores
civis. Períodos mensal e anual são formados diretamente dessas datas, inclusive
nas bordas de fevereiro, mês e ano. `paid_at` preserva a âncora técnica vigente
de 09h no calendário de São Paulo, sem transformar essa hora em dado exibido ao
usuário. O Histórico distingue data civil, instante com offset e a representação
legada conhecida `T09:00:00`; outro timestamp sem offset não é reinterpretado.
Esses helpers financeiros são separados dos helpers da Agenda. Datas clínicas
sem contrato temporal confirmado, evolução e auditoria clínica não são
reinterpretadas por essa regra transversal.

O gate `npm run test:temporal` executa as caracterizações afetadas. O CI o roda
em processos separados com `TZ=UTC`, `TZ=America/Sao_Paulo` e
`TZ=Pacific/Kiritimati` antes da suíte canônica completa; esse gate focado não
substitui `npm test -- --watchAll=false --runInBand`.

### Autorização oficial e fail-closed

`AuthorizationProvider` carrega `/team/authorization-context` para a identidade
e o token atuais. O catálogo corrente é `8`; durante a compatibilidade fechada
da transição, somente `7` e `8` são aceitos. Versões anteriores, futuras ou
desconhecidas falham fechadas. A capacidade `schedule.package.share` exige
simultaneamente catálogo `8` e presença explícita no payload: um contexto `7`
não a concede, mesmo que contenha essa string de forma incompatível. Sidebar,
atalhos e `MyRoute` usam exclusivamente os módulos,
níveis e capacidades desse contrato. O frontend não consulta grupo ou nome de
perfil para conceder acesso, não replica o resolvedor e somente considera
administrativo o booleano literal `is_administrator === true` em um contexto
válido e `authorized`.

Durante `idle`, `loading`, `invalid`, `no_permissions`, `403` ou erro de
carregamento, o módulo protegido não é montado. Acesso direto por URL recebe a
mesma negação do guard; ainda assim, o backend é a autoridade final e precisa
negar a API independentemente do estado visual. Ocultar item da navegação nunca
substitui autorização.

No modo membership, o contrato também informa `own_scope`. Quando uma permissão
efetiva usa `scope_level: own`, `canAccessModule` só a disponibiliza se
`own_scope.available` for verdadeiro; ausência, inconsistência ou atuação
profissional inativa falha fechado. Módulos com alcance `clinic`, permissões
administrativas e o modo legacy não dependem desse sinal. Como navegação,
guards e bootstraps usam o mesmo helper, módulos `own` indisponíveis não são
montados nem iniciam cargas previsivelmente recusadas. A atribuição manual de
perfil não cria atuação profissional. O fluxo de Dados profissionais é a exceção
explícita: exige e-mail quando falta acesso e solicita ao Backend atuação,
identidade/membership e perfil nativo em uma única operação.

A Central de Pendências também aguarda esse contexto oficial. Ela só fica
disponível e carrega sessões, alertas operacionais e serviços quando o módulo
Agenda possui acesso efetivo; ao perder a permissão ou trocar de contexto, limpa
o estado anterior e ignora respostas atrasadas. Falhas equivalentes do mesmo
carregamento usam uma única mensagem de apresentação, sem expor códigos da API.
Uma conta autenticada em `no_permissions` permanece válida e recebe em `/menu`
um estado explícito de ausência de permissões, sem atalhos de módulos.

O contexto não é persistido em `localStorage`. Logout, troca de token, troca de
usuário ou desmontagem invalidam a geração corrente e fecham imediatamente o
shell protegido. Respostas assíncronas de uma sessão anterior, inclusive erros,
não podem substituir o contexto da nova identidade.

`ClinicSessionProvider` mantém a lista e o membership ativo entregues pelo
Backend. A troca recebe um novo token, redireciona para `/menu` e remonta por
completo `ClinicProvider`, `AuthorizationProvider`, rotas e módulos usando o
token como chave. Durante a transição, `TenantLoading` substitui a aplicação;
assim branding, permissões, menus e dados anteriores não permanecem visíveis.
Requisições de escrita em andamento bloqueiam o seletor. Formulários alterados
exigem confirmação explícita para descarte.

Abas abertas recebem a sessão substituída por `BroadcastChannel`, com evento de
`localStorage` efêmero como fallback, e repetem a mesma remontagem. A preferência
é persistida somente pelo Backend; o frontend não mantém uma clínica global
própria nem aceita `clinic_id` como autoridade.

Agenda usa somente as projeções reduzidas `/schedule/references/*`. A
permissão de Agenda não libera os diretórios amplos de Pacientes ou Usuários;
cada módulo e endpoint mantém seu próprio gate.

### Manutenção da própria conta

No modo legacy, o fluxo antigo de “Editar minha conta” (`/register/`) preserva o
formulário e solicita a senha atual para troca
efetiva de e-mail, definição de nova senha e autodesativação. Atualização comum,
como alteração somente do nome, não apresenta essa reautenticação. Depois do
sucesso de uma mutação que revoga a sessão, o frontend encerra o contexto local
e conduz a pessoa para novo login.

Esse fluxo consome `PUT/DELETE /users` em `src/services/account.js`, contratos
legacy indisponíveis no modo membership. Nesse modo, a rota apresenta somente
o aviso de indisponibilidade, “Recuperar senha” (`/recuperar-senha`) e “Voltar ao
início” (`/menu`); o formulário legacy, seus efeitos e handlers não são montados.
A decisão usa o contexto oficial resolvido da sessão atual: carregamento ou
falha de autorização não permitem exposição transitória do formulário.
Autenticação e `administratorOnly` permanecem, sem nova entrada nos menus.
Abrir o aviso, a recuperação pública ou solicitar o link não encerra a sessão;
concluir a redefinição de senha continua exigindo novo login.

A autogestão de nome/e-mail da identidade global e a autodesativação foram
explicitamente adiadas para outra sprint, conforme a
[lista de fechamento do Backend](https://github.com/MauHBC/MFBackend/blob/main/docs/arquitetura/team-sprint-checkpoint.md#pendências-de-fechamento-de-appmotriamembership).
Recuperação pública de senha não resolve edição de e-mail/nome ou autodesativação.
Gestão da pessoa pela Equipe também não substitui edição do e-mail global de login.

O frontend apenas apresenta e consome esse fluxo. Critérios de sensibilidade,
validação da senha, revogação e autorização permanecem no Backend, nas fontes
canônicas de
[reautenticação e `auth_version`](https://github.com/MauHBC/MFBackend/blob/main/docs/arquitetura/team-auth-version.md)
e de
[política e armazenamento de senhas](https://github.com/MauHBC/MFBackend/blob/main/docs/arquitetura/password-security.md).

### Public/Auth Shell da entrada central

`src/components/PublicAuthShell` é uma camada de apresentação pública, sem
sessão, autorização, seleção de clínica ou acesso à API. O `/login` central e as
rotas públicas `/recuperar-senha` e `/credencial` compartilham a identidade Motria
fornecida em `src/assets/brand` e carregam Sora/Inter localmente, com tipografia
restrita ao shell. Os controles visuais compartilhados ficam em
`src/components/PublicAuthShell/controls.js`. Em domínio público de clínica,
o login e a navbar continuam com o branding white-label anterior.

Na entrada central, o favicon, ícone Apple e ícones do manifest usam o símbolo
Motria. Contextos públicos de clínica continuam aplicando o favicon específico
quando disponível, ou o ícone neutro; o contexto autenticado também não herda
o ícone Motria como fallback de clínica.

O shell recebe título, descrição, conteúdo e rodapé; não encapsula a saga de
autenticação. `EntryBoundary`, `InitialRenderGate`, `CommercialBoundary`,
`PublicClinicProvider` e o retorno permitido pelo login permanecem fora dele.
Cadastro e confirmação conservam seus layouts e podem adotar a camada visual
separadamente no futuro, sem mudar seus contratos. Recuperação e credenciais
mantêm os contratos e estados funcionais existentes ao usar o shell.

### Primeiro acesso e recuperação — lifecycle público legacy/membership

O login central oculta temporariamente os acessos a `/recuperar-senha` e ao
teste gratuito, sem remover as rotas ou fluxos. O login white-label preserva
“Esqueci minha senha”. Em `/recuperar-senha`, o formulário envia somente o
e-mail e apresenta a mesma confirmação neutra; não tenta concluir se existe
conta, membership ou envio. O Backend mantém proteção contra abuso e é a
autoridade sobre elegibilidade.

Links de primeiro acesso e recuperação apontam para `/credencial#token=...`. A
tela lê o bearer do fragmento e remove o fragmento da URL imediatamente, antes de
inspecioná-lo. Link ausente, expirado, revogado, reutilizado ou com sujeito
inativo converge para o estado “Link inválido ou expirado”. A página antecipa
somente comprimento e confirmação; política, validade, uso único, transação e
invalidação continuam no Backend.

Após sucesso, a tela limpa os campos e conduz ao login sem autenticação
automática. A nova senha é global para todos os memberships e a conclusão invalida
sessões antigas; o frontend não escolhe clínica nem preserva um contexto
autenticado nesse fluxo. O contrato canônico está no Backend em
[lifecycle de credenciais](https://github.com/MauHBC/MFBackend/blob/main/docs/arquitetura/membership-credential-lifecycle.md).

#### Ações de Pacientes

A consulta de Pacientes permanece disponível com `patients/view` ou superior.
“Novo paciente”, “Gerar link” e a rota `/pacientes/novo` exigem `patients/manage`
no contexto oficial. O cadastro só carrega responsáveis e permite envio com
esse nível; a escolha de responsável continua exigindo a capacidade própria.
As suítes de `PatientsSearch`, `PatientsNew` e rotas de Pacientes cobrem esses
gates. O `testMatch` do Jest usa padrões independentes do caminho absoluto para
que `npm test -- --watchAll=false --runInBand` também descubra as suítes em
worktrees Windows sob `.codex-worktrees`.

#### Composição modular de `PatientDetails`

A rota `/pacientes/:id` continua protegida por `patients/view`, mas a página
compõe responsabilidades autorizadas de forma independente. O perfil cadastral
depende somente de `patients`; Prontuário exige acesso de leitura a
`clinical_records`; e Histórico/Frequência exige acesso a `schedule`.

O bootstrap consulta cada área somente quando o `AuthorizationContext`
comprova sua permissão. Ausência de permissão não dispara a request nem é
representada como lista vazia. Se uma request autorizada falhar, o erro
permanece visível apenas na área correspondente, sem derrubar o perfil ou outra
área autorizada. O Backend continua sendo a autoridade final; contratos e
regras de negócio devem ser consultados nas fontes indicadas em
[regras-negocio.md](regras-negocio.md), sem serem reproduzidos no Frontend.

O cartão **Reposições de sessão** apresenta estado atual e validade na mesma
linha quando há espaço, seguidos pela sessão original (serviço, data e horário)
do vínculo `sourceSession`. O campo `reason` aparece abaixo como **Observação**
somente quando preenchido, sem ser tratado como motivo de cancelamento posterior.
O cartão não apresenta data ou estado do agendamento que usou a reposição.
Espaçamentos são compactos e as linhas quebram naturalmente em telas menores,
sem redução de fonte ou corte de informações. Ações operacionais, estado e
validade permanecem preservados. Dados ausentes não são substituídos por IDs
técnicos ou informações de outro agendamento.

Os controles do Prontuário seguem a autorização oficial também dentro da
página: leitura exige o nível e a capacidade de leitura; rascunhos e demais
mutations exigem nível de edição e capacidade de escrita; assinatura e adendo
exigem adicionalmente a capacidade de finalização. Sem a combinação aplicável,
a interface preserva a apresentação dos dados e oculta os acionadores de
escrita. A edição dos campos clínicos na seção Dados também depende da permissão
adequada de Pacientes, sem ampliar a edição das demais seções cadastrais.

Documentos é uma tab de primeiro nível com bootstrap próprio. Histórico exige
`clinical_records.read`, preview/emissão exige
`clinical_records.documents.issue` e segunda via exige
`clinical_records.documents.download`; essas capacidades não substituem o
acesso à rota do paciente. O seletor de atendimento usa somente
`/patients/:patientId/documents/eligible-sessions`, sem consultar Agenda nem
carregar todo o histórico no navegador. O modal começa com até cinco sessões
recentes (`limit=5`), sem seleção automática, e permite buscar as sessões
concluídas de um dia por `date=YYYY-MM-DD`. Tipo, Modelo e Atendimento aparecem
nessa ordem; a busca por data preserva as subseleções já feitas que continuem
aplicáveis. Trocar modelo ou atendimento invalida o preview anterior. A emissão
mantém uma chave idempotente durante o retry da mesma confirmação e o estado
documental é invalidado quando muda o paciente. A gestão de modelos fica em
`/configuracoes/documentos`, restrita ao Administrador nativo. No fluxo de
emissão, todo usuário com `clinical_records.documents.issue` consulta os modelos
ativos por `/documents/templates`, preserva a ordem recebida, inicia sem modelo
selecionado e mantém o preview bloqueado até uma escolha explícita. Preview e
emissão enviam o `template_id` escolhido; o Backend deriva a clínica autenticada
e o navegador nunca escolhe tenant.

Na gestão administrativa, modelos não possuem preferência visual. A listagem
mantém ativos e inativos editáveis, mostra o estado correspondente e oferece
`Desativar` para ativos e `Ativar` para inativos pelos endpoints próprios. O
contrato de arquivamento permanece preservado no Backend, mas não é exposto como
ação nesta interface.

O modal de emissão não expõe o tipo `attendance_declaration`: ele permanece no
contrato interno. Modelo é a primeira escolha, começa vazio e usa um placeholder
não selecionável; os modelos ativos preservam a ordem recebida. Assim que modelo
e atendimento estão selecionados, o preview autoritativo é carregado
automaticamente. Trocar qualquer uma das escolhas invalida a prévia anterior, e
respostas assíncronas antigas são descartadas. A emissão só fica disponível para
a combinação que originou a prévia vigente.

O preview usa a mesma hierarquia visual de folha do editor de modelos — logo
disponível, nome da clínica, o `document_title` devolvido pela API e corpo
editável — sem repetir acima da folha paciente, clínica, atendimento, título ou
estado. A edição pontual do texto continua restrita à emissão e não altera o
modelo salvo.

O editor administrativo de modelos apresenta o corpo editável em uma folha que
reproduz a hierarquia da declaração, com logo disponível no contexto
autenticado, nome da clínica e o `document_title` do modelo. O `name` identifica
internamente o modelo para a clínica e fica fora da folha; o `document_title`
identifica o título visível do documento e alimenta a folha em tempo real. Os
dois campos são obrigatórios, aparecem nessa ordem antes do editor e começam
vazios na criação. Enquanto
`attendance_declaration` for o único tipo suportado, a gestão não exibe tipo na
listagem nem nos drawers: a criação envia esse valor internamente e a edição não
o sobrescreve. O corpo continua sendo um
`textarea` nativo, responsivo, delimitado mesmo fora de hover/foco e sem
rich-text. As variáveis
canônicas aparecem como informações automáticas com nomes legíveis, recebem
destaque de fundo dentro do corpo e podem ser inseridas na seleção atual. Ao
abrir,
o Frontend converte as variáveis recebidas para essa representação editorial;
antes de criar ou atualizar, reconverte todo o texto para os valores canônicos.
Essa tradução é exclusiva do editor: API, preview/emissão, autorização
administrativa e resolução de tenant permanecem inalterados.

Casos clínicos e suas referências usam concorrência otimista (CAS). Os resources
carregados expõem `version`; a criação não a exige, enquanto updates de caso ou
referência, alteração de status do caso e exclusão de referência propagam a
versão corrente. Após sucesso, o Frontend adota a representação e a nova versão
canônicas retornadas pelo Backend. O conflito `409 CLINICAL_VERSION_CONFLICT`
permanece visível e não é mascarado nem reexecutado automaticamente. As regras
autoritativas do domínio permanecem no MFBackend, conforme
[regras-negocio.md](regras-negocio.md).

`eligible_to_sign` comprova a identidade profissional para o fluxo de
assinatura, mas não concede nem substitui `clinical_records.finalize`. Esses
gates de UI melhoram a experiência e reduzem ações sabidamente recusadas; o
Backend permanece responsável pelo enforcement final das autorizações e regras
de domínio. As regras autoritativas continuam nas fontes do MFBackend
encaminhadas por [regras-negocio.md](regras-negocio.md).

Os contratos visuais específicos de pessoas, contas, perfis, inativação e
auditoria da área Equipe estão em
[team-read-only-module.md](team-read-only-module.md).

Pessoa, atuação profissional, identidade, membership e perfil são estruturas
distintas. Cadastro unificado, seleção múltipla pelo perfil nativo canônico,
estados de acesso e autorização profissional automática TEMPORÁRIA pertencem ao
[contrato visual da Equipe](team-read-only-module.md), não a uma segunda regra
nesta arquitetura. A interface não cria vínculos por conta própria nem aprova
registros históricos em massa; requisitos autoritativos e demais controles de
assinatura permanecem nas fontes do Backend encaminhadas pelo módulo.

### Estados de autorização e contenção responsiva da Equipe

O `AuthorizationContext` diferencia ausência de sessão (`401`), acesso negado
(`403`) e falha de carregamento (rede, timeout ou `5xx`). A rota `/equipe`
preserva o tratamento global da sessão para `401`, mostra “Acesso não permitido”
somente para uma negação real e apresenta uma falha de carregamento com nova
tentativa nos demais erros. Um estado vazio válido não é tratado como erro.

Na área Equipe, tabelas largas preservam suas colunas e largura mínima dentro do
próprio wrapper rolável. Os ancestrais de grid e a página admitem encolhimento
com `min-width: 0`; por isso a rolagem horizontal permanece no wrapper da tabela
e não se propaga ao documento ou ao App Shell.

### Receitas unificadas e fronteira compartilhada de recebimentos

Receitas apresenta uma lista única por paciente para mensalidades, pacotes e
avulsas. **Tipo de cobrança** fica na seção **Filtros**, com chips arredondados
no padrão visual dos serviços da Agenda: **Mensalidade**, **Pacote** e **Avulsa**.
As três opções começam selecionadas; cada clique ativa/desativa somente seu tipo.
Não há opção Todos. A combinação filtra pacientes e cobranças; sem tipos ativos,
a listagem fica vazia. Status financeiro, pesquisa e competência mensal/anual
permanecem. Profissional é pertinente quando apenas Pacote e/ou Avulsa estão
ativos; a troca de tipos conserva a limpeza existente desse filtro.
Os tipos não alteram a seleção financeira dos modais. Os links antigos com
`view=mensalidades` conservam paciente e período e abrem apenas Mensalidade.
O hook `useRevenuePatientPages` solicita os tipos selecionados juntos em
`charge_types`, com `financial_status`, `patient_query`, `page` e `page_size=20`.
Pesquisa e situação são resolvidas pelo Backend no conjunto inteiro. A pesquisa
conserva o debounce de 250 ms; tipos, situação e revalidação financeira têm
consulta imediata. Nenhum tipo
ativo envia a seleção vazia e retorna zero pacientes/cobranças, sem reativar a
busca de pacientes para crédito. Contratos completos permanecem no detalhe e
nos comandos financeiros.

O seletor é **Todos | A vencer | Vencidos | Pagos**. `revenue_status` vem da
classificação canônica por cobrança; filtro e resumo por paciente não usam
mais a mistura de saldos do paciente para decidir Parcial. Parcialidade continua
nos valores Pago/A receber. A data de hoje no calendário de São Paulo é A vencer;
parcela futura não entra no saldo atrasado de cobrança que também tem atraso.
Saldo aberto sem vencimento aparece em Todos como **Vencimento não registrado**.
Cards, linhas e detalhe filtram o mesmo conjunto de cobranças comerciais.

Em Todos, o campo de status permanece neutro. Situação específica usa o fundo
e a borda do padrão existente (verde para Pagos, vermelho para Vencidos, azul
para A vencer), junto de **Filtro ativo** e **Limpar**, sem depender apenas de
cor. Limpar muda exclusivamente o status para Todos, preservando pesquisa,
paciente, competência e tipos; o fluxo de consulta reinicia a primeira página
e descarta respostas antigas. Voltar do detalhe conserva as restrições.
Consulta concluída e vazia sob status específico informa **Nenhuma cobrança
encontrada com o status ‘Pagos’ para esta pesquisa.**, adaptando a situação.
Nenhum tipo selecionado, carregamento e erro têm mensagens próprias.

A lista começa com 20 pacientes. **Carregar mais 20** anexa o bloco seguinte,
sem desmontar as linhas anteriores, mover rolagem ou alterar os cards globais.
**Exibindo X de Y pacientes** usa a quantidade global do servidor; o botão some
no último bloco. Os cards usam `summary`/`charges_count`, nunca a soma das páginas.
A página é selecionada por SQL no Backend, com ordenação por nome e desempate ID.
Consulta alterada reinicia a paginação; geração/contexto recusam respostas antigas,
inclusive anexação atrasada. Mudança de `result_version` entre páginas recarrega
o primeiro bloco para evitar combinar retratos financeiros diferentes.
Erro de próxima página mantém linhas e oferece nova tentativa; movimentações
financeiras revalidam cards/lista, e detalhes/modais conservam todos os destinos.

O Backend compatível deve preceder este bundle: o hook exige os metadados da
paginação e trata sua ausência como erro de consulta. Abas anteriores continuam
consumindo o contrato completo sem `page_size`; recebimentos, descontos, crédito
e Histórico mantêm seus comandos. A publicação e a recarga seguem os
[runbooks existentes](deploy-production.md) e a
[ordem canônica da consulta](https://github.com/MauHBC/MFBackend/blob/main/docs/regras-negocio/financeiro.md#compatibilidade-e-ordem-de-publicação-da-consulta-paginada).
O resumo anual evita conversões repetidas das sessões; a
[medição local e os limites](https://github.com/MauHBC/MFBackend/blob/main/docs/arquitetura/matriz-testes.md#status-e-paginação-de-receitas)
permanecem na matriz do Backend, sem promessa de tempo equivalente em produção.

A seção Filtros segue a ordem **Pesquisar paciente | Status financeiro | Tipo
de cobrança**: pesquisa flexível, status compacto e chips com largura natural.
A linha permite quebra dos tipos quando falta espaço e empilha em telas pequenas,
com rótulos alinhados e controles de 44px. Profissional, quando pertinente, fica
na linha seguinte.

Alternar tipos mantém título, competência, filtros, foco e resultados montados.
Durante a consulta, resumo e lista do mesmo período/contexto permanecem visíveis
como **Atualizando receitas — resultados anteriores**, com `aria-busy` nas duas
áreas. Não há limpeza prévia das datas/atrasos, cards zerados ou estado vazio
confirmado durante atualização. O resultado e sua apresentação são publicados
juntos após a resposta única do conjunto selecionado. Falha mantém os dados anteriores
explicitamente não atualizados, oferece retry e não confirma a seleção nova.
A primeira consulta ou troca de período não mostra resultados da competência
anterior. A guarda existente de geração é complementada pela identidade da
consulta/contexto para recusar respostas antigas, inclusive na troca rápida de
tipos. Troca de autorização limpa os dados privados retidos.

O detalhe já carregado usa sua projeção completa para filtrar cobranças e o
resumo correspondente, sem nova consulta por alternância. As opções de destino
nos modais continuam baseadas no detalhe completo, independentemente desses
filtros. Recebimentos e uso de crédito conservam a invalidação e recarga existentes.

O resumo e o detalhe consomem os endpoints financeiros existentes com
`origin=all`. O detalhe recebe `charges`, uma projeção canônica por ciclo, série
ou avulsa, sem duplicar a fundação do pacote nem suas sessões. Não soma as antigas
consultas por modalidade. Crédito é consultado uma vez no detalhe, global por
paciente/clínica. O cache do detalhe é compartilhado por paciente/período dentro
do contexto autorizado e é invalidado por operações financeiras e troca de
contexto. Uma cobrança parcial permanece na projeção após a recarga.

A tabela do detalhe usa **Data | Serviço | Vencimento | Valor | Pago |
A receber | Situação | Ações**. Serviço preserva o nome do serviço ou plano e
mostra abaixo uma etiqueta compacta, não clicável, de Mensalidade, Pacote ou
Avulsa. Data vem da referência financeira autoritativa usada pela competência; não é a data
do recebimento nem a primeira sessão ainda visível. Na lista de pacientes e no
detalhe, Vencimento mostra somente a data retornada pelo Backend, em formato
brasileiro, ou `-` quando ausente, sem valor ou aviso de atraso na célula.
Essa simplificação não altera cálculos, filtros de atraso ou situação financeira.
Datas não quebram internamente e colunas monetárias ficam alinhadas à direita.
Vencimentos adicionais, período completo da mensalidade e sessões ficam em
Detalhes. Referência e vencimento
ausentes não são inventados. A política prospectiva de novos pacotes e a
preservação de acordos/parcelas existentes pertencem às regras do Backend.

Os recebimentos ativos compartilham a fronteira
`src/pages/Financeiro/hooks/useFinancialPaymentFlow.js` e o componente
`src/pages/Financeiro/components/FinancialPaymentModal.js`. O hook concentra o
estado e o preview do modal, validações, descontos, alocação proporcional e a
criação do payment anchor e do pagamento; o componente concentra a apresentação
desse fluxo. A página fornece os dados e o callback de recarga, sem transferir
roteamento ou orquestração global para essa fronteira.

O preview permite recebimento parcial com desconto: o saldo pendente é calculado
sobre o total ajustado, enquanto o backend permanece a autoridade da alocação e
da persistência final.

O modal tem duas etapas. A primeira lista uma linha por mensalidade, pacote ou
avulsa elegível, com paciente, período, data e saldo; várias cobranças começam
sem seleção, enquanto uma pode vir selecionada. Avançar não chama escrita HTTP.
A segunda mantém os campos existentes e o Resumo da operação, sem tabela/lista
intermediária de revisão, contêiner ou rolagem exclusivos desse bloco. O resumo
preserva valores, desconto, pendente e crédito, sem alterar a lógica financeira.
Voltar preserva seleção e formulário; valor recebido editado não é recalculado.
Cada mensalidade reutiliza as mesmas duas etapas. Sua linha representa um
`BillingCycle` elegível pelo nome do plano, período e vencimento, nunca suas
sessões. O período delimita a consulta; na visão anual podem ser escolhidos
ciclos existentes de meses diferentes. A tela não cria ciclos futuros e não
altera Agenda, Motor V2, contratação, cobertura, renovação ou cancelamento de
Planos. A antiguidade financeira é validada pelo Backend somente entre os ciclos
selecionados, independentemente da ordenação visual. A seleção pode misturar
tipos. `unifiedRevenueCharges` adapta o DTO e ordena os grupos financeiros pela
referência; as obrigações internas de cada pacote permanecem juntas e são
ordenadas dentro desse grupo. Filtros visuais não escolhem destinos nem reduzem
silenciosamente as opções do recebimento ou de Usar crédito.

Sem seleção (inclusive período carregado sem cobranças), Avançar é permitido
com o aviso “Avançar sem selecionar cobranças, o valor ficará como crédito do
paciente.” O valor inicial fica vazio; valor conscientemente editado é
preservado ao voltar. Desconto é ocultado e zerado. A confirmação envia
`receipt_intent=credit_only` e `allocation_mode=none`, sem âncora ou alocações;
não recorre à distribuição automática legada. Somente nesse caminho explícito,
o resumo mostra uma linha: **Será adicionado ao crédito: R$X.**, com o valor novo
da operação, não o saldo de crédito disponível. O campo **Valor recebido** é
preservado. Com cobranças selecionadas, inclusive totalmente descontadas,
mantém o resumo de valor original, desconto e resultado. Falha de consulta, cache de outro
período/paciente ou revisão inválida bloqueia o fluxo, não significa mês vazio.
Em Receitas, um paciente pesquisado sem cobrança no período ainda pode abrir o
detalhe e registrar crédito; a ausência válida é diferenciada de erro e este
último oferece nova tentativa.

O campo se chama **Desconto**, inicia em `0,00` e seleciona o zero ao receber
foco por clique/teclado; não seleciona nem apaga valor não zero. Edição, colagem
e formatação são mantidas. Desconto acima do saldo selecionado bloqueia com
“O desconto não pode ultrapassar R$X.”, sem limitar pelo valor recebido.
No limite exato, seleção válida totalmente descontada admite confirmar dinheiro
positivo sem aplicações. O hook preserva seleção, `adjustment_targets`, grupos,
desconto e modo manual; não converte em recebimento sem seleção. Os detalhes
compactos preservam a linha do desconto e o crédito original informado pela API.

O hook envia `receipt_groups` e os snapshots completos em `adjustment_targets`,
separados das aplicações positivas em `allocations`. O cálculo interno soma o rateio
das obrigações internas; não recalcula o desconto por pacote. O servidor valida
composição, ordem e valores sob as regras FIN-004/FIN-006 do Backend; conflito
bloqueia nova confirmação até atualizar os dados e reabrir a revisão. O detalhe
usa a projeção das parcelas elegíveis para a coluna Valor da avulsa, preservando
o original separadamente, assim como já faz com os totais do pacote.

Na aba Histórico do detalhe do paciente, a linha existente ganha “Ver
detalhes” como ação discreta, com teclado, foco e estado de expansão, sem modal.
A linha principal mantém **Registrado em | Movimento | Valor | Detalhes**;
forma de pagamento e observação permanecem na expansão. Ao entrar na aba,
carrega o catálogo de formas pela API existente;
o nome é resolvido pelo `payment_method_id` persistido, sem depender de abrir
o modal de recebimento. Informação ausente permanece “—”, sem nome presumido.
`FinancialReceiptDetails` consulta sob demanda
`GET /financial-payments/:id?include_receipt_details=true` e mostra cobrança
agrupada em linhas compactas de avulsa/pacote, data, serviço e pago naquela
operação. Desconto aparece somente quando positivo, inclusive sem aplicação
de dinheiro. Não há tabela interna, cabeçalho, linha Total, Total após desconto,
Ficou a receber ou espaços reservados para esses totais. Linhas quebram
naturalmente em telas menores. Fontes históricas e agrupamento permanecem
inalterados. Crédito mostra somente o valor originalmente deixado como crédito,
nunca o saldo disponível atual. Sem prova da distribuição histórica,
a expansão informa a limitação, sem inferir a partir das alocações atuais ou
da prévia do navegador. A visão dedicada desabilitada não é alterada.

Regressões: `FinancialPaymentModal.test.js`, `useFinancialPaymentFlow.test.js`,
`FinancialReceiptDetails.test.js`, `currentObligation.test.js`, `index.test.js` e o gate do Backend
`test:financial-partial-discount:database` com o hook real desta worktree. Para
Mensalidades e seleção mista, `unifiedRevenues.test.js`, `billingCycles.characterization.test.js`,
`activePayments.characterization.test.js`, `FinancialCreditUseModal.test.js` e
`test:financial-monthly-receipts:database` e `test:financial-unified-receipts:database`
cobrem a fronteira compartilhada com HTTP e MariaDB descartável; o último usa
o adaptador e o hook reais do Frontend.

Cada confirmação lógica mantém uma única `Idempotency-Key` e o mesmo payment
anchor enquanto a requisição está pendente ou um erro ambíguo pode exigir retry.
Duplo clique não abre outra tentativa material. Alterar o comando ou abrir uma
nova operação gera nova chave e novo anchor; o serviço envia a chave somente no
header do POST de `financial-payments`.

Detalhes de sessão, resolução de pendências e ciclos conservam seus contratos
próprios dentro do detalhe único. Mensalidades não recebem ações de cancelamento
de sessão. Recebimento, crédito e Histórico compartilham o mesmo contexto. A visão
dedicada de Recebimentos continua desabilitada intencionalmente e fora dessa
capacidade compartilhada ativa.

**Usar crédito** mantém um único modal em duas etapas. **Onde usar o crédito?**
consulta destinos elegíveis no Backend com `destination_type=all`, permite selecionar pacotes/avulsas,
expandir **Escolher sessões** na própria lista ou selecionar ciclos de
mensalidade por plano, período e vencimento, e editar **Valor a usar**. Somente
um grupo elegível pode vir selecionado; vários exigem escolha explícita. Paciente
e período permanecem visíveis, com menor destaque que o título da etapa.
**Crédito disponível:** e seu valor aparecem próximos, com somente o rótulo em
negrito e quebra natural em telas estreitas. O campo monetário reutiliza a
apresentação e os formatadores de Registrar recebimento: digitar `150` significa
R$150 e sair do campo apresenta `150,00`, sem alterar centavos. O preenchimento
automático ocorre somente na inicialização; edição, exclusão, retorno ou atualização
dos destinos não autorizam substituir silenciosamente o valor. O limite atual
aparece junto ao campo somente quando há valor inválido, bloqueando Avançar.
Na mesma abertura, Voltar conserva valor, seleção, expansão, paciente e período;
alterações de valor ou seleção invalidam a revisão e exigem nova prévia.
**Escolher sessões / Recolher sessões** apenas mostra/esconde as opções de pacote,
sem desmarcar sessões, preservando foco, teclado e `aria-expanded`.

**Conferir uso do crédito** apresenta exclusivamente a prévia do servidor, com
uma identificação moderada da cobrança e suas datas. Pacotes mostram
**Sessões que receberão o crédito**, com linhas compactas recuadas, valores
previstos e informações auxiliares secundárias, sem repetir o nome do pacote.
Mensalidades e avulsas apresentam o destino diretamente, sem lista artificial de
sessões. Saldos por destino permanecem secundários. Uma divisória separa o resumo:
**Crédito a aplicar** é principal e **Crédito restante**, secundário; não há total
redundante de saldo da seleção, nova tabela ou janela sobreposta. A rolagem fica
no corpo do modal e o rodapé permanece acessível.
**Avançar** não grava; apenas **Confirmar** conclui a aplicação. Uma
tentativa com resposta incerta conserva comando e chave idempotente para retry;
mudança relevante exige revisão atualizada e outra confirmação. Carregamento,
erros, foco e bloqueio de envio duplicado pertencem ao modal. As regras e a
competência são as de [FIN-005](https://github.com/MauHBC/MFBackend/blob/main/docs/regras-negocio/financeiro.md#fin-005);
o Frontend não recalcula o plano de aplicação nem usa o período como destino.
Após sucesso no detalhe do paciente, a recarga permanece nesse escopo e atualiza
a cobrança e o resumo autoritativos sem substituir temporariamente o detalhe por
listas globais; carregamento ou erro continuam explícitos e não viram lista vazia.

No detalhe de Receitas, o topo exibe **A receber** e o saldo global de
**Crédito disponível**; as linhas exibem **Pago** aplicado à obrigação. Não há soma
de créditos por modalidade ou saldo paralelo. **Cobranças / Histórico** reutiliza a
apresentação compacta, com pagamentos, descontos e usos retornados pelos
registros reais do Backend e sem IDs técnicos. Operação mista aparece uma vez,
com composição por tipo nos detalhes e crédito original preservado. Falha de
consulta mostra erro/repetição, sem apresentar crédito zero ou período vazio.

### Pesquisa e identificação do paciente em Receitas

Em Receitas, pesquisar restringe os pacientes apresentados e preserva a
interpretação financeira dos pacotes nos valores da lista, dos totais e do
detalhe. Pesquisa vazia, parcial, completa ou limpa mantém a competência
definida pela [FIN-001 do Backend](https://github.com/MauHBC/MFBackend/blob/main/docs/regras-negocio/financeiro.md#fin-001),
sem mudar a semântica dos demais filtros.

Ao abrir o detalhe, o campo **Pesquisar paciente** mostra o nome completo do
paciente e permanece desabilitado. Esse texto identifica o detalhe e é separado
do estado da pesquisa: não dispara uma busca nem recalcula valores. Voltar à
lista restaura a pesquisa anterior e permite sua edição.

O bloco de resultados, imediatamente após os filtros, apresenta a competência
somente no título existente: **Resumo por paciente - Setembro de 2026** na lista
e **Nome do paciente - Setembro de 2026** no detalhe. Na visão anual, o sufixo é
somente o ano. Não há uma segunda indicação menor acima do título. O texto
deriva do mesmo `attendancePeriodLabel` do seletor principal; a linha de título
fica sticky abaixo do cabeçalho global, com offset de `layout.appHeaderHeight`,
fundo opaco e empilhamento limitado ao próprio bloco. O sufixo permanece no
detalhe em Cobranças/Histórico e no período vazio, sem outro seletor ou estado
de período. No Histórico, identifica a competência consultada, não as datas
de registro ou recebimento. As mudanças de período conservam os loaders e não
reapresentam resultados anteriores durante a consulta. O seletor principal e
os critérios de consulta permanecem iguais.

### Resumo da cobrança e sessões vinculadas

Em **Receitas > Detalhes > Cobranças > Detalhes**, o título do modal identifica
Mensalidade/Pacote/Avulsa e o nome do serviço/plano. O paciente aparece abaixo,
com peso normal e menor destaque. Esse cabeçalho conserva o comprador como
identidade financeira. O corpo mantém o período da mensalidade em linha compacta,
o resumo das sessões e a tabela **Data | Paciente atendido | Profissional |
Status**; em pacote compartilhado, a identidade operacional de cada linha vem
da sessão e não substitui o comprador.
Não há faixa isolada de quantidade, título de distribuição ou seção/cards
financeiros: valores ficam na tabela de Cobranças, e operações/descontos no
Histórico, sem alteração dos dados ou cálculos.

O vencimento único, já apresentado na tabela anterior, não é repetido. Quando
há vários vencimentos, todas as datas retornadas permanecem em metadados
compactos com rótulo discreto, peso normal e quebra natural, sem saldo repetido.

O único resumo **Sessões** distingue, na mensalidade, a quantidade realmente
vinculada ao ciclo. No pacote, **contratadas** usa exclusivamente `total_sessions`
da projeção canônica; **vinculadas** e os estados operacionais usam as sessões
retornadas. Quantidade contratada ausente não é inferida do número de linhas, e
a diferença não calcula direitos restantes. Agendadas, realizadas, faltas,
canceladas e suspensas são mostradas somente quando positivas. A avulsa mostra
o atendimento diretamente, sem resumo artificial de uma sessão.

Ao abrir uma mensalidade, a lista é consultada pelo vínculo exato em
`GET /sessions?patient_id=...&billing_cycle_id=...`, sob as permissões existentes
da Agenda. Não consulta todas as sessões do paciente nem limita as vinculadas às
datas do ciclo: uma sessão remarcada para fora do período continua identificada
pelo seu `billing_cycle_id`. O cliente exige resposta em lista e vínculos de
paciente/ciclo coerentes; resposta inválida é erro, não lista vazia. Carregamento,
falha com nova tentativa e ausência válida são estados distintos. Respostas de
outro ciclo, de uma abertura encerrada ou de outro contexto autorizado são
descartadas. Reabrir a mensalidade relê as sessões.

Mensalidade sem sessões mostra uma única mensagem: **Nenhuma sessão vinculada
a esta mensalidade.**, sem título de zero sessões ou bloco de distribuição
vazio. Pacote e avulsa usam mensagens próprias; contrato conhecido do pacote
continua informado, sem repetir contagem zero de vínculos. A consulta não
recalcula os valores financeiros nem altera Histórico ou tabela principal.

Somente este modal usa as variantes locais `RevenueChargeDetail*`: o cartão
flex limita sua altura à janela e às margens de área segura; título/X e rodapé
com **Fechar** não encolhem. Período/metadados e o resumo único de sessões ficam
fora da rolagem. Somente a região focável da tabela pode rolar; seus quatro
cabeçalhos **Data | Paciente atendido | Profissional | Status** permanecem sticky no topo dessa
região, com fundo opaco. Não há tabela, cabeçalho ou resumo duplicado. O corpo
flexível limita a região à altura disponível da janela, sem segunda rolagem
vertical. Colunas têm larguras compartilhadas entre cabeçalho e linhas e textos
podem quebrar; telas baixas/estreitas compactam espaçamentos. Listas pequenas
mantêm altura natural, e primeira/última sessões continuam no mesmo conteúdo.
Mensalidade, pacote e avulsa preservam seus metadados e estados próprios.
A página ao fundo fica
travada durante a abertura. Foco inicial no X, Tab contido, Escape e restauração
do foco/overflow ao fechar são locais ao modal; o teclado só é interceptado se
este for o diálogo mais alto. Ao trocar para Resolver pendência, o fechamento
de Detalhes não rouba o foco inicial do diálogo seguinte. A aprovação visual
da rolagem em janela baixa/estreita pertence à conferência manual de Maurício.

As regressões em `Financeiro/index.test.js` e `Financeiro/unifiedRevenues.test.js`
cobrem a simplificação, resumo por tipo, lista longa completa, vínculo/recarga das
sessões de mensalidade, estados e controles de teclado/rolagem, preservando as
asserções financeiras na tabela. Persistência e lifecycle são validados por
HTTP/MariaDB no Backend; testes de componente não comprovam a rolagem visual.
As caracterizações de mensalidades e recebimentos também usam o contrato
paginado real nos mocks (`page_info`, contagens globais, versão e status por
paciente), inclusive pesquisa sem cobrança para crédito. O teste de estrutura
verifica o contexto fora do único wrapper rolável e a tabela sem largura mínima
que force corte em telas estreitas. O gate completo permanece `CI=true npm test
-- --watchAll=false --runInBand`; executar somente os testes novos não cobre
essas caracterizações.

### Cancelamento financeiro e histórico do paciente

O cancelamento usa o formulário existente **Cancelamento/falta** da **Agenda**:
tipo, motivo obrigatório, reposição e justificativa de exceção quando aplicável.
Há uma única ação **Confirmar cancelamento**, sem etapa visual de prévia ou
resumo financeiro. A prévia técnica é consultada em segundo plano e não grava
alterações. A confirmação aguarda a resposta correspondente aos campos atuais;
outro agendamento afetado é identificado no formulário por paciente, data e hora.
Mudança de estado recarrega a prévia, explica a alteração no próprio formulário e
exige novo clique; nunca confirma automaticamente o escopo atualizado. O envio
fica bloqueado enquanto a confirmação estiver em andamento, e retry ambíguo
preserva comando e chave idempotente.

Quem possui as autorizações necessárias confirma a operação conjunta. Sucesso
mostra **Sessão cancelada.** O fluxo operacional permitido sem autorização
financeira preserva os valores protegidos e mostra **Sessão cancelada. Acerto
financeiro pendente.** quando houver pendência. Reposição e penalidade continuam
nos comandos operacionais. Falha da operação conjunta não executa cancelamento
operacional separado nem liberação de crédito independente.

Em sessão compartilhada, a Agenda valida separadamente as duas identidades do
contrato autoritativo: `session.patient_id` da prévia precisa corresponder ao
paciente atendido da sessão aberta, enquanto `patient.id` da prévia e
`patient_id` da confirmação precisam corresponder ao comprador do `Package`
projetado pela `PackageUnit`. Sessão comum usa o próprio paciente nas duas
funções. Vínculo de pacote incompleto, divergente ou de outra clínica falha
fechado; o navegador não envia nem aceita um `patient_id` escolhido livremente.

Em **Receitas > Detalhes > Cobranças**, **Resolver pendência** aparece
somente para pendências reais de `pending_resolutions`, com `can_resolve: true`,
`finance/manage` e `finance.settle`. A lista genérica `cancellation_candidates`
não habilita botões. O modal **Detalhes** mantém o resumo compacto e a tabela
**Data | Paciente atendido | Profissional | Status**, com aviso discreto apenas
quando houver pendência financeira. Alterações concluídas são consultadas pela
aba **Histórico**, sem aviso ou botão adicional no detalhe ou modal.
Sem pendência aplicável, nenhum bloco ou espaço é reservado.

`FinancialCancellationModal` consome `cancellation-preview` e
`cancel-with-credit` de `financial-entries/:id` para resolver a pendência. A
confirmação usa exclusivamente os valores e consequências da prévia. Motivo,
exceção de antecedência, elegibilidade e permissões são revalidados pelo Backend.
Alterações no comando invalidam a prévia; estado conflitante exige nova
conferência. Retry ambíguo conserva comando e `Idempotency-Key`. Após confirmação,
o cache do paciente é invalidado e os agregados são relidos. As regras
financeiras permanecem no [Backend](https://github.com/MauHBC/MFBackend/blob/main/docs/regras-negocio/financeiro.md).

A aba **Histórico**, com filtro **Recebimentos**, consome
`financial_history` em tabela compacta **Registrado em | Movimento | Valor | Detalhes**.
**Registrado em** usa exclusivamente `recorded_at`, o timestamp persistido de
criação do pagamento ou do registro autoritativo da operação retornado pelo
Backend. Exibe data e hora real lado a lado (**30/09/2026 · 15:27**), com
**HH:mm** discreto e quebra natural entre data e horário somente quando faltar
espaço, no fuso `America/Sao_Paulo`. A lista é ordenada pelo instante completo decrescente, com
desempate por identidade do evento após os agrupamentos existentes; o Backend
ordena o conjunto completo, antes de qualquer eventual limite. Timestamp ausente,
inválido ou sem horário/fuso explícito aparece como **Registro não disponível**;
esses itens ficam ao final, preservando sua ordem. `paid_at`, `occurred_at`,
`updated_at`, sessão e relógio do navegador nunca substituem o registro.
Replay mantém o timestamp original e uma única linha pela identidade da operação.
O seletor **Todos os eventos / Recebimentos** fica à direita na linha das abas
**Cobranças / Histórico**, sem texto introdutório ou rótulo visível.
Cancelamento e liberação aparecem na mesma linha somente quando vinculados por
`cancellation_resolution_id` ou `operation_id` explícito; o valor da linha é o
crédito liberado, sem somar novamente o cancelamento. **Ver detalhes** apresenta
um resumo por operação: sessão, data do movimento, responsável e motivo ou
observação. Em recebimentos, **Recebido em** mostra somente a data financeira
de `occurred_at` (preservada a partir de `paid_at`), sem horário técnico.
Datas puras `YYYY-MM-DD` mantêm o dia com formatação UTC; timestamps conservam o
fuso `America/Sao_Paulo` já usado pelo módulo. O sufixo `T09:00:00` acrescentado
pelo hook à data informada não é hora de registro; seu contrato de gravação não
é alterado. Nos demais movimentos, a data/hora real da operação continua nos
detalhes. Em **Uso de crédito**, `applied_destinations` identifica os destinos
efetivamente confirmados, incluindo serviço/data de sessão ou plano/período de
mensalidade e valor aplicado; `applied_sessions` permanece como compatibilidade
para registros anteriores. Para sessões,
parcelas/fontes são consolidadas pelo Backend somente com vínculo inequívoco ao
comprovante persistido da operação. Prévia, saldo ou agendamento atual não
substituem esse registro. Na ausência de vínculo confiável, exibe **Destino
histórico indisponível** e preserva os eventos sem associação presumida. Apenas
a observação automática `Aplicação de crédito em cobrança` é ocultada; observações
reais, responsável e instante do uso permanecem. Nos demais movimentos, o serviço
vem da sessão já retornada, pelo `session_id` confirmado;
a data/hora da sessão vem do evento, sem substituição pela sessão atual ou pela
origem financeira. Recebimentos identificam sua própria data, sem tratá-la como
data de alteração. IDs, referências internas e textos técnicos não são exibidos;
os eventos e vínculos internos permanecem integrais. Data ou valor iguais nunca
comprovam vínculo. Cada recebimento permanece separado e liberação/uso de crédito
não são entradas de dinheiro.

O contexto das contas consultadas e recebimentos posteriores vinculados é
preservado, com as datas reais dos eventos. Dados legados ausentes são marcados
como não registrados. Na compatibilidade sem `financial_history`, apresenta
somente os recebimentos reais retornados e usa a criação persistida do pagamento
(`recorded_at` ou `created_at`/`createdAt` do ORM), sem reconstruir aplicações,
cancelamentos ou autoria. A cronologia de registro não muda a inclusão por
paciente/período nem a data financeira de Recebido e pago, Distribuição e caixa.

### Abas da Visão geral financeira

A Visão geral contém **Resumo**, **Recebido e pago** e **Distribuição**. O Resumo
reúne as antigas seleções Resumo mensal e Evolução anual nos controles
**Mensal/Anual**, preservando separadamente o mês e o ano selecionados. As abas
são estado local da página; a rota `/financeiro/visao-geral` permanece válida.

O Resumo representa as contas pertencentes ao período, independentemente da
data do pagamento, conforme a [FIN-002 do Backend](https://github.com/MauHBC/MFBackend/blob/main/docs/regras-negocio/financeiro.md#fin-002).
`GET /financial-overview?month=YYYY-MM` ou `?year=YYYY` fornece **Total de receitas**
(`incomeTotal`), **Total de despesas** (`expenseTotal`) e **Saldo das contas**
(`periodResult`). **Liquidado/A receber** e **Pago/A pagar** representam a situação
dessas mesmas contas. O pacote integral pertence ao mês da primeira sessão;
pagamento posterior atualiza sua situação sem deslocar sua competência.

Os cartões, o gráfico **Saldo das contas por mês**, a tabela **Contas por mês** e
o total anual usam os agregados do Backend, sem recalcular valores financeiros
no Frontend. Os 12 meses incluem valores futuros já lançados. `hasAccounts`
distingue ausência de contas de contas com valor zero. No Resumo mensal, a
ausência de contas mantém os indicadores zerados, sem bloco de mensagem ou
espaço reservado. Carregamento, falha e
contrato incompleto possuem estados próprios. Uma resposta incompleta nunca é
transformada em saldo zero. Os valores, proporções e rótulos monetários são
apresentados sem alternância de mostrar/ocultar.

**Recebido e pago** mantém `GET /financial-received-paid?year=YYYY`, com dinheiro
efetivamente recebido/pago pela data do pagamento em São Paulo (FIN-014).
**Distribuição**, com título interno **Distribuição do resultado**, usa a mesma
fonte de caixa e a configuração existente (FIN-015): distribui apenas resultados
positivos pelos percentuais configurados, de forma demonstrativa, sem repasses
automáticos. O Resumo não alimenta essa distribuição. Os períodos e permissões
existentes são preservados: somente administradores acessam as duas abas, e
apenas a aba Distribuição consulta sua configuração. Mudanças de aba, ano ou
contexto descartam respostas privadas antigas.

As regressões em `Financeiro/index.test.js`, `FinancialOverviewSection.test.js`
e `FinancialReceivedPaidSection.test.js`
cobrem contratos, competência, futuro, navegação, valores visíveis e permissões. Os
cálculos do Resumo também são validados por HTTP/MariaDB no Backend.

### Despesas da clínica

Em Despesas, a ação **Desfazer pagamento** solicita um motivo antes de reabrir
a despesa. O Frontend bloqueia motivo vazio e não chama a API quando o usuário
cancelar. Na confirmação, envia `PATCH /clinic-expenses/:id/unpay` com
`{ reason }` e, após sucesso, recarrega a listagem para apresentar a despesa
novamente como pendente. O Backend permanece responsável por validar e auditar
o desfazimento.

### Reposição de pacote em Novo agendamento

Ao selecionar uma reposição vinculada a `PackageUnit`, a Agenda preenche o
serviço da sessão de origem e mantém Tipo de atendimento visível e desabilitado.
O campo usa o estilo disabled compartilhado com a pesquisa de paciente do
Financeiro, sem seta de select, e ocupa a mesma largura de Paciente/Profissional,
com uma coluna em telas estreitas.
Profissional, data, horário e observações continuam editáveis; essas alterações
não limpam a reposição. Selecionar ou remover a reposição também preserva esses
campos. Removê-la explicitamente libera o seletor de serviço, conservando o
serviço atual até uma nova escolha. Dependências reais, como trocar o paciente
ou recalcular o término ao mudar o início, mantêm o comportamento existente.

A revisão recebe o serviço já fixado e usa **Confirmar** nesse fluxo, inclusive
quando há atribuição de cuidado ao profissional. Agendamentos comuns e séries
conservam seus rótulos de confirmação/atribuição. Não há validação visual
adicional na revisão: o Backend continua responsável por rejeitar serviço
incompatível com o pacote, mesmo em payload adulterado.

### Compartilhamento de pacote em Novo agendamento

A opção **Usar pacote de outro paciente** existe somente para quem recebe
`schedule.package.share` e fica no início do formulário, junto à escolha de
direito próprio ou novo lançamento. São decisões de origem/cobertura. Ela só
aparece após selecionar o paciente e concluir a consulta de direitos, no mesmo
grupo de radios das outras origens. Após selecioná-la e usar **Avançar**,
os detalhes do mesmo formulário mostram **De quem é o pacote?**. Serviço, profissional,
data, horário e observações continuam no formulário comum, e alterações nesses
campos não limpam silenciosamente o paciente dono do pacote.

O caminho consumido é escolhido somente pelo `catalog_version` do contexto de
autorização já validado, nunca pela ausência eventual de um campo, por `404` ou
por falha de rede. No catálogo `7`, a Agenda mantém o contrato publicado que
avalia eventos operacionais, sem exigir `validation`; a revisão identifica um
resultado livre desses eventos como **Sem bloqueio operacional**, e a gravação
continua sujeita à validação final do servidor. Nesse contexto não há
compartilhamento, e o Histórico usa apenas `/sessions` e `/session-series`, sem
consultar `/patients/:id/package-history` nem inventar unidades ou contadores.
No catálogo `8`, a Agenda exige a validação completa de conflito do paciente e
PatientDetails exige o read-model por `PackageUnit`; resposta incompleta, `404`
ou erro permanece falha do contrato novo e não ativa fallback legado.

A revisão de compartilhamento mostra paciente atendido, dono do pacote e atendimento, sem expor IDs
ou unidades. Ela consulta somente pacotes elegíveis para o serviço já escolhido,
ordena os mais recentes primeiro e apresenta contratação, quantidade e
disponibilidade em cards compactos. Direito livre aparece como **N livres** e
não expande sessões. Quando não há direito livre, o card informa **N agendadas**
e, somente após ser selecionado, expande **Escolha a sessão:** com as futuras
realocáveis. Cada opção combina data/hora, paciente atualmente atendido e
profissional; o paciente da origem pode ser o titular, um terceiro ou o próprio
destinatário. Contratação e sessões usam data completa `dd/mm/aaaa`; a fronteira
do Frontend rejeita respostas sem `free_rights`, `relocatable_sessions` e lista
coerente, em vez de renderizar contadores indefinidos. Contadores agregados da
revisão ficam ocultos apenas neste fluxo;
alertas e bloqueios reais continuam no item correspondente. As prévias individual
e recorrente enviam paciente, intervalo, serviço e profissional para a validação autoritativa;
ao selecionar pacote ou sessão de origem, invalida a resposta anterior e refaz a
consulta com esse contexto. **Disponível** aparece somente quando o Backend
confirma o contrato completo e a ausência de conflito do paciente. Enquanto a
consulta estiver pendente o item informa a verificação, e resposta incompleta,
falha ou `PATIENT_SCHEDULE_CONFLICT` deixa a ocorrência sem seleção e sem
confirmação. Na recorrência, o contrato completo é exigido também para cada
ocorrência. Respostas atrasadas são descartadas. Se o conflito surgir depois da
prévia, o `409` atualiza o item correspondente — ou invalida toda a prévia quando
não puder mapeá-lo com segurança — sem apagar o formulário e exige nova avaliação;
o Backend continua revalidando na gravação. A confirmação usa `POST /sessions`,
com token de revisão e chave idempotente; mudanças concorrentes atualizam as
opções sem trocar o serviço ou o dono selecionado. Cards da
grade Semana/Mês mantêm somente o paciente atendido. Em sessão de `PackageUnit`
elegível, o campo **Paciente** do Editar agendamento usa diretamente a busca já
existente e só dispara o comando de compartilhamento quando a escolha realmente
muda; sessão comum, protegida ou sem `schedule.package.share` permanece somente
leitura. A data original já ter passado não torna somente por isso uma sessão
aberta inelegível; o Backend decide pelos estados e efeitos consolidados. O
serviço continua fixo. Troca exclusiva do paciente preserva horário e não é
remarcação; mudança simultânea de início ou fim continua sujeita à antecedência
vigente. O editor apresenta e interpreta seus campos civis no fuso canônico da
Agenda (`America/Sao_Paulo`): sem mudança temporal, início e fim originais são
reenviados literalmente; uma alteração explícita é serializada como o instante
equivalente nesse fuso, independentemente do fuso do navegador ou do CI.
Detalhes do horário, visão Dia, Editar e a sessão avulsa do destinatário
no Histórico exibem o `PackagePill` lilás **Pacote de {titular}** somente quando
o paciente atendido difere do titular; a comparação usa IDs e acompanha a
seleção no formulário. Em `PatientDetails`, `/patients/:id/package-history`
mantém o pacote integral somente no titular e o modal inclui uma linha por
`PackageUnit`: sessão vigente com **Paciente atendido**, ou **Não agendada**
quando o direito está `available`, com campos ainda indefinidos em travessão.
Remarcação, reposição e compartilhamento não duplicam direitos; o destinatário
continua vendo somente as próprias sessões.

Na tabela compacta **Pacotes e sessões avulsas**, **Agendadas** aparece
imediatamente depois de **Total**. Para pacotes da fundação, a interface consome
o `scheduled_count` autoritativo do read-model, calculado somente pela sessão
vigente de cada `PackageUnit`; não deriva essa quantidade do tamanho da lista de
sessões nem conta registros históricos. No histórico do destinatário, o item
compartilhado continua representando somente a sessão atendida por ele, sem
projetar os totais do pacote do titular.

No modal, o próprio nome em **Paciente atendido** usa a rota existente
`/pacientes/:id` somente quando há `patients/view` efetivo e
`attended_patient.can_view_profile === true`; no legado, o paciente já aberto e
autorizado pela própria rota conserva o mesmo padrão de link. A identidade do
destino vem sempre do paciente atendido (`attended_patient.id` ou `Patient.id`),
nunca do titular. Sem essa autorização, ou nas linhas **Não agendada**, o
conteúdo permanece texto. A navegação usa o `Link` e o histórico nativos; ao
voltar, a persistência já existente por paciente e clínica restaura a aba
**Histórico**, sem criar estado paralelo de retorno.

### Confirmação de bloqueio manual por feriado

Em Configurações da Agenda, criação de feriado bloqueante e a ação **Bloquear
agenda** usam um único `dialog`. Quando a API responde `409` com a prévia de
impacto, o conteúdo desse mesmo modal muda para confirmação ou bloqueio, sem
empilhar outro modal. Voltar à criação preserva os campos preenchidos; revisar
mantém a navegação para o dia informado. A confirmação reutiliza o token
autoritativo retornado pelo Backend, e uma nova prévia por mudança do conjunto
substitui o conteúdo da etapa atual. Depois do bloqueio confirmado com sucesso,
a tela usa o `refreshOperationalAlerts` do provider global para sincronizar
imediatamente o badge e a lista da Central de pendências.
Quando existem bloqueadores verdadeiros, o mesmo modal usa título e texto
principal neutros, apresenta os motivos específicos como informação secundária
e oferece somente **Cancelar** e **Revisar agenda**, sem alerta visual destrutivo
ou ação de confirmação.

---

## Atualização de versão em abas abertas

`AppVersionReloader`, montado em `src/App.js`, utiliza
`src/hooks/useAppVersionUpdate.js` e `src/services/appVersion.js`. A consulta
ocorre na montagem, navegação, foco da janela, retorno à aba visível e reconexão,
com intervalo mínimo de 15 minutos entre consultas posteriores. Não há polling
periódico. `app-version.json` recebe query temporal, `cache: no-store` e headers
de não-cache; a identidade prioriza os assets principais JS/CSS, com fallback
para build/commit/data. A comparação inicial usa os assets do documento aberto.

Uma versão diferente fica pendente enquanto houver campo em edição, modal ou
rota sensível protegida. A recarga exige nova oportunidade segura nesses eventos
ou após perda de foco do campo; remover um modal, sozinho, não garante recarga
imediata. Falha de consulta não força recarga. Não remover essas proteções, criar
logout global ou reenviar comandos financeiros após atualizar a página.

Na transição fechada do catálogo de autorização `7` para `8`, uma aba com o
bundle compatível conserva apenas os módulos e capacidades efetivamente presentes
no contexto `7`; o compartilhamento permanece indisponível. Quando o documento
recebe os assets correntes, `AppVersionReloader` aplica a mesma recarga segura
descrita acima. Isso não abre aceitação genérica de versões nem contorna comandos
em andamento.

Um bundle antigo que conhece somente o catálogo `7` não negocia o contrato `8`
em memória: ao receber esse contexto, falha fechado e depende da atualização de
versão para carregar os assets transitórios. Se houver edição, modal ou rota
sensível, a recarga pode ficar pendente até a próxima oportunidade segura; esse
adiamento protege o rascunho, mas não prova compatibilidade funcional do bundle
antigo com o Backend novo. Comandos já enviados continuam dependendo da
idempotência e compatibilidade mantidas pelo servidor, sem reenvio automático.

Se uma aba antiga perder os módulos ao receber catálogo `8`, a orientação é
concluir ou cancelar com segurança a edição/modal local, sem repetir comando de
resultado incerto, e então atualizar explicitamente a página para carregar o
bundle corrente. Navegar, focar ou tornar a aba visível oferece uma nova
oportunidade ao mecanismo existente, mas não garante recarga imediata; esperar
ou apenas fechar o modal não substitui a atualização explícita. Não exigir
logout global. Resultado incerto deve ser esclarecido no servidor antes de
qualquer nova tentativa.

A ordem técnica de uma futura ativação coordenada é: primeiro disponibilizar o
Frontend transitório que aceita somente `7` e `8` e exige `8` para
`schedule.package.share`; depois conter os escritores afetados, aplicar a
migration do catálogo `8`, ativar Backend 8 e validar a combinação antes da
reabertura. Backend 7 não pode atender o banco promovido. Somente em release
posterior se retira o suporte ao catálogo `7`. O procedimento operacional fica
no [runbook do Backend](https://github.com/MauHBC/MFBackend/blob/main/docs/deploy-production.md#corte-coordenado-do-catálogo-7-para-8).
Esta integração local não executa nenhuma dessas etapas de publicação.

O servidor permanece responsável pela compatibilidade de comandos das abas
antigas. Recusa definitiva anterior à gravação usa o envelope de erro já
consumido pelo formatador Axios publicado. Timeout ou resultado incerto não são
essa recusa: manter a chave idempotente e esclarecer a operação antes de tentar
novamente. Gates: `useAppVersionUpdate.test.js`, `appVersion.test.js` e o teste
HTTP/MariaDB do Backend com hook e formatador reais da versão publicada.

## App Shell autenticado

O shell global fica em `src/components/AppShell`. `AppShell/index.js` renderiza
sidebar, cabeçalho, drawer mobile, menu do usuário e landmarks;
`navigation.js` é a fonte declarativa dos destinos, visibilidade e rota ativa;
`styled.js` contém a estrutura responsiva; e `styles/tokens.js` define os tokens
semânticos usados pelo shell.

A Central de pendências pertence ao cabeçalho global da área da clínica. Seu
sino fica imediatamente antes do menu do usuário, permanece visível sem itens e
mostra o badge somente quando a contagem é positiva. O provider único em
`src/components/PendingCenter` mantém as consultas, contagens e o drawer lateral;
a Agenda apenas consome essa fonte para atualizar pendências após suas mutações e
para executar, quando solicitado pelo drawer, as ações de abrir um dia ou iniciar
o agendamento de uma reposição.

No canto superior esquerdo da sidebar, a área de identidade mostra o nome da
clínica ativa. Uma única clínica é texto; com várias, o nome vira seletor de
memberships disponíveis. A troca não abre tela exclusiva nem refaz login.

`src/routes/index.js` envolve Pacientes, Planos, Financeiro e Configurações em uma instância
compartilhada. Menu, Painel, Agenda e Configurações da Agenda ainda montam
`AppShell` nas próprias páginas. Por isso, as chaves dos módulos abertos são
mantidas em `sessionStorage` sob `multifisio:app-shell:open-modules`: a troca
entre essas instâncias não pode perder expansões já escolhidas. A preferência de
sidebar fixada usa `localStorage` e a chave
`multifisio:app-shell:sidebar-pinned`.

### Árvore e rotas atuais

| Item | Tipo | Destinos reais |
|---|---|---|
| Painel | Link direto | `/painel`; `/dashboard` é alias ativo |
| Agenda | Expansível | Agenda: `/agendamentos`; Configurações: `/agendamentos/eventos` |
| Pacientes | Link direto | `/pacientes`; detalhes em `/pacientes/:id` e demais subrotas protegidas |
| Planos | Expansível e sujeito a `isPlansModuleEnabled` | Pacientes com plano: `/planos?tab=patient-plans`; Planos mensais: `/planos?tab=service-plans`; Serviços: `/planos?tab=services`; detalhes: `/planos/pacientes/:patientPlanId` |
| Financeiro | Expansível | `/financeiro/visao-geral`, `/financeiro/receitas`, `/financeiro/despesas` e `/financeiro/configuracoes` |
| Configurações | Link direto no rodapé, somente Administrador nativo | `/configuracoes` redireciona para `/configuracoes/documentos` |
| Sair | Ação | Executa `useLogout` no menu do usuário; não é rota |

`/financeiro` é uma entrada legada redirecionada para a Visão geral. Formas de
pagamento e Categorias de despesas permanecem internas a Configurações, em
subrotas próprias. Mensal/anual permanece modo interno da Visão geral.

Não existe hoje rota nem item declarativo de **Ajuda e suporte**. Ele só deve
ser documentado ou adicionado à árvore depois que houver um destino real
aprovado; não invente uma rota para completar visualmente a lista.

### Tipos e hierarquia

- Link direto não possui `children`; navegar por ele não recolhe os módulos que
  o usuário deixou abertos.
- Módulo expansível possui `children`. Agenda, Planos e Financeiro têm estados
  independentes: vários podem permanecer abertos, e cada botão alterna apenas o
  próprio submenu.
- A rota atual sempre acrescenta o módulo correspondente aos abertos. Acesso
  direto, refresh e histórico preservam item ativo e expansão coerentes.
- O detalhe de paciente oferece no próprio cabeçalho a ação contextual
  **Pacientes**, que retorna à listagem em `/pacientes`, seguindo o padrão do
  retorno **Planos** no detalhe de plano mensal.
- Ação executa comportamento local, como Sair, sem participar da resolução de
  rota.
- Pais e filhos podem declarar `isVisible`. Um pai invisível ou sem filhos
  visíveis é removido. Isso controla apresentação; autorização continua nas
  rotas protegidas e no backend.
- Não há terceiro nível na sidebar. Dia, Semana e Mês e “Novo agendamento” são
  controles internos da Agenda; Feriados e regras são internos às Configurações
  da Agenda; Plano, Agenda e Histórico são internos ao vínculo do paciente.
  Abas internas não viram automaticamente navegação global.

### Estados desktop e mobile

- Desktop inicia compacto. Hover ou foco expande temporariamente sobre o
  conteúdo; expandir de modo persistente reserva `256px`. Compacto reserva
  `76px`.
- O controle pequeno na borda aparece somente quando a sidebar desktop está
  expandida. O nome acessível e o tooltip mudam entre “Expandir sidebar” e
  “Recolher sidebar”. O recolhimento explícito limpa imediatamente a expansão
  temporária vigente; um novo hover ou foco pode expandi-la novamente.
- Até `960px`, a mesma árvore vira drawer; não existe uma segunda configuração
  de menus. O drawer fecha após navegar e pelo overlay ou `Escape`. Fixação não
  se aplica no mobile.
- Botões nativos dos módulos respondem a Enter e Espaço. No compacto, foco
  também revela o conteúdo; `title` e nome acessível identificam os itens.
- Cada pai usa `aria-expanded` e `aria-controls`; a lista filha fica aninhada no
  mesmo `<li>`. O pai não recebe `aria-current`. Somente o link efetivo recebe
  `aria-current="page"`. Todos os controles mantêm `:focus-visible`.

### Estrutura e medidas da sidebar

`AppShell/styled.js` define uma grade compartilhada por links diretos e botões:
coluna fixa do ícone (`28px`), coluna flexível do texto e coluna própria da seta
(`24px`), com `12px` de padding da navegação, `12px` no item e `12px` de gap.
O centro horizontal atual do ícone é `38px`. Texto e seta desaparecem do fluxo
compacto sem deslocar o ícone; a faixa “Módulos” usa `visibility`, altura fixa,
fonte zerada e recorte de overflow no estado compacto, preservando a posição
vertical sem reservar largura horizontal. A topbar e o cabeçalho da sidebar
compartilham `layout.appHeaderHeight` (`52px`). Não centralize o conjunto
ícone/texto/seta nem mova a seta para a coluna do texto.

### Cores e estados

Os valores abaixo vêm de `src/styles/tokens.js` e são aplicados em
`AppShell/styled.js`:

| Estado | Token atual |
|---|---|
| Fundo da sidebar | `colors.appChromeBackground`, derivado de `--clinic-primary-color` em OKLCH `L 0.485`, com `C ≤ 0.045`; fallback `oklch(0.485 0.03 145)` |
| Módulo aberto | `colors.navigationModuleOpenBackground`, OKLCH `L 0.525`, com `C ≤ 0.045`; fallback `oklch(0.525 0.03 145)` |
| Fundo do submenu | `colors.navigationSubmenuBackground`, OKLCH `L 0.415`, com `C ≤ 0.04`; fallback `oklch(0.415 0.026 145)` |
| Texto principal/secundário da navegação | `colors.appChromeForeground` / `colors.appChromeMutedForeground` |
| Página ativa no submenu | `colors.navigationSubmenuActiveBackground` (`rgb(255 255 255 / 14%)`) |
| Hover da navegação | `colors.navigationHoverSurface` (`rgb(255 255 255 / 8%)`) |
| Foco visível na moldura | `colors.appChromeFocus` |
| Badge financeiro | `colors.danger` sobre `colors.white` |
| Workspace | `colors.workspaceBackground` (`oklch(0.98 0.004 250)`) |
| Topbar e bordas | `colors.surface`, `colors.borderSubtle` e `colors.appChromeBorder` |

As superfícies `appChromeBackground`, `navigationModuleOpenBackground`,
`navigationSubmenuBackground` e `navigationSubmenuIndicator` derivam de
`--clinic-primary-color`, limitando a cromaticidade em OKLCH. Os fallbacks
preservam a mesma relação de luminosidade quando relative color syntax não está
disponível. O overlay mobile é o valor local `rgba(15, 23, 19, 0.48)` em
`styled.js`. Não há estado desabilitado nos
itens atuais; `disabledBackground` e `disabledText` são tokens compartilhados,
não um contrato específico da sidebar. Abas internas, quando aplicáveis, usam
texto, peso/cor e sublinhado ativo; não devem virar cápsulas por padrão.

O badge do Financeiro é atualizado pelo evento
`multifisio:app-shell:navigation-badge`, identificado por
`NAVIGATION_BADGE_EVENT`. O renderer associa o valor à chave do filho; filhos
não possuem ícones porque o renderer atual não os suporta.

### Como adicionar um módulo

1. Use link direto para um único destino global; use `children` apenas para
   seções administrativas independentes. Mantenha modos e detalhes como abas ou
   controles internos.
2. Declare `key`, `label`, `path`, `matchPaths` e ícone do pai em
   `navigation.js`. Para correspondência exata use `exactMatchPaths`; para
   queries, use `isActive({ pathname, searchParams })`.
3. Reaproveite rotas reais de `routes/index.js`; não crie rota apenas para
   preencher o menu.
4. Reaproveite `isVisible`/feature flag real. Ocultar não substitui autorização.
5. Para badge, publique `NAVIGATION_BADGE_EVENT` com a chave exata do filho.
6. Garanta `aria-expanded`, `aria-controls`, filho aninhado, foco visível e
   somente um `aria-current`.
7. Atualize `navigation.test.js`, `index.test.js`, o teste estrutural e a
   integração da rota. Verifique desktop fixado/compacto, hover, foco e drawer.

Exemplo mínimo da API atual:

```js
{
  key: "example",
  label: "Exemplo",
  path: "/rota-existente",
  matchPaths: ["/rota-existente"],
  icon: ExistingIcon,
  isVisible: () => existingFeatureFlag,
  children: [
    {
      key: "example-overview",
      label: "Visão geral",
      path: "/rota-existente",
      exactMatchPaths: ["/rota-existente"],
    },
  ],
}
```

Não crie submenu para Pacientes; não promova Dia/Semana/Mês ou abas de vínculos;
não adicione terceiro nível; não coloque a seta na coluna flexível; não remova a
altura estrutural de “Módulos”; não duplique árvores desktop/mobile; não adicione
ícones aos filhos sem suporte do renderer; e não substitua o App Shell pelas
Navbar/Sidebar legadas, ainda necessárias às áreas não migradas.

`ClinicContext` é a fonte da identidade autenticada. A navegação não escolhe
tenant e não altera contratos de autorização.

## Objetivo

Garantir que todos os módulos novos e futuras evoluções sigam a mesma estrutura visual e arquitetural, reduzindo duplicação, acelerando desenvolvimento e mantendo consistência para o usuário.

---

## Princípios

1. **Componente compartilhado primeiro.** Antes de criar qualquer `styled-component` local, verificar se já existe um componente compartilhado (`AppLayout`, `AppDrawer`, etc.) que atenda a necessidade.
2. **Local só com divergência real e justificada.** Criar definição local apenas quando o visual ou comportamento requerido genuinamente diverge do componente compartilhado e essa divergência não pode ser resolvida com props.
3. **Parametrização antes de fork.** Se um componente compartilhado quase atende, adicionar a prop necessária a ele em vez de duplicar o componente localmente.
4. **Zero mudança silenciosa.** Nunca alterar um componente compartilhado sem checar o impacto em todos os módulos que o consomem.
5. **Consistência com os módulos de referência.** Em caso de dúvida de padrão, consultar Planos (estrutura), Agendamentos (drawer/interação) e Financeiro (organização por rotas e seções).

---

## Estrutura padrão de um módulo

```jsx
<PageWrapper>                    // AppLayout — ocupa toda a viewport
  <PageContent>                  // AppLayout — container centralizado
    <ModuleHeader>               // AppModuleShell — topo da página
      <ModuleTitle>Nome</ModuleTitle>
    </ModuleHeader>

    <ModuleTabs>                 // AppModuleShell — quando houver abas
      <ModuleTabButton $active={...}>Aba A</ModuleTabButton>
      <ModuleTabButton>Aba B</ModuleTabButton>
    </ModuleTabs>

    <ModuleBody>                 // AppModuleShell — área de conteúdo
      <AppToolbar>               // AppToolbar — filtros e ação primária
        <AppToolbarLeft>
          <select>...</select>
        </AppToolbarLeft>
        <PrimaryButton>Nova ação</PrimaryButton>
      </AppToolbar>

      <TableWrap>                // AppTable — tabela administrativa
        <DataTable>
          <thead><tr><TH>Col</TH></tr></thead>
          <tbody>
            <tr>
              <TD>Valor</TD>
              <TD><StatusPill $tone="active">Ativo</StatusPill></TD>
              <TD>
                <RowActionButton>Editar</RowActionButton>
                <DangerButton>Excluir</DangerButton>
              </TD>
            </tr>
          </tbody>
        </DataTable>
      </TableWrap>
    </ModuleBody>
  </PageContent>

  <AppDrawer $open={isOpen}>     // AppDrawer — CRUD lateral
    <DrawerHeader>...</DrawerHeader>
    <DrawerBody>
      <form>
        <Field>                  // AppForm — campos do formulário
          Rótulo *
          <input ... />
          <FieldHint>Dica.</FieldHint>
        </Field>
      </form>
    </DrawerBody>
    <DrawerFooter>
      <GhostButton>Cancelar</GhostButton>
      <SaveBtn type="submit">Salvar</SaveBtn>
    </DrawerFooter>
  </AppDrawer>
  {isOpen && <DrawerBackdrop onClick={onClose} />}
</PageWrapper>
```

---

## Componentes compartilhados oficiais

### `AppLayout` — `src/components/AppLayout`

Shell de página. Toda página administrativa começa aqui.

| Componente | Uso | Props opcionais |
|---|---|---|
| `PageWrapper` | Elemento raiz da página | `$paddingTop`, `$paddingBottom`, `$background` |
| `PageContent` | Container centralizado | `$maxWidth`, `$paddingX`, `$paddingTop`, `$paddingBottom`, `$mobileBreakpoint`, `$mobilePaddingX`, `$mobilePaddingTop`, `$mobilePaddingBottom` |

**Defaults (padrão Planos):** `max-width: 1200px`, `padding: 32px 24px 48px`, breakpoint `768px`.

---

### `AppDrawer` — `src/components/AppDrawer`

Drawer lateral para CRUD. Sempre fixo na direita e alinhado imediatamente abaixo
do cabeçalho do `AppShell`, usando `layout.appHeaderHeight` tanto no `top` quanto
no cálculo da altura. Possui animação por `transform` e permanece no DOM — a
visibilidade é controlada por `$open`.

| Componente | Uso |
|---|---|
| `AppDrawer` | Container principal (`$open` booleano) |
| `DrawerBackdrop` | Overlay clicável para fechar |
| `DrawerHeader` | Cabeçalho com título e botão de fechar |
| `DrawerTitle` | `<h2>` do drawer |
| `DrawerCloseBtn` | Botão `×` padrão |
| `DrawerBody` | Área de conteúdo com scroll |
| `DrawerFooter` | Rodapé com botões de ação |

**Regra de uso:** o Drawer nunca deve cobrir a navbar. `z-index: 20`, backdrop `z-index: 10`.

---

### `AppModuleShell` — `src/components/AppModuleShell`

Estrutura visual do topo do módulo: título, abas e corpo.

| Componente | Uso |
|---|---|
| `ModuleHeader` | Container do cabeçalho do módulo |
| `ModuleTitle` | Título principal da página (`<h1>`) |
| `ModuleTabs` | Container de abas (borda inferior) |
| `ModuleTabButton` | Botão de aba (`$active` booleano) |
| `ModuleBody` | Wrapper do conteúdo principal |

---

### `AppToolbar` — `src/components/AppToolbar`

Linha de filtros + ação primária acima da tabela.

| Componente | Uso |
|---|---|
| `AppToolbar` | Container principal (flex, space-between) |
| `AppToolbarLeft` | Lado esquerdo — filtros, selects, busca |
| `AppToolbarRight` | Lado direito — botões de ação |
| `AppToolbarSpacer` | Empurra conteúdo para a direita |

---

### `AppTable` — `src/components/AppTable`

Tabela administrativa padrão.

| Componente | Uso |
|---|---|
| `TableWrap` | Container com scroll horizontal e borda |
| `DataTable` | Elemento `<table>` |
| `TH` | Célula de cabeçalho (`<th>`) |
| `TD` | Célula de dado (`<td>`) |

---

### `AppButton` — `src/components/AppButton`

Botões padrão por hierarquia de ação.

| Componente | Uso |
|---|---|
| `PrimaryButton` | Ação primária (CTA, toolbar, submit) |
| `GhostButton` | Ação secundária / cancelar |
| `RowActionButton` | Ação em linha de tabela |
| `DangerButton` | Ação destrutiva em linha de tabela |

**Nota:** botões de submit em drawer podem usar `styled(PrimaryButton)` com padding ajustado ao contexto do formulário.

---

### `AppStatus` — `src/components/AppStatus`

Badges de status e informação.

| Componente | Prop | Resultado |
|---|---|---|
| `StatusPill` | `$tone="active"` | Verde |
| `StatusPill` | `$tone="paused"` | Amarelo |
| `StatusPill` | `$tone="canceled"` / default | Cinza |
| `InfoPill` | — | Azul sutil (avisos, notas) |
| `NeutralPill` | — | Cinza neutro |
| `PackagePill` | — | Lilás sutil (contexto de Package) |

---

### `AppForm` — `src/components/AppForm`

Estrutura de campos em formulários simples de drawer.

| Componente | Uso |
|---|---|
| `Field` | `<label>` wrapper — envolve rótulo + elemento nativo |
| `FieldHint` | Texto auxiliar abaixo do campo |

**Padrão:** usar elementos HTML nativos (`<input>`, `<select>`, `<textarea>`) diretamente dentro de `<Field>`. Não criar componentes `Input`, `Select` ou `TextArea` separados sem necessidade clara.

---

### `AppPagination` — `src/components/AppPagination`

Controle visual compartilhado para paginação. Recebe `page`, `pageSize`,
`total`, `totalPages`, `loading`, `onPageChange` e `ariaLabel`; não busca dados,
não conhece endpoints e não decide se a paginação é local ou server-side. O
contrato interno canônico usa `page`, `page_size`, `total` e `total_pages`, mas
o componente aceita `pageSize` e `totalPages` por convenção de props React. O
tamanho de página é configurável por tela.

Planos usa paginação server-side e dez `PatientPlans` por página. Pacientes
adota o mesmo componente visual sem mudança de dados: ainda faz uma única
leitura de `GET /patients`, mantém o conjunto completo no navegador e executa
busca, ordenação e `slice` localmente. Essa carga integral é dívida técnica para
uma evolução futura do endpoint; não deve ser copiada por telas novas nem
confundida com o padrão canônico, que é busca, filtros e paginação server-side.

---

## Padrão oficial: módulo sem sidebar (Shell 1)

Use este shell para módulos CRUD administrativos simples, com uma entidade principal, drawer lateral e opcionalmente abas. Sem navegação lateral.

**Exemplos:** Planos, Agendamentos, Pacientes, qualquer CRUD futuro.
**Template canônico:** `src/templates/StandardModuleTemplate.js`
**Referência real:** `src/pages/Planos/index.js`

Os contratos e estados específicos da Administração de Planos ficam em
[Planos](planos.md); esta arquitetura mantém somente os padrões compartilhados
de composição do módulo.

> Regra: novo módulo nasce do template, não de uma cópia de Planos ou Agendamentos.

### Composição obrigatória

```jsx
<PageWrapper>                              // AppLayout
  <PageContent>                            // AppLayout

    <ModuleHeader>                         // AppModuleShell
      <ModuleTitle>Nome</ModuleTitle>
      [<ModuleSubtitle>Desc</ModuleSubtitle>]
      [<ModuleActions><PrimaryButton/></ModuleActions>]
    </ModuleHeader>

    [<ModuleTabs>                          // AppModuleShell — se houver abas
      <ModuleTabButton $active={...}>Aba A</ModuleTabButton>
    </ModuleTabs>]

    <ModuleBody>                           // AppModuleShell
      [<ModulePanel>...</ModulePanel>]     // opcional — destaque/métricas

      <AppToolbar>                         // AppToolbar
        <AppToolbarLeft><select/></AppToolbarLeft>
        <AppToolbarRight><PrimaryButton/></AppToolbarRight>
      </AppToolbar>

      <TableWrap>                          // AppTable
        <DataTable>
          <thead><tr><TH/></tr></thead>
          <tbody>
            <tr>
              <TD/>
              <TD><StatusPill $tone="active"/></TD>
              <TD><RowActionButton/><DangerButton/></TD>
            </tr>
          </tbody>
        </DataTable>
      </TableWrap>
    </ModuleBody>

  </PageContent>

  <AppDrawer $open={isOpen}>              // AppDrawer — sempre no DOM
    <DrawerHeader>
      <DrawerTitle/>
      <DrawerCloseBtn/>
    </DrawerHeader>
    <DrawerBody>
      <form>
        <Field>rótulo *<input/><FieldHint/></Field>
        <DrawerFooter>
          <GhostButton>Cancelar</GhostButton>
          <SaveBtn type="submit">Salvar</SaveBtn>
        </DrawerFooter>
      </form>
    </DrawerBody>
  </AppDrawer>
  {isOpen && <DrawerBackdrop onClick={onClose} />}

</PageWrapper>
```

### Componentes obrigatórios

| Componente | Origem | Papel |
|---|---|---|
| `PageWrapper` | AppLayout | Wrapper externo, offset da navbar |
| `PageContent` | AppLayout | Container centralizado |
| `ModuleHeader` + `ModuleTitle` | AppModuleShell | Cabeçalho da página |
| `ModuleBody` | AppModuleShell | Área de conteúdo |
| `AppDrawer` + `DrawerBackdrop` | AppDrawer | CRUD lateral |

### Componentes opcionais

| Componente | Origem | Quando usar |
|---|---|---|
| `ModuleSubtitle` | AppModuleShell | Quando há descrição |
| `ModuleActions` | AppModuleShell | Ações globais no cabeçalho |
| `ModuleTabs` + `ModuleTabButton` | AppModuleShell | Quando há abas |
| `ModulePanel` | AppModuleShell | Destaque, métricas, avisos |
| `AppToolbar` + `AppToolbarLeft/Right` | AppToolbar | Filtros + ação sobre a tabela |
| `TableWrap` + `DataTable` + `TH` + `TD` | AppTable | Tabelas |
| `StatusPill` | AppStatus | Badges de status |
| `Field` + `FieldHint` | AppForm | Campos do formulário no drawer |

### Styled-components locais permitidos no Shell 1

- `SaveBtn = styled(PrimaryButton)` — padding de submit em drawer diverge do PrimaryButton padrão de toolbar. Justificativa obrigatória em comentário.
- Qualquer componente de domínio genuinamente específico do módulo.

---

## Template legado de sidebar interna (não usar como navegação global)

Este template permanece no repositório para compatibilidade e referência de
áreas ainda não migradas. Ele não substitui a navegação global do App Shell e
não representa mais o Financeiro atual.

**Template canônico:** `src/templates/SidebarModuleTemplate.js`

> Não adote este template em módulo novo sem decisão arquitetural explícita.

### Composição obrigatória

```jsx
<SidebarShellWrapper $collapsed={isSidebarCollapsed}>   // AppSidebarShell
  <SidebarShellLayout $collapsed={isSidebarCollapsed}>  // AppSidebarShell

    <AppSidebar $collapsed={...} $mobileOpen={...}>     // AppSidebar
      <AppSidebarHeader>
        <AppSidebarSectionTitle $collapsed={...}>Menu</AppSidebarSectionTitle>
        <AppSidebarToggle onClick={...} aria-label={...}>{icon}</AppSidebarToggle>
      </AppSidebarHeader>

      <AppSidebarSection>                               // repita por grupo
        <AppSidebarSectionTitle $collapsed={...}>Seção</AppSidebarSectionTitle>
        <AppSidebarButton $active={...} $collapsed={...} onClick={...}>
          <AppSidebarIcon $active={...}>{icon}</AppSidebarIcon>
          <AppSidebarLabel $collapsed={...}>Rótulo</AppSidebarLabel>
        </AppSidebarButton>
      </AppSidebarSection>
    </AppSidebar>

    <SidebarMainArea>                                   // AppSidebarShell
      {/* conteúdo da seção ativa */}
    </SidebarMainArea>

  </SidebarShellLayout>

  {isMobile && isSidebarOpen && <AppSidebarOverlay onClick={closeSidebar} />}

  <AppDrawer $open={isDrawerOpen}>                      // AppDrawer — CRUD
    <DrawerHeader><DrawerTitle/><DrawerCloseBtn/></DrawerHeader>
    <DrawerBody><form>...</form></DrawerBody>
    <DrawerFooter><GhostButton/><PrimaryButton/></DrawerFooter>
  </AppDrawer>
  {isDrawerOpen && <DrawerBackdrop onClick={closeDrawer} />}

</SidebarShellWrapper>
```

### Componentes obrigatórios

| Componente | Origem | Papel |
|---|---|---|
| `SidebarShellWrapper` | AppSidebarShell | Wrapper externo — define CSS vars topbar/sidebar |
| `SidebarShellLayout` | AppSidebarShell | Flex container sidebar + área principal |
| `SidebarMainArea` | AppSidebarShell | Área de conteúdo com flex: 1 |
| `AppSidebar` | AppSidebar | Sidebar fixa colapsável |
| `AppSidebarHeader` | AppSidebar | Linha de topo da sidebar |
| `AppSidebarSectionTitle` | AppSidebar | Label de seção / "Menu" |
| `AppSidebarToggle` | AppSidebar | Botão de colapso/expansão |
| `AppSidebarSection` | AppSidebar | Grupo de itens de navegação |
| `AppSidebarButton` | AppSidebar | Item de navegação |
| `AppSidebarIcon` | AppSidebar | Ícone do item |
| `AppSidebarLabel` | AppSidebar | Rótulo do item (oculto quando colapsado) |
| `AppSidebarOverlay` | AppSidebar | Overlay escuro mobile |

### Componentes opcionais (dentro de SidebarMainArea)

| Componente | Origem | Quando usar |
|---|---|---|
| `PageContent` | AppLayout | Se quiser centralizar o conteúdo com max-width |
| `ModuleHeader` + `ModuleTitle` | AppModuleShell | Cabeçalho de cada seção |
| `ModuleSubtitle` | AppModuleShell | Descrição da seção |
| `ModuleActions` | AppModuleShell | Ações globais no cabeçalho |
| `ModuleBody` | AppModuleShell | Wrapper do conteúdo da seção |
| `ModulePanel` | AppModuleShell | Card de destaque dentro do corpo |
| `AppToolbar` | AppToolbar | Filtros + ação primária acima de tabela |
| `TableWrap` + `DataTable` + `TH` + `TD` | AppTable | Tabelas administrativas |
| `AppDrawer` + internos | AppDrawer | CRUD lateral de qualquer seção |
| `PrimaryButton`, `GhostButton`, etc. | AppButton | Ações |
| `StatusPill` | AppStatus | Badges de status |
| `Field` + `FieldHint` | AppForm | Formulários no drawer |

### Quando pode manter algo local

Seguem as mesmas regras gerais (seção "Regras para exceções"):
- Botões com visual próprio do domínio → `styled(PrimaryButton)` com override
- Trigger de abertura da sidebar no mobile (ex: `MobileMenuButton`) — não tem equivalente compartilhado, manter local com comentário
- Componentes de seção com design system próprio (ex: `Attendance*` do Financeiro) — manter local

### Dependência de CSS vars

`AppSidebar` depende das CSS vars `--topbar-height` e `--sidebar-width` definidas em `SidebarShellWrapper`. Sempre envolva a sidebar com `SidebarShellWrapper` — nunca use `AppSidebar` solto.

---

## Shell de conteúdo vs sidebar interna legada

| Critério | Shell de conteúdo | Sidebar interna legada |
|---|---|---|
| Entidades | 1 principal (com CRUD) | Múltiplas seções independentes |
| Navegação | Abas lineares (opcional) | Sidebar colapsável persistente |
| Complexidade | Baixa / média | Alta |
| Template | `StandardModuleTemplate.js` | `SidebarModuleTemplate.js` |
| Referência real | `Planos` | Nenhuma entre as rotas migradas |
| Drawer CRUD | Sim (padrão) | Sim (por seção) |
| PageWrapper | `AppLayout.PageWrapper` | `AppSidebarShell.SidebarShellWrapper` |
| Container interno | `AppLayout.PageContent` | `AppSidebarShell.SidebarMainArea` |

Se as seções precisarem aparecer na navegação global, declare-as como filhos em
`AppShell/navigation.js`. Uma sidebar interna exige aprovação específica e não
deve duplicar o App Shell.

---

## Regras para exceções

### Quando criar `styled-component` local

Permitido apenas quando **todas** as condições abaixo forem verdadeiras:

1. O componente compartilhado equivalente não cobre o caso nem com props.
2. Adicionar uma prop ao compartilhado criaria complexidade desproporcional.
3. O componente local é genuinamente específico do domínio do módulo.

**Exemplos legítimos em Agendamentos:** `DrawerHeader` local (tem subtítulo e padding diferentes), `DrawerBody` local (padding diferente), `DrawerActions` (sem equivalente em AppDrawer).

### Quando parametrizar o compartilhado

Preferir sempre a adição de prop opcional com default seguro ao componente compartilhado quando a variação é estrutural mas não semântica (tamanhos, breakpoints, espaçamentos).

**Exemplo:** `$mobileBreakpoint` no `PageContent` para acomodar Agendamentos (859px) sem quebrar Planos (768px).

### O que nunca fazer

- Criar novo componente de drawer fora do `AppDrawer` sem decisão explícita.
- Inventar novo padrão de navegação entre módulos sem alinhamento.
- Duplicar CSS de botão, status ou tabela localmente sem verificar os compartilhados primeiro.
- Alterar um componente compartilhado sem checar todos os consumidores.

---

## Checklist para novo módulo

Antes de entregar qualquer novo módulo ou tela administrativa:

**Shell**
- [ ] Usa o App Shell global nas rotas autenticadas migradas?
- [ ] A navegação global foi declarada uma única vez em `AppShell/navigation.js`?
- [ ] Evita sidebar interna paralela sem decisão arquitetural explícita?

**Conteúdo**
- [ ] O cabeçalho usa `ModuleHeader` + `ModuleTitle` do `AppModuleShell`?
- [ ] Se houver abas (Shell 1), usa `ModuleTabs` + `ModuleTabButton`?
- [ ] A toolbar usa `AppToolbar` + `AppToolbarLeft`?
- [ ] A tabela usa `TableWrap` + `DataTable` + `TH` + `TD`?
- [ ] Os botões usam `PrimaryButton`, `GhostButton`, `RowActionButton` ou `DangerButton`?
- [ ] Os badges de status usam `StatusPill` com `$tone` correto?
- [ ] Os campos de formulário usam `Field` + `FieldHint`?
- [ ] O drawer usa `AppDrawer` + `DrawerBackdrop` + subcomponentes?

**Qualidade**
- [ ] Qualquer componente local tem justificativa real documentada no código (comentário inline)?
- [ ] O build compila sem warnings?
- [ ] Nenhum `styled-component` foi criado localmente como cópia de um componente compartilhado existente?
## Prévia editorial da landing

A landing pública continua usando seus componentes reais e o contexto público.
Quando a URL raiz contém `landing_preview` e `clinic_id`, o contexto é carregado
do endpoint temporário de prévia. O token não publica conteúdo, expira no
backend e a página usa `noindex`. Não crie uma segunda implementação visual da
landing no MFPlatformAdmin.

## Contato, Unidades e acesso da equipe

A landing renderiza Contato e Unidades como áreas visuais independentes do mesmo módulo. Cada área aplica seu campo `background_variant` interno com os mesmos tokens semânticos da landing; quando o campo não existe, herda o fundo do módulo. Áreas sem conteúdo não geram faixas vazias. Uma unidade não exibe índice; duas ou mais preservam a numeração.

O endereço geral de Contato é omitido nessa área quando coincide com o endereço de uma unidade visível. O rodapé não repete o endereço completo quando não existem campos estruturados suficientes para um resumo confiável. O acesso da equipe não aparece no cabeçalho público e permanece no rodapé como "Área da equipe" / "Entrar no sistema". Seu destino segue a política de entrada abaixo; antes da ativação continua em `/login`. O link "Estrutura" aponta para `#gallery` e só é oferecido quando a Galeria está visível.

### Entrada central e compatibilidade durante o corte

Implementação preparada, **não ativada em produção**. `src/config/entryPolicy.js`
concentra os sete hosts: `app.motria.com.br`, os sites
`espacocuidarvix.com.br`/`cmtrfisio.com.br` com seus aliases `www`, e
`camila.motria.com.br`/`gabi.motria.com.br`. Essa lista define navegação,
nunca identidade de clínica, membership ou autorização.

`EntryBoundary` fica antes dos providers de sessão/tenant e módulos. Nos hosts
gerenciados, lê `GET /entry-policy.json` same-origin, sem credenciais, sem cache
e sem seguir redirects, uma vez por documento. O arquivo do build contém
`{"version":1,"enabled":false}`: publicar o bundle não ativa encaminhamentos.
O Nginx autorizado pode responder `enabled:true` por host. Falha/formato inválido
mantém uma mensagem com tentativa explícita, sem montar consumidores. A decisão
de encaminhar é recalculada a cada rota, sem remontar providers na navegação
normal. Uma aba já aberta observa mudança da chave ao recarregar o documento;
a ativação operacional exige recarregar essas abas. Desenvolvimento e hosts não
gerenciados não consultam essa chave nem encaminham para produção.

Com a chave ativa:

- Os sites preservam `/`, seções, `/politica`, conteúdo e assets. O rodapé usa
  o destino fechado `https://app.motria.com.br/login#`.
- Rotas internas reconhecidas nos seis hosts antigos encaminham antes de
  montar módulos, também na navegação React. IDs, queries, filtros e fragmentos
  são descartados; nenhuma sessão é transferida. Destinos da URL não são aceitos.
- A raiz central conduz à rota de login existente: anônimo vê login; sessão
  validada pelo contexto do Backend segue para `/menu`. Falha de validação
  não promove a sessão ao início. Não é necessário tenant público no Host.
- As raízes de Camila/Gabi encaminham, **exceto** quando há marcador
  `landing_preview`: a prévia existente valida token/clínica no Backend.
  O marcador sozinho não autoriza acesso, nem escolhe clínica autenticada.
- Convites `/cadastro/paciente/:token`, `/credencial`, `/recuperar-senha`,
  APIs, arquivos e caminhos desconhecidos não recebem encaminhamento genérico.
  Códigos de links preservados continuam na origem e seguem seus validadores.

O fragmento vazio explícito no destino impede a herança definida na
[RFC 9110, 10.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.2).
Nginx não vê o fragmento de prévia; portanto não pode redirecionar genericamente
as raízes de Camila/Gabi. A preparação operacional, precedência e ativação estão
no [runbook de domínios do Backend](https://github.com/MauHBC/MFBackend/blob/main/docs/deploy/white-label-domains.md).
`admin.motria.com.br` permanece fora desta política.

Validação: `npm test -- --watchAll=false --runInBand`, `npm run build`,
`npm run lint`, `npm run check:mojibake` e `git diff --check`.
Após build, o gate `node tests/central-entry-real-backend.cjs --backend <worktree-backend>`
reutiliza o orchestrator MariaDB do Backend e
`scripts/test-central-entry-nginx.cjs`. Exige Docker iniciado pelo operador,
imagens locais `mariadb:11.4`/`nginx:1.28-alpine` e Playwright/Chromium já
disponíveis no runtime de testes (via `NODE_PATH`, se externo à worktree).
`MOTRIA_TEST_BROWSER_EXECUTABLE_PATH` seleciona um Chromium já instalado;
`MOTRIA_TEST_OPENSSL` seleciona OpenSSL local para TLS sintético descartável.
Ausência desses pré-requisitos falha, não é aprovação ou skip. O navegador
headless executa o bundle compilado através de proxy **somente loopback**,
que entrega Nginx local e recusa outras origens sem abrir conexão externa.
Isso inclui todos os saltos HTTP→HTTPS: interceptação Playwright isolada não
garante essa cobertura. TLS de teste é aceito somente nesse navegador isolado,
sem alterar certificados/configuração reais. APIs de
login/convite/credencial/prévia usam Backend real e dados sintéticos, sem envio.
Isso comprova navegação, não substitui a validação visual de Maurício.

Execução local de 2026-09-17: 28 testes focados; suíte completa com 93 suítes,
831 testes aprovados e 3 condicionais de `ownAccountContainment` não executados
(exigem seu runner próprio); 5 testes do launcher local aprovados. Build, lint
e mojibake aprovados. O gate separado desta entrada executou 10 cenários no
Chromium 148.0.7778.96, Backend real/MariaDB 11.4.12 e 772 casos HTTP no Nginx,
com zero intenções de e-mail. Não houve teste do console administrativo real:
sua barreira foi representada por Basic sintético e bloqueio `/api/platform`.

### Cadastro automático e contexto comercial

`/cadastro` deslogado apresenta “Crie sua conta”, nome, e-mail, senha (ajuda
“Mínimo de 8 caracteres”), checkbox legal inicialmente desmarcado e o acesso
secundário “Já tenho uma conta” / “Ir para o login” em `/login`. Os limites do
campo seguem 8–128 caracteres; a política de senha permanece no Backend. Uma
conta já autenticada é redirecionada a `/menu` sem montar o formulário nem
provisionar outra Agenda. Metadados e versões do aceite vêm do Backend;
`/termos` e `/privacidade` publicam os documentos aprovados, preservam
`noindex,nofollow` e retornam a `/cadastro`. `/politica` antigo permanece
independente.
Resposta pública é neutra. `/confirmar-email#token=...` mantém bearer somente em
memória, remove fragmento antes de interação e confirma por botão explícito;
scanner/GET não cria Agenda. Falha transitória oferece retry; expiração permite
reenvio; cadastro vinculado a conta pede login canônico/reabrir link. Conclusão
recarrega lista de vínculos sem trocar automaticamente a Agenda atual.

O link do cadastro para login não transporta `returnTo: /cadastro`; após login,
o destino normal é `/menu`. Login, saga e gate inicial ainda aceitam apenas o
destino interno `/cadastro` quando explicitamente recebido ou o padrão `/menu`;
URLs externas ou caminhos arbitrários não são aceitos. A rota pública de
cadastro não cria outra Agenda para usuário autenticado. Senha, memberships e
clínica ativa anteriores permanecem preservados.

`CommercialProvider`, dentro da árvore isolada por token, consulta `/commercial`
com bearer explícito. Generation guard recusa respostas de sessão anterior;
navigation, foco, minuto e evento de 403 comercial atualizam contexto. Boundary
aguarda validação, oferece retry na falha e impede montar módulos operacionais
quando o Backend informa estado comercial fechado. 403 de expiração preserva
login; 401 mantém seu contrato anterior. Regras comerciais/autorização continuam
canônicas no MFBackend (`docs/regras-negocio/tenant-clinica.md`, TEN-006–TEN-010;
exceção profissional CLI-009 em `prontuario.md`). O Frontend não concede trial.

Home apresenta inicialmente aberta a orientação não bloqueante de cidade/UF e
se atende, com “Preencher depois” para recolher o formulário sem gravar resposta
implícita ou alterar permissões. Inclui checklist compacto recolhível com três
marcos reais.
Links apontam à criação do primeiro serviço, paciente e agendamento; 3/3 remove
o checklist. Header apresenta fim completo no timezone da Agenda e destaque
nos últimos três dias. A página `/situacao-comercial` preserva App Shell,
troca de Agenda/logout e ações do owner informadas pelo Backend: exportar JSON,
registrar interesse em reativação e solicitar exclusão com confirmação explícita
do pedido. Não oferece checkout, cobrança ou exclusão física. No modo legado,
criar segunda Agenda recebe erro explicativo antes de consumir dados/vínculos;
esse fluxo exige rollout membership no Backend.

As ações clínicas mostram `eligible_to_sign` separadamente de
`verification_status`. `temporary_trial_owner` com credenciais pending exibe
“Credenciais profissionais pendentes — uso liberado durante o teste gratuito.”,
sem CREFITO vazio ou identidade verificada. Conselho e identidade verificada
somente aparecem com status verified e região/número efetivos retornados pelo
Backend.

Gates: `src/pages/SelfService/SelfService.test.js` e
`src/contexts/CommercialContext.test.js` cobrem teclado, checkbox, submit ocupado,
erro/retry, fragmento, identidade existente, marcos, orientação, expiração,
timezone e isolamento de resposta antiga; suíte completa, lint, mojibake e build.

`node tests/trial-real-backend.cjs <worktree-backend>` testa o bundle compilado
em Chromium headless a 375px, com Backend/MariaDB descartáveis, teclado, gate
legal, nenhuma Agenda antes da prova, fragmento removido, confirmação explícita
e ausência de overflow horizontal. Usa Playwright externo via `NODE_PATH` e
browser já instalado em `MOTRIA_TEST_BROWSER_EXECUTABLE_PATH`; não compartilha
dependências de aplicação. Interceptação recusa todas as origens fora do único
HTTP loopback; não há envio real ou acesso a produção. Docker e build são
pré-requisitos, e a ausência falha sem skip.

O mesmo gate comprova login real e retorno automático de identidade com duas
clínicas anteriores, confirmação autenticada, preservação da senha e clínica
ativa, consumo único e apresentação visível/adiamento da orientação inicial.
`src/services/axiosCommercialInterceptor.test.js` exercita o interceptor Axios
real com Redux: 403 comercial conserva token/sessão e não navega ao login.

### Refinamentos visuais da landing

O Hero usa altura limitada por viewport e largura, preserva `object-fit: cover` e aceita `title_line_2` como continuação editorial dentro do mesmo `h1`. `eyebrow`, `title` e `title_line_2` são lidos separadamente do documento modular; um `eyebrow` vazio não reativa texto legado. Seções usam revelação progressiva nativa com fallback visível e respeito a `prefers-reduced-motion`. O carrossel inicia automaticamente apenas com múltiplas imagens, pausa em hover ou foco e não expõe controle de play/pausa. Biografias longas são recolhidas com reticências e podem ser expandidas individualmente por botão semântico com rótulo visual "Ver mais" ou "Ver menos".


## Compra e agendamento na Agenda

Novo agendamento começa somente com `PatientSearchField`. Após a seleção,
consulta automaticamente os direitos. Loading e erro não liberam os detalhes
nem assumem novo lançamento; erro permite tentar novamente. Respostas atrasadas
de outro paciente são descartadas. Havendo saldo, apresenta opções por
serviço/pacote, **Usar pacote de outro paciente** (conforme permissão) e
**Registrar novas sessões** no mesmo grupo mutuamente exclusivo. Nenhuma origem vem
selecionada. Sem saldo, mostra aviso discreto e segue automaticamente como
novo lançamento, mantendo o compartilhamento acessível sem confirmação extra.

A consulta inicial é conjunta: direitos em `/patients/:id/available-rights` e
créditos pendentes em `/session-replacement-credits`. O formulário só avança
quando ambas respondem para a seleção atual; erro em qualquer uma bloqueia as
origens, e tentar novamente consulta ambas. Respostas de outra seleção são
ignoradas. Os pacotes usam `purchased_free_rights` como saldo comum, mantendo
`quantity` como total contratado. Unidades disponíveis vinculadas a reposição
não aparecem outra vez como saldo comum; não se calcula esse saldo por subtração
no navegador. Prévia e confirmação de direito próprio enviam
`own_package_right_kind: "purchased"`, respeitando a seleção autoritativa do
Backend. Contrato ausente ou inválido bloqueia o avanço.

Reposições elegíveis aparecem no mesmo grupo de origem, com serviço e origem
clínica já usados pela Agenda. A escolha é explícita inclusive quando só existe
reposição. Status, uso, paciente e validade civil da clínica são conferidos; o
Backend preserva autorização, escopo e coerência da origem. A escolha reutiliza o
formulário e a revisão existentes, com `session_replacement_credit_id`, sem
novo lançamento financeiro, preço sobrescrito, observação de compra ou **Mais
sessões**. Reposição de pacote fixa o serviço; profissional, data, horário e
observações continuam editáveis. Trocar a origem invalida prévias atrasadas.
O modo e as datas do ciclo vêm da origem real para manter a confirmação mensal
fora do ciclo; não são inferidos no navegador. A entrada pela Central de
Pendências mantém seu caminho existente. A aprovação visual pertence a Maurício.

Somente em **Registrar novas sessões** aparecem **Agendar agora** e **Agendar depois**,
usando os controles existentes da Agenda. Ambos usam a mesma seleção de paciente,
serviço, valor e observação de lançamento. Depois solicita quantidade e oculta
profissional, data, horário e observação de sessão; não existe formulário paralelo.
A troca de modo conserva as observações separadas e os campos comuns, sem copiar
uma observação para outra. A programação por quantidade conserva o mesmo número
ao trocar agora/depois; rascunhos por semanas/meses continuam próprios da
programação e não inventam datas para uma compra posterior.

Direito próprio comprado fixa o serviço e mostra **Distribuir sessões na agenda**.
A quantidade vai de 1 até o saldo `purchased_free_rights` do pacote escolhido,
limitada a 500; reposições não aumentam esse limite. Uma unidade usa a revisão
individual existente. Mais unidades reutilizam o gerador por quantidade,
dias da semana e cadência semanal/alternada, sem controles de compra ou preço.
A observação do agendamento é geral e acompanha todas as sessões do lote.
Selecionar parte do saldo existente deixa as demais unidades disponíveis;
isso não altera a regra de compra nova agora, que programa todas as sessões.

Lote próprio usa `/scheduling/occurrences-preview` e confirma em `/session-series`
com `use_own_package: true`, `own_package_right_kind: "purchased"`, pacote/token
de revisão e `creation_mode: "all_or_nothing"`. Não envia compra, observação da
compra, preço, unidades escolhidas no navegador ou crédito de reposição.
Todas as datas do lote precisam estar disponíveis; conflito não é ignorado nem
forçado. Datas podem ser corrigidas na revisão existente, com revalidação do lote.
Atomicidade, limite real, autorização e concorrência pertencem ao Backend.

Resposta perdida congela o rascunho e permite **Verificar distribuição** com o
mesmo payload/chave; alterar a programação confirmada gera outra chave. Saldo
ou revisão alterados por concorrência recarregam os direitos e exigem nova escolha.
Compartilhamento e reposição continuam individuais, sem geração de lote.
Prévias atrasadas de outra seleção de paciente/origem/modo não são reabertas nem
confirmadas. Trocar paciente limpa origem, observações e seleção anterior antes
de consultar seus direitos. Edição e reposição pela Central de Pendências
mantêm seus caminhos existentes.

Uma unidade aparece como Avulsa e duas ou mais como Pacote no histórico e
Financeiro. A revisão de compra programada exige selecionar todas as sessões;
as datas podem ser corrigidas, mas não há compra parcialmente programada.
Reserva própria usa a revisão normal de disponibilidade/alertas. Observação de
lançamento e de sessão são campos opcionais separados. Comandos repetidos
reutilizam a chave do mesmo payload; alterações geram outra confirmação.

O grupo **Como deseja continuar?** apresenta opções compactas: serviço e quantidade total contratada na primeira linha, saldo não agendado na segunda. `quantity` é o total real do contrato, não o saldo; ausência de total não inventa quantidade. O ID aparece discretamente somente quando há mais de um pacote do mesmo serviço. **Usar pacote de outro paciente** e **Registrar novas sessões** mantêm as origens existentes. Os apoios explicativos do grupo e de agora/depois foram removidos. A entrada externa continua **Novo agendamento**.

A escolha de origem usa `fieldset/legend` acessível. Novo agendamento tem dois
passos no mesmo formulário: paciente/origem e, após **Avançar**, detalhes com
resumo do paciente e origem. A consulta completa governa o avanço; havendo
direitos, nenhuma origem é presumida. Sem direitos, o novo lançamento é
selecionado e os detalhes aparecem automaticamente, com aviso discreto, sem
confirmação adicional. **Voltar** preserva o rascunho e invalida a revisão em
andamento; permite selecionar compartilhamento mesmo sem saldo próprio.
Trocar paciente limpa a origem e as observações antes de consultar novamente.
Uma resposta tardia não reabre a revisão da escolha anterior.

A seção de detalhes usa divisória e espaçamentos dos tokens existentes. O
título contextual é **Agendar sessão**, **Agendar reposição**, **Pacote de outro
paciente** ou **Novas sessões**. O titular compartilhado fica nessa seção;
**Agendar agora/depois** fica dentro de **Novas sessões**, em grupo acessível.
Saldo usa tipografia secundária e os grids mantêm uma coluna no mobile. Edição
e entrada direta pela Central de Pendências preservam sua estrutura.

**Observação da compra (opcional)** fica junto aos valores e usa `launch_notes`;
**Observação do agendamento (opcional)** fica junto à programação e usa `notes`.
São independentes e permanecem separadas ao trocar agora/depois. Compra para
depois não envia observação de agendamento. Edição preserva **Motivo da alteração**.
A observação da compra retornada pelo Backend aparece nos detalhes do pacote
no Histórico e nos detalhes da cobrança do Financeiro. Ausência de `launch_notes`
não é preenchida com observação de sessão ou recebimento. O antigo aviso de
registro da compra hoje foi removido; os contratos financeiros permanecem.

Cancelar unidades disponíveis está somente em Paciente → Histórico → Pacotes e sessões avulsas, junto de cada pacote e seu saldo disponível, para
gestão da Agenda com alcance de clínica. Mostra contagem e aviso de manutenção
das cobranças, motivo opcional, prévia e confirmação. Resultado incerto congela
o comando e permite verificar a mesma tentativa; revisão vencida exige outra
prévia. Pendência financeira de direito sem sessão usa o modal de acerto
existente, sem data fictícia. IDs canônicos `key` evitam colisão de contrato
sem série com séries legadas. Regras autoritativas: AGE-015 e FIN-016 do Backend.
