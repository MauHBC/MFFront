# Equipe em modo de consulta

O módulo autenticado `/equipe` usa exclusivamente contratos tenant-scoped do
backend. `AuthorizationProvider` consulta `/team/authorization-context` em
memória após o login; não persiste autorização em `localStorage` e falha
fechado. O item Equipe aparece no App Shell somente para Administrador
estrutural que possua `access_profiles.manage`.

A página consulta pessoas, perfis, catálogo, atribuições e contas vinculáveis.
As junções de apresentação usam apenas `person_id`, `user_id` e `profile_id` dos
DTOs oficiais. Conta sem pessoa e profissional sem login permanecem estados
distintos. Nenhuma operação `POST`, `PUT`, `PATCH` ou `DELETE` é chamada.

O catálogo recebido define módulos, combinações, capacidades, dependências e
poderes exclusivos. O frontend mantém somente rótulos de apresentação em
português; não replica a matriz de autorização nem decide permissões clínicas.
O backend continua como autoridade final.

Esta etapa não oferece criação, edição, atribuição, senha, inativação,
transferência ou auditoria.
