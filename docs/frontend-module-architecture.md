# Arquitetura de Módulos Frontend — Padrão Oficial

> Documento de referência para criação e manutenção de módulos administrativos no frontend.
> Reflete o padrão consolidado nas microetapas 1–17 (Planos, Agendamentos, Financeiro).

---

## Objetivo

Garantir que todos os módulos novos e futuras evoluções sigam a mesma estrutura visual e arquitetural, reduzindo duplicação, acelerando desenvolvimento e mantendo consistência para o usuário.

---

## Princípios

1. **Componente compartilhado primeiro.** Antes de criar qualquer `styled-component` local, verificar se já existe um componente compartilhado (`AppLayout`, `AppDrawer`, etc.) que atenda a necessidade.
2. **Local só com divergência real e justificada.** Criar definição local apenas quando o visual ou comportamento requerido genuinamente diverge do componente compartilhado e essa divergência não pode ser resolvida com props.
3. **Parametrização antes de fork.** Se um componente compartilhado quase atende, adicionar a prop necessária a ele em vez de duplicar o componente localmente.
4. **Zero mudança silenciosa.** Nunca alterar um componente compartilhado sem checar o impacto em todos os módulos que o consomem.
5. **Consistência com os módulos de referência.** Em caso de dúvida de padrão, consultar Planos (estrutura), Agendamentos (drawer/interação) e Financeiro (organização por abas).

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
| `StatusPill` | `$tone="paused"` | Âmbar |
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

## Padrão oficial: módulo com sidebar (Shell 2)

Use este shell quando o módulo tiver múltiplas seções funcionais independentes que precisam de navegação lateral persistente e colapsável (ex: Financeiro, dashboards operacionais).

**Template canônico:** `src/templates/SidebarModuleTemplate.js`
**Referência real:** `src/pages/Financeiro/index.js`

> Regra: novo módulo com sidebar nasce do template, não de uma cópia do Financeiro.

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

## Shell 1 vs Shell 2 — quando usar cada um

| Critério | Shell 1 (sem sidebar) | Shell 2 (com sidebar) |
|---|---|---|
| Entidades | 1 principal (com CRUD) | Múltiplas seções independentes |
| Navegação | Abas lineares (opcional) | Sidebar colapsável persistente |
| Complexidade | Baixa / média | Alta |
| Template | `StandardModuleTemplate.js` | `SidebarModuleTemplate.js` |
| Referência real | `Planos` | `Financeiro` |
| Drawer CRUD | Sim (padrão) | Sim (por seção) |
| PageWrapper | `AppLayout.PageWrapper` | `AppSidebarShell.SidebarShellWrapper` |
| Container interno | `AppLayout.PageContent` | `AppSidebarShell.SidebarMainArea` |

**Regra de decisão:** se o módulo novo precisar de mais de 3 seções funcionais com navegação própria entre elas, use Shell 2. Caso contrário, use Shell 1 com abas.

**Regra de origem:** todo módulo novo parte do template oficial do shell escolhido. Nunca copie código de uma página existente.

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

**Shell (escolher um)**
- [ ] Shell 1 (sem sidebar): usa `PageWrapper` + `PageContent` do `AppLayout`?
- [ ] Shell 2 (com sidebar): partiu do `src/templates/SidebarModuleTemplate.js`?
- [ ] Shell 2: usa `SidebarShellWrapper` + `SidebarShellLayout` + `SidebarMainArea`?
- [ ] Shell 2: usa `AppSidebar` + `AppSidebarHeader` + `AppSidebarSection` + `AppSidebarButton`?
- [ ] Shell 2: `AppSidebar` está dentro de `SidebarShellWrapper` (CSS vars obrigatórias)?

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
