#!/usr/bin/env bash
set -Eeuo pipefail

APP_URL="${1:-${APP_URL:-}}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"

say() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

require_sudo() {
  if [[ "${EUID}" -eq 0 ]]; then
    SUDO=""
  else
    SUDO="sudo"
  fi
}

detect_app_url() {
  if [[ -n "${APP_URL}" ]]; then
    return
  fi

  local ip
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  if [[ -z "${ip}" ]]; then
    ip="localhost"
  fi
  APP_URL="http://${ip}:8080"
}

random_hex() {
  openssl rand -hex "${1:-24}"
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    say "Docker e Docker Compose ja estao instalados."
    return
  fi

  say "Instalando dependencias do sistema e Docker..."
  ${SUDO} apt-get update
  ${SUDO} apt-get install -y ca-certificates curl gnupg lsb-release git openssl ufw

  ${SUDO} install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | ${SUDO} gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    ${SUDO} chmod a+r /etc/apt/keyrings/docker.gpg
  fi

  local codename
  codename="$({ . /etc/os-release && printf '%s' "${VERSION_CODENAME:-}"; } 2>/dev/null || true)"
  if [[ -z "${codename}" ]]; then
    codename="focal"
  fi

  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu %s stable\n' \
    "$(dpkg --print-architecture)" "${codename}" | ${SUDO} tee /etc/apt/sources.list.d/docker.list >/dev/null

  ${SUDO} apt-get update
  ${SUDO} apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  ${SUDO} systemctl enable --now docker

  if [[ -n "${SUDO}" ]]; then
    ${SUDO} usermod -aG docker "${USER}" || true
  fi
}

ensure_swap() {
  local total_mem_mb
  total_mem_mb="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
  if [[ "${total_mem_mb}" -ge 2500 ]] || swapon --show | grep -q .; then
    return
  fi

  say "VM com pouca memoria detectada. Criando swap de 4GB para conversao de PPT/PDF..."
  if [[ ! -f /swapfile-signage ]]; then
    ${SUDO} fallocate -l 4G /swapfile-signage || ${SUDO} dd if=/dev/zero of=/swapfile-signage bs=1M count=4096
    ${SUDO} chmod 600 /swapfile-signage
    ${SUDO} mkswap /swapfile-signage
  fi
  ${SUDO} swapon /swapfile-signage || true
  if ! grep -q '^/swapfile-signage ' /etc/fstab; then
    printf '/swapfile-signage none swap sw 0 0\n' | ${SUDO} tee -a /etc/fstab >/dev/null
  fi
}

write_env() {
  detect_app_url
  if [[ -f "${ENV_FILE}" ]]; then
    say ".env ja existe. Mantendo configuracao atual."
    return
  fi

  say "Criando .env para ${APP_URL}..."
  local postgres_password minio_password jwt_secret
  postgres_password="$(random_hex 18)"
  minio_password="$(random_hex 18)"
  jwt_secret="$(random_hex 32)"

  cat >"${ENV_FILE}" <<ENV
POSTGRES_DB=signage
POSTGRES_USER=signage
POSTGRES_PASSWORD=${postgres_password}
DATABASE_URL=postgresql://signage:${postgres_password}@postgres:5432/signage
REDIS_URL=redis://redis:6379
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=signageadmin
MINIO_SECRET_KEY=${minio_password}
MINIO_BUCKET=signage-assets
PUBLIC_MEDIA_URL=${APP_URL}/media
JWT_SECRET=${jwt_secret}
NEXT_PUBLIC_API_URL=${APP_URL}/api
NEXT_PUBLIC_WS_URL=${APP_URL}
SERVER_API_URL=http://api:4000/api
CORS_ORIGIN=${APP_URL},http://localhost:8080,http://localhost
ENV
  chmod 600 "${ENV_FILE}"
}

configure_firewall() {
  if ! command -v ufw >/dev/null 2>&1; then
    return
  fi

  if ${SUDO} ufw status | grep -qi active; then
    say "Firewall ativo. Liberando portas publicas do painel..."
    ${SUDO} ufw allow 22/tcp || true
    ${SUDO} ufw allow 8080/tcp || true
    ${SUDO} ufw allow 8443/tcp || true
  fi
}

start_stack() {
  say "Baixando imagens, instalando dependencias dos containers e subindo a aplicacao..."
  cd "${PROJECT_DIR}"
  ${SUDO} docker compose pull --ignore-pull-failures || true
  ${SUDO} docker compose up -d --build

  say "Aguardando Nginx responder..."
  for _ in $(seq 1 60); do
    if curl -fsS "http://localhost:8080" >/dev/null 2>&1; then
      say "Aplicacao online."
      return
    fi
    sleep 2
  done

  say "A aplicacao subiu, mas o Nginx ainda nao respondeu. Veja logs com: docker compose logs -f"
}

main() {
  require_sudo
  say "Preparando Corporate Signage para Ubuntu 20.04..."
  install_docker
  ensure_swap
  write_env
  configure_firewall
  start_stack

  cat <<EOF

Pronto.

Painel: ${APP_URL}
Player TV001: ${APP_URL}/player/TV001

Comandos uteis:
  docker compose ps
  docker compose logs -f
  bash scripts/update.sh

EOF
}

main "$@"
