#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_DIR}"

if [[ "${EUID}" -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

echo "Atualizando codigo..."
if git rev-parse --is-inside-work-tree >/dev/null 2>&1 && git remote | grep -q .; then
  git pull --ff-only
else
  echo "Sem remote Git configurado. Pulando git pull."
fi

echo "Baixando imagens e reconstruindo containers..."
${SUDO} docker compose pull --ignore-pull-failures || true
${SUDO} docker compose up -d --build

echo "Aguardando aplicacao..."
for _ in $(seq 1 60); do
  if curl -fsS http://localhost:8080 >/dev/null 2>&1; then
    echo "Atualizacao concluida: http://localhost:8080"
    exit 0
  fi
  sleep 2
done

echo "Containers iniciados, mas o Nginx nao respondeu ainda."
echo "Veja os logs com: docker compose logs -f"
exit 1
