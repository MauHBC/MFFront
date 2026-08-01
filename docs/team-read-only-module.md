# Equipe — pessoas, perfis e atribuições

O módulo autenticado `/equipe` usa exclusivamente contratos tenant-scoped do
backend. `AuthorizationProvider` consulta `/team/authorization-context` em
memória após o login; não persiste autorização em `localStorage` e falha
fechado. O item Equipe aparece no App Shell somente para Administrador
estrutural que possua `access_profiles.manage`.

A página consulta pessoas, perfis, catálogo, atribuições e contas vinculáveis.
As junções de apresentação usam apenas `person_id`, `user_id` e `profile_id` dos
DTOs oficiais. Conta sem pessoa e profissional sem login permanecem estados
distintos.

A Etapa 2 reutiliza somente os contratos oficiais de pessoa para:

- criar pessoa sem conta de acesso;
- criar pessoa com atuação profissional, ainda sem conta;
- editar nome, e-mail e telefone;
- reativar somente a pessoa, sem reativar profissional ou conta.

Os payloads nunca incluem `clinic_id`, senha, conta, grupo, perfil ou permissão.
O formulário preserva valores após erro, bloqueia envio duplicado e confirma o
descarte de alterações pendentes. O drawer de permissões continua estritamente
somente para consulta.

A Etapa 3 acrescenta criação e edição de perfis personalizados e atribuição de
um ou vários perfis a contas existentes. Administrador e Profissional são
exibidos como nativos e bloqueados para edição, conforme o contrato oficial.
Pessoa ou profissional sem conta não recebe controles de atribuição. Módulos,
níveis, escopos, exportação e capacidades são renderizados a partir do catálogo
recebido; o frontend não calcula permissões efetivas. A composição exibida vem
do backend, que usa o resolvedor oficial.

Cada inclusão ou remoção é enviada aos endpoints tenant-scoped já existentes.
Inclusões são processadas antes de remoções, e cada operação é transacional,
auditada, invalida `auth_version` e preserva a proteção do último Administrador.

O catálogo recebido define módulos, combinações, capacidades, dependências e
poderes exclusivos. O frontend mantém somente rótulos de apresentação em
português; não replica a matriz de autorização nem decide permissões clínicas.
O backend continua como autoridade final.

Esta etapa não oferece criação de login, senha, convite, edição de perfis
nativos, exclusão de perfil, inativação profissional, transferência de agenda
ou pacientes.
