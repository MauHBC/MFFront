# Deploy de produção do MFFrontend

Este documento é a fonte canônica para identificar, comparar, publicar e
reverter o frontend compartilhado do Multifisio.

O arquivo `release-win.sh` é legado e não deve ser usado como procedimento de
publicação. Ele não substitui este runbook nem
`scripts/deploy-production.sh`.

## Fonte da verdade

O Nginx atende `espacocuidarvix.com.br` e `cmtrfisio.com.br` a partir de:

```text
/var/www/espacocuidarvix-frontend/current
```

`current` é um symlink para um release imutável em:

```text
/var/www/espacocuidarvix-frontend/releases/<commit>-<timestamp>
```

O checkout `/opt/apps/mffront` existe para Git, dependências e manutenção. Ele
não é servido pelo Nginx. Nunca use seu `HEAD`, seu atraso em relação ao remoto
ou sua pasta `build` para concluir o que está publicado.

## Identificar a versão publicada

Execute no servidor:

```bash
readlink -f /var/www/espacocuidarvix-frontend/current
curl -fsS https://espacocuidarvix.com.br/app-version.json
curl -fsS https://cmtrfisio.com.br/app-version.json
```

O campo `commit` de `app-version.json` é o identificador do código compilado.
Os dois domínios devem retornar o mesmo commit e os mesmos assets principais.

Para comparar com o Git:

```bash
git -C /opt/apps/mffront fetch --prune origin
git -C /opt/apps/mffront log --oneline --reverse <commit-publicado>..origin/main
git -C /opt/apps/mffront diff --stat <commit-publicado> origin/main
git -C /opt/apps/mffront diff --name-status <commit-publicado> origin/main
```

O `log` mostra a história; o `diff` mostra a diferença efetiva. Quando houve
cherry-pick, hotfix ou ramos paralelos, o `diff` é indispensável para não contar
como pendente uma alteração que já está presente no artefato.

## Invariantes do deploy

- O alvo deve ser um commit exato alcançável por `origin/main`.
- O build deve ocorrer em worktree descartável, nunca no checkout publicado.
- Dependências devem ser instaladas pelo `package-lock.json` com `npm ci`.
- O release deve ser imutável e nomeado com commit e timestamp UTC.
- `app-version.json` deve registrar o mesmo commit escolhido para o deploy.
- A troca de `current` deve ser atômica.
- O release anterior deve permanecer acessível por `previous` para rollback.
- Os dois domínios devem passar pelo smoke test antes de concluir.
- Não é necessário recarregar o Nginx quando apenas o symlink muda.

## Procedimento recomendado

Atualize apenas o checkout auxiliar para obter o script. Isso não publica nada:

```bash
git -C /opt/apps/mffront status --short --branch
git -C /opt/apps/mffront pull --ff-only origin main
```

Se o checkout auxiliar estiver sujo, pare e preserve as alterações antes do
pull. Em seguida, primeiro execute o planejamento sem alterar o release:

```bash
bash /opt/apps/mffront/scripts/deploy-production.sh \
  --ref origin/main \
  --dry-run
```

Revise o release atual, os commits e o diff efetivo exibidos. Para publicar:

```bash
bash /opt/apps/mffront/scripts/deploy-production.sh --ref origin/main
```

O script pede a confirmação exata do commit. `--yes` existe para automação
controlada e não deve ser usado como padrão em operação manual.

## O que o script faz

1. Resolve `current` e lê o commit de `app-version.json`.
2. Atualiza somente as referências remotas do Git.
3. Resolve o commit alvo e exige que ele esteja em `origin/main`.
4. Exibe `git log`, `git diff --stat` e `git diff --name-status`.
5. Cria um worktree descartável no commit exato.
6. Executa `npm ci` e `npm run build`.
7. Confere o commit gravado no build.
8. Move o build para um release imutável.
9. Atualiza `previous` e troca `current` atomicamente.
10. Valida página e `app-version.json` nos dois domínios.
11. Reverte `current` automaticamente se o smoke test falhar.

## Rollback manual

O rollback preferencial usa o symlink `previous`:

```bash
readlink -f /var/www/espacocuidarvix-frontend/previous
ln -s "$(readlink -f /var/www/espacocuidarvix-frontend/previous)" \
  /var/www/espacocuidarvix-frontend/.current-rollback
mv -Tf /var/www/espacocuidarvix-frontend/.current-rollback \
  /var/www/espacocuidarvix-frontend/current
```

Depois valide os dois domínios e seus respectivos `app-version.json`. Não
remova releases durante o incidente; a limpeza deve ocorrer separadamente,
depois da estabilização.

## Exceção histórica de 2026-08-03

O release criado para remover o manifesto PWA foi compilado como um cherry-pick
isolado sobre o release então publicado. Seu conteúdo equivale ao commit
`ddf2ab6` mais a alteração `d37cb17`, mas o `app-version.json` registra o commit
temporário `18cf6ae`. Essa exceção não deve ser repetida. O próximo deploy deve
usar um commit exato de `origin/main`, restabelecendo a rastreabilidade direta.
