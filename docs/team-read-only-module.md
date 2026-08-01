# Equipe — consulta e cadastro de pessoas

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

O catálogo recebido define módulos, combinações, capacidades, dependências e
poderes exclusivos. O frontend mantém somente rótulos de apresentação em
português; não replica a matriz de autorização nem decide permissões clínicas.
O backend continua como autoridade final.

Esta etapa não oferece criação de login, senha, convite, atribuição de perfil,
edição de permissões, inativação profissional, transferência de agenda ou
pacientes.
