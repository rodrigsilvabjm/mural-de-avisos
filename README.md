# Mural de Avisos

Plataforma SaaS para TV corporativa, mural de avisos e digital signage. A arquitetura foi preparada como monorepo com:

- `apps/api`: backend Node.js com NestJS, REST, WebSocket, PostgreSQL, Redis e MinIO.
- `apps/web`: painel administrativo e player web com Next.js, React e Tailwind CSS.
- `docker-compose.yml`: Postgres, Redis, MinIO, API, Web e Nginx.

## Recursos incluidos

- Conteudos: imagens, videos, PDFs, documentos, dashboards, paginas web, YouTube, RSS e QR Codes.
- Mural de avisos com editor visual estilo Word/PowerPoint.
- Templates com elementos arrastaveis, redimensionaveis e controle de camada.
- Player web por URL unica para TVs, navegadores, Fire TV, Android TV, mini PCs e Smart TVs.
- Registro e aprovacao de TVs.
- Monitoramento online/offline por WebSocket.
- Playlists, agendamentos e botao de alerta de emergencia.
- Base multiempresa, permissoes e auditoria.

## Desenvolvimento local

```bash
npm install
npm run dev
```

Servicos isolados:

```bash
npm run dev -w apps/api
npm run dev -w apps/web
```

## Docker

```bash
cp .env.example .env
docker compose up --build
```

URLs padrao:

- Painel via Next: http://localhost:3000
- Painel via Nginx: http://localhost:8080
- API: http://localhost:4000/api
- Player exemplo: http://localhost:3000/player/TV001
- Player compativel LG/webOS: http://localhost:3000/player-lite/TV001
- MinIO Console: http://localhost:9001

## Deploy automatico em Ubuntu 20.04

Na VM limpa, depois de criar/subir este repositorio no GitHub:

```bash
sudo apt-get update && sudo apt-get install -y git curl
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git signage
cd signage
bash scripts/install-ubuntu-20.04.sh http://IP_DA_VM:8080
```

O instalador baixa e instala Docker, Docker Compose, Git, OpenSSL e dependencias
basicas do sistema. As dependencias pesadas da aplicacao, como LibreOffice,
Poppler e fontes para converter PPTX/PPTM/PDF/DOCX, ficam dentro dos containers
e sao baixadas automaticamente durante o build.

Para atualizar a VM depois de publicar novas alteracoes:

```bash
cd signage
bash scripts/update.sh
```

Mais detalhes em `DEPLOY_UBUNTU_20_04.md`.

## TVs LG webOS e navegadores antigos

Algumas TVs LG webOS usam navegador Chromium antigo. Se o player normal abrir
apenas o fundo, use o modo compativel:

```text
http://IP_DA_VM:8080/player-lite/TV001
```

O sistema tambem tenta detectar LG/webOS automaticamente em `/player/TV001`.

## Proximos passos recomendados

1. Conectar autenticao JWT e RBAC persistente.
2. Trocar repositorios em memoria por Prisma/TypeORM com PostgreSQL.
3. Adicionar processamento de arquivos DOCX/PPTX/XLSX/PDF para preview.
4. Publicar storage S3/MinIO com URLs assinadas.
5. Criar pipeline de CI/CD e SSL com Let's Encrypt no Nginx.
