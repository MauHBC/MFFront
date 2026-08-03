#!/usr/bin/env bash

set -Eeuo pipefail

REPO_DIR="${MF_FRONTEND_REPO_DIR:-/opt/apps/mffront}"
DEPLOY_ROOT="${MF_FRONTEND_DEPLOY_ROOT:-/var/www/espacocuidarvix-frontend}"
WORKTREE_ROOT="${MF_FRONTEND_WORKTREE_ROOT:-/opt/apps/.deploy-worktrees}"
RELEASES_DIR="${DEPLOY_ROOT}/releases"
CURRENT_LINK="${DEPLOY_ROOT}/current"
PREVIOUS_LINK="${DEPLOY_ROOT}/previous"
DOMAINS=("espacocuidarvix.com.br" "cmtrfisio.com.br")

TARGET_REF="origin/main"
DRY_RUN=false
ASSUME_YES=false
WORKTREE_DIR=""
WORKTREE_CREATED=false
TIMESTAMP=""

usage() {
  printf '%s\n' \
    'Uso:' \
    '  deploy-production.sh [--ref <git-ref>] [--dry-run] [--yes]' \
    '' \
    'Opções:' \
    '  --ref <git-ref>  Commit ou referência a publicar. Padrão: origin/main.' \
    '  --dry-run        Mostra release atual, commits e diff sem publicar.' \
    '  --yes            Não pede confirmação interativa. Use apenas em automação.' \
    '  -h, --help       Mostra esta ajuda.'
}

fail() {
  printf 'ERRO: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "comando obrigatório ausente: $1"
}

read_version_commit() {
  node -e '
    const fs = require("fs");
    const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (!payload.commit) process.exit(2);
    process.stdout.write(String(payload.commit).trim());
  ' "$1"
}

read_stdin_version_commit() {
  node -e '
    const fs = require("fs");
    const payload = JSON.parse(fs.readFileSync(0, "utf8"));
    if (!payload.commit) process.exit(2);
    process.stdout.write(String(payload.commit).trim());
  '
}

atomic_link() {
  local target="$1"
  local link_path="$2"
  local temp_link="${link_path}.next-${TIMESTAMP}"

  [[ ! -e "$temp_link" && ! -L "$temp_link" ]] \
    || fail "link temporário já existe: $temp_link"
  ln -s "$target" "$temp_link"
  mv -Tf "$temp_link" "$link_path"
}

