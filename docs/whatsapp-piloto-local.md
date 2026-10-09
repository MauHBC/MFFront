# Prévia local WhatsApp

Estado: componente experimental isolado em `src/pages/Agendamentos/WhatsAppSimulation.js`.
Não está integrado à Agenda autenticada. As regras e limites atuais são descritos
na fonte do MFBackend `docs/arquitetura/whatsapp-piloto-local.md`.

O perfil fechado `MOTRIA_LOCAL_STACK_SLOT=whatsapp-pilot` usa Frontend
`127.0.0.1:3050` e Backend descartável `127.0.0.1:3056`. Execute `npm ci` e
`npm run dev` com esse perfil e `BROWSER=none`. Acesse
`http://127.0.0.1:3050/whatsapp-simulacao` depois de iniciar o runner Backend
autorizado. Nenhum paciente/contato é real. A interface mostra permanentemente
“Simulação — nenhuma mensagem será enviada”. A validação visual pertence a Maurício.

O entrypoint só seleciona o componente em development, loopback, porta e rota
exatos. Webpack elimina o módulo do bundle de produção. O restante da aplicação
continua usando `App`. Os comandos usam revisão explícita e CSRF da fixture.

Ainda é necessário integrar ações, seleção, permissões e acompanhamento ao
fluxo normal da Agenda, com autorização e persistência próprias no Backend.
A prévia não deve ser apresentada como conclusão integral da sprint.

DOCUMENTATION_IMPACT: UPDATE_REQUIRED
