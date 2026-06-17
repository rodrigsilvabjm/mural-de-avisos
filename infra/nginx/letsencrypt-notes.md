# SSL com Let's Encrypt

Em Ubuntu Server, publique o DNS para o servidor e instale Certbot:

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tv.empresa.com
```

Depois ajuste `server_name` em `infra/nginx/default.conf` para o dominio real.