cleanup() {
  if [[ "$WORKTREE_CREATED" == true && -n "$WORKTREE_DIR" ]]; then
    case "$WORKTREE_DIR" in
      "${WORKTREE_ROOT}"/*)
        git -C "$REPO_DIR" worktree remove --force "$WORKTREE_DIR" \
          >/dev/null 2>&1 || true
        ;;
    esac
  fi
}

trap cleanup EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref)
      [[ $# -ge 2 ]] || fail "--ref exige um valor"
      TARGET_REF="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --yes)
      ASSUME_YES=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "opção desconhecida: $1"
      ;;
  esac
done

for command_name in git npm node curl readlink ln mv date; do
  require_command "$command_name"
done

[[ "$(id -u)" -eq 0 ]] || fail "execute como root no servidor de produção"
[[ -d "$REPO_DIR/.git" ]] || fail "repositório não encontrado em $REPO_DIR"
[[ -d "$RELEASES_DIR" ]] \
  || fail "diretório de releases não encontrado: $RELEASES_DIR"
[[ -d "$WORKTREE_ROOT" ]] \
  || fail "raiz de worktrees não encontrada: $WORKTREE_ROOT"
[[ -L "$CURRENT_LINK" ]] || fail "current não é um symlink: $CURRENT_LINK"

CURRENT_RELEASE="$(readlink -f "$CURRENT_LINK")"
case "$CURRENT_RELEASE" in
  "${RELEASES_DIR}"/*) ;;
  *) fail "current aponta para fora de releases: $CURRENT_RELEASE" ;;
esac

CURRENT_VERSION_FILE="${CURRENT_RELEASE}/app-version.json"
[[ -f "$CURRENT_VERSION_FILE" ]] \
  || fail "app-version.json ausente no release atual"
CURRENT_COMMIT="$(read_version_commit "$CURRENT_VERSION_FILE")"

printf 'Atualizando referências remotas...\n'
git -C "$REPO_DIR" fetch --prune origin

TARGET_COMMIT="$(git -C "$REPO_DIR" rev-parse "${TARGET_REF}^{commit}")"
TARGET_SHORT="$(git -C "$REPO_DIR" rev-parse --short=12 "$TARGET_COMMIT")"
ORIGIN_MAIN="$(git -C "$REPO_DIR" rev-parse 'origin/main^{commit}')"

git -C "$REPO_DIR" merge-base --is-ancestor "$TARGET_COMMIT" "$ORIGIN_MAIN" \
  || fail "o alvo $TARGET_COMMIT não pertence a origin/main"
git -C "$REPO_DIR" cat-file -e "${CURRENT_COMMIT}^{commit}" \
  || fail "commit publicado não existe no repositório local: $CURRENT_COMMIT"

printf '\nRelease publicado: %s\n' "$CURRENT_RELEASE"
printf 'Commit publicado:  %s\n' "$CURRENT_COMMIT"
printf 'Referência alvo:   %s\n' "$TARGET_REF"
printf 'Commit alvo:       %s\n\n' "$TARGET_COMMIT"

printf 'Commits no alvo e ausentes da história publicada:\n'
git -C "$REPO_DIR" log --oneline --reverse \
  "${CURRENT_COMMIT}..${TARGET_COMMIT}" || true

printf '\nDiferença efetiva de arquivos:\n'
git -C "$REPO_DIR" diff --stat "$CURRENT_COMMIT" "$TARGET_COMMIT"
git -C "$REPO_DIR" diff --name-status "$CURRENT_COMMIT" "$TARGET_COMMIT"

if git -C "$REPO_DIR" diff --quiet "$CURRENT_COMMIT" "$TARGET_COMMIT"; then
  printf '\nNenhuma diferença efetiva para publicar.\n'
  exit 0
fi

if [[ "$DRY_RUN" == true ]]; then
  printf '\nDry-run concluído; nenhum release foi alterado.\n'
  exit 0
fi

if [[ "$ASSUME_YES" != true ]]; then
  expected="DEPLOY ${TARGET_SHORT}"
  printf '\nDigite exatamente "%s" para continuar: ' "$expected"
  read -r confirmation
  [[ "$confirmation" == "$expected" ]] \
    || fail "confirmação divergente; deploy cancelado"
fi

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORKTREE_DIR="${WORKTREE_ROOT}/mffront-${TARGET_SHORT}-${TIMESTAMP}"
RELEASE_DIR="${RELEASES_DIR}/${TARGET_SHORT}-${TIMESTAMP}"

case "$WORKTREE_DIR" in
  "${WORKTREE_ROOT}"/*) ;;
  *) fail "worktree fora da raiz permitida" ;;
esac
case "$RELEASE_DIR" in
  "${RELEASES_DIR}"/*) ;;
  *) fail "release fora da raiz permitida" ;;
esac

[[ ! -e "$WORKTREE_DIR" ]] || fail "worktree já existe: $WORKTREE_DIR"
[[ ! -e "$RELEASE_DIR" ]] || fail "release já existe: $RELEASE_DIR"

printf '\nCriando worktree em %s...\n' "$WORKTREE_DIR"
git -C "$REPO_DIR" worktree add --detach "$WORKTREE_DIR" "$TARGET_COMMIT"
WORKTREE_CREATED=true

printf 'Instalando dependências bloqueadas pelo package-lock...\n'
npm --prefix "$WORKTREE_DIR" ci --no-audit --no-fund

printf 'Compilando commit %s...\n' "$TARGET_SHORT"
npm --prefix "$WORKTREE_DIR" run build

[[ -f "$WORKTREE_DIR/build/index.html" ]] \
  || fail "build não gerou index.html"
[[ -f "$WORKTREE_DIR/build/app-version.json" ]] \
  || fail "build não gerou app-version.json"
BUILT_COMMIT="$(read_version_commit "$WORKTREE_DIR/build/app-version.json")"
[[ "$BUILT_COMMIT" == "$TARGET_SHORT" ]] \
  || fail "build registrou commit $BUILT_COMMIT; esperado $TARGET_SHORT"

printf 'Criando release imutável %s...\n' "$RELEASE_DIR"
mv "$WORKTREE_DIR/build" "$RELEASE_DIR"

printf 'Atualizando previous e current atomicamente...\n'
atomic_link "$CURRENT_RELEASE" "$PREVIOUS_LINK"
atomic_link "$RELEASE_DIR" "$CURRENT_LINK"

smoke_failed=false
for domain in "${DOMAINS[@]}"; do
  printf 'Validando https://%s/...\n' "$domain"
  if ! curl -fsS "https://${domain}/?deploy=${TARGET_SHORT}" >/dev/null; then
    smoke_failed=true
    break
  fi

  if ! live_commit="$(
    curl -fsS "https://${domain}/app-version.json?deploy=${TARGET_SHORT}" \
      | read_stdin_version_commit
  )"; then
    smoke_failed=true
    break
  fi

  if [[ "$live_commit" != "$TARGET_SHORT" ]]; then
    printf 'Commit inesperado em %s: %s\n' "$domain" "$live_commit" >&2
    smoke_failed=true
    break
  fi
done

if [[ "$smoke_failed" == true ]]; then
  printf 'Smoke test falhou; revertendo current para %s...\n' \
    "$CURRENT_RELEASE" >&2
  atomic_link "$CURRENT_RELEASE" "$CURRENT_LINK"
  fail "deploy revertido automaticamente"
fi

printf '\nDeploy concluído.\n'
printf 'Release atual: %s\n' "$(readlink -f "$CURRENT_LINK")"
printf 'Release anterior: %s\n' "$(readlink -f "$PREVIOUS_LINK")"
printf 'Commit publicado: %s\n' "$TARGET_SHORT"
