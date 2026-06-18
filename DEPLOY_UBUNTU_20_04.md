# Deploy em Ubuntu 20.04

Este projeto foi preparado para subir em uma VM Ubuntu 20.04 usando Docker Compose.
O script instala Docker, Docker Compose, Git, OpenSSL, dependencias basicas do sistema,
cria `.env`, baixa as imagens e constroi os containers da aplicacao.

As dependencias de conversao de arquivos ficam dentro do container da API:
LibreOffice, Poppler e fontes. Isso permite processar PDF, PPTX/PPTM, DOCX e outros
formatos sem instalar essas ferramentas direto no host.

## Primeiro deploy

Na VM, rode:

```bash
sudo apt-get update && sudo apt-get install -y git curl
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git signage
cd signage
bash scripts/install-ubuntu-20.04.sh http://IP_DA_VM:8080
```

Se estiver usando dominio:

```bash
bash scripts/install-ubuntu-20.04.sh http://painel.seudominio.com:8080
```

## URLs

- Painel: `http://IP_DA_VM:8080`
- Player: `http://IP_DA_VM:8080/player/TV001`
- Player compativel LG/webOS: `http://IP_DA_VM:8080/player-lite/TV001`
- API: `http://IP_DA_VM:8080/api`

Se uma TV LG continuar exibindo uma versao antiga apos atualizar, use uma URL
com parametro de versao para furar o cache do navegador:

```text
http://IP_DA_VM:8080/player-lite/TV001?v=2
```

## Atualizar depois

```bash
cd signage
bash scripts/update.sh
```

## Portas

Publicas:

- `8080`: painel/player/API via Nginx
- `8443`: reservado para HTTPS no Nginx

Protegidas no proprio servidor:

- `5432`: PostgreSQL
- `6379`: Redis
- `9000` e `9001`: MinIO
- `3000`: Next.js
- `4000`: API

## Subir para o GitHub

Depois de criar um repositorio vazio no GitHub, rode no seu computador:

```bash
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

## Comandos uteis na VM

```bash
docker compose ps
docker compose logs -f
docker compose logs -f api
docker compose logs -f web
docker compose restart
```

## Observacoes para arquivos grandes

Conversao de PPT/PPTX/PPTM pode consumir bastante memoria. O instalador cria swap
automaticamente quando a VM tem pouca RAM, para reduzir travamentos durante uploads
e conversoes.
