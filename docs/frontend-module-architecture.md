# Arquitetura do MFFrontend

Este documento é a fonte oficial para a landing pública, seus contextos e os
padrões dos módulos autenticados.

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
  desenvolvimento, o frontend usa `http://localhost:3000` e o backend local
  normalmente usa `http://localhost:3006`.

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

### Autorização oficial e fail-closed

`AuthorizationProvider` carrega `/team/authorization-context` para a identidade
e o token atuais e aceita o catálogo oficial na versão `7`. Sidebar, atalhos e `MyRoute` usam exclusivamente os módulos,
níveis e capacidades desse contrato. O frontend não consulta grupo ou nome de
perfil para conceder acesso, não replica o resolvedor e somente considera
administrativo o booleano literal `is_administrator === true` em um contexto
válido e `authorized`.

Durante `idle`, `loading`, `invalid`, `no_permissions`, `403` ou erro de
carregamento, o módulo protegido não é montado. Acesso direto por URL recebe a
mesma negação do guard; ainda assim, o backend é a autoridade final e precisa
negar a API independentemente do estado visual. Ocultar item da navegação nunca
substitui autorização.

O contexto não é persistido em `localStorage`. Logout, troca de token, troca de
usuário ou desmontagem invalidam a geração corrente e fecham imediatamente o
shell protegido. Respostas assíncronas de uma sessão anterior, inclusive erros,
não podem substituir o contexto da nova identidade.

Agenda usa somente as projeções reduzidas `/schedule/references/*`. A
permissão de Agenda não libera os diretórios amplos de Pacientes ou Usuários;
cada módulo e endpoint mantém seu próprio gate.

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
ativos por `/documents/templates`, inicia com o padrão selecionado e envia o
`template_id` escolhido; o Backend deriva a clínica autenticada e o navegador
nunca escolhe tenant.

Acionar o preview sem atendimento selecionado mantém o fluxo no modal e oferece
orientação explícita para escolher uma sessão recente ou buscar outra por data.
Depois de gerado, o preview usa a mesma hierarquia visual de folha do editor de
modelos — logo disponível, nome da clínica, título documental e corpo editável —
para se aproximar da saída impressa sem retirar a edição pontual do texto.

O editor administrativo de modelos apresenta o corpo editável em uma folha que
reproduz a hierarquia da declaração, com logo disponível no contexto
autenticado, nome da clínica e título documental. Tipo e nome do modelo ficam em
campos compactos fora da folha; o corpo continua sendo um `textarea` nativo,
responsivo, delimitado mesmo fora de hover/foco e sem rich-text. As variáveis
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

Pessoa, atuação profissional, conta e perfil continuam entidades distintas. A
identidade profissional é cadastrada e editada em drawer próprio, por um único
comando transacional do backend; a interface não ativa a atuação em uma
requisição separada. CREFITO não concede permissão nem substitui o vínculo
canônico da conta com a pessoa e a clínica. Profissionais existentes sem dados
de identidade permanecem pendentes até revisão administrativa manual.

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

### Fronteira compartilhada de recebimentos no Financeiro

Os recebimentos ativos por sessão e por Mensalidades compartilham a fronteira
`src/pages/Financeiro/hooks/useFinancialPaymentFlow.js` e o componente
`src/pages/Financeiro/components/FinancialPaymentModal.js`. O hook concentra o
estado e o preview do modal, validações, descontos, alocação proporcional e a
criação do payment anchor e do pagamento; o componente concentra a apresentação
desse fluxo. A página fornece os dados e o callback de recarga, sem transferir
roteamento ou orquestração global para essa fronteira.

O preview permite recebimento parcial com desconto: o saldo pendente é calculado
sobre o total ajustado, enquanto o backend permanece a autoridade da alocação e
da persistência final.

Cada confirmação lógica mantém uma única `Idempotency-Key` e o mesmo payment
anchor enquanto a requisição está pendente ou um erro ambíguo pode exigir retry.
Duplo clique não abre outra tentativa material. Alterar o comando ou abrir uma
nova operação gera nova chave e novo anchor; o serviço envia a chave somente no
header do POST de `financial-payments`.

Detalhes, cache, crédito e preview específicos de sessão permanecem no fluxo de
sessões. Filtros, agrupamento, resolução de BillingCycle, preview de sessões e
renderização de Mensalidades permanecem no fluxo de Mensalidades. A visão
dedicada de Recebimentos continua desabilitada intencionalmente e fora dessa
capacidade compartilhada ativa.

### Despesas da clínica

Em Despesas, a ação **Desfazer pagamento** solicita um motivo antes de reabrir
a despesa. O Frontend bloqueia motivo vazio e não chama a API quando o usuário
cancelar. Na confirmação, envia `PATCH /clinic-expenses/:id/unpay` com
`{ reason }` e, após sucesso, recarrega a listagem para apresentar a despesa
novamente como pendente. O Backend permanece responsável por validar e auditar
o desfazimento.

---

## App Shell autenticado

O shell global fica em `src/components/AppShell`. `AppShell/index.js` renderiza
sidebar, cabeçalho, drawer mobile, menu do usuário e landmarks;
`navigation.js` é a fonte declarativa dos destinos, visibilidade e rota ativa;
`styled.js` contém a estrutura responsiva; e `styles/tokens.js` define os tokens
semânticos usados pelo shell.

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
  conteúdo; fixar reserva `256px`. Compacto reserva `76px`.
- O controle de fixação aparece no cabeçalho somente quando a sidebar desktop
  está expandida. O nome acessível e o tooltip mudam entre “Fixar sidebar” e
  “Desafixar sidebar”.
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

Drawer lateral para CRUD. Sempre fixo na direita, `top: 80px` (abaixo da navbar), animação por `transform`. Sempre presente no DOM — visibilidade controlada por `$open`.

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

---

### `AppForm` — `src/components/AppForm`

Estrutura de campos em formulários simples de drawer.

| Componente | Uso |
|---|---|
| `Field` | `<label>` wrapper — envolve rótulo + elemento nativo |
| `FieldHint` | Texto auxiliar abaixo do campo |

**Padrão:** usar elementos HTML nativos (`<input>`, `<select>`, `<textarea>`) diretamente dentro de `<Field>`. Não criar componentes `Input`, `Select` ou `TextArea` separados sem necessidade clara.

---

## Padrão oficial: módulo sem sidebar (Shell 1)

Use este shell para módulos CRUD administrativos simples, com uma entidade principal, drawer lateral e opcionalmente abas. Sem navegação lateral.

**Exemplos:** Planos, Agendamentos, Pacientes, qualquer CRUD futuro.
**Template canônico:** `src/templates/StandardModuleTemplate.js`
**Referência real:** `src/pages/Planos/index.js`

Na Administração do plano mensal, a aba Histórico consome o endpoint paginado
`GET /patient-plans/:id/history`. Ela não reconstrói pausas, cancelamentos ou
trocas comerciais a partir do estado atual do vínculo e nunca renderiza os
snapshots JSON internos.

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

O endereço geral de Contato é omitido nessa área quando coincide com o endereço de uma unidade visível. O rodapé não repete o endereço completo quando não existem campos estruturados suficientes para um resumo confiável. O acesso administrativo não aparece no cabeçalho público e permanece no rodapé como "Área da equipe" / "Entrar no sistema", apontando para `/login`. O link "Estrutura" aponta para `#gallery` e só é oferecido quando a Galeria está visível.

### Refinamentos visuais da landing

O Hero usa altura limitada por viewport e largura, preserva `object-fit: cover` e aceita `title_line_2` como continuação editorial dentro do mesmo `h1`. `eyebrow`, `title` e `title_line_2` são lidos separadamente do documento modular; um `eyebrow` vazio não reativa texto legado. Seções usam revelação progressiva nativa com fallback visível e respeito a `prefers-reduced-motion`. O carrossel inicia automaticamente apenas com múltiplas imagens, pausa em hover ou foco e não expõe controle de play/pausa. Biografias longas são recolhidas com reticências e podem ser expandidas individualmente por botão semântico com rótulo visual "Ver mais" ou "Ver menos".
