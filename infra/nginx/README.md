# Nginx edge config (domestic deployment)

TLS terminates at nginx (or at the ingress-nginx controller in Kubernetes).
The config in `conf.d/ai-video.conf` is a **template**: domain names, certificate
paths and upstreams come from environment variables so the same file works for
staging and production.

## Placeholders

| Variable | Example |
| --- | --- |
| `APP_DOMAIN` | `app.example.com` |
| `API_DOMAIN` | `api.example.com` |
| `TLS_CERTIFICATE` | `/etc/nginx/certs/fullchain.pem` |
| `TLS_CERTIFICATE_KEY` | `/etc/nginx/certs/privkey.pem` |
| `WEB_UPSTREAM` | `web:3000` |
| `API_UPSTREAM` | `api:4000` |

## Run with the official image (envsubst baked in)

```bash
docker run -d --name edge \
  -p 80:80 -p 443:443 \
  -e APP_DOMAIN=app.example.com \
  -e API_DOMAIN=api.example.com \
  -e TLS_CERTIFICATE=/etc/nginx/certs/fullchain.pem \
  -e TLS_CERTIFICATE_KEY=/etc/nginx/certs/privkey.pem \
  -e WEB_UPSTREAM=web:3000 \
  -e API_UPSTREAM=api:4000 \
  -v "$PWD/infra/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" \
  -v "$PWD/infra/nginx/conf.d:/etc/nginx/templates:ro" \
  -v "$PWD/certs:/etc/nginx/certs:ro" \
  -v certbot_www:/var/www/certbot \
  nginx:1.27-alpine
```

The official image renders `/etc/nginx/templates/*.conf` to
`/etc/nginx/conf.d/*.conf` on startup.

For a VM install, render manually and reload:

```bash
export APP_DOMAIN=app.example.com API_DOMAIN=api.example.com \
       TLS_CERTIFICATE=/etc/letsencrypt/live/app.example.com/fullchain.pem \
       TLS_CERTIFICATE_KEY=/etc/letsencrypt/live/app.example.com/privkey.pem \
       WEB_UPSTREAM=127.0.0.1:3000 API_UPSTREAM=127.0.0.1:4000
envsubst '${APP_DOMAIN} ${API_DOMAIN} ${TLS_CERTIFICATE} ${TLS_CERTIFICATE_KEY} ${WEB_UPSTREAM} ${API_UPSTREAM}' \
  < infra/nginx/conf.d/ai-video.conf > /etc/nginx/conf.d/ai-video.conf
nginx -t && systemctl reload nginx
```

## Certificates

- **Aliyun SSL Certificates Service** (recommended for domestic domains): issue
  a free DV certificate for `app.example.com` and `api.example.com`, download the
  nginx bundle, place it under `/etc/nginx/certs`, and let Terraform/console bind
  the CDN certificate separately for `cdn.example.com`.
- **certbot** works for the origin domains as long as port 80 reaches this nginx
  and the domain is ICP-filed. The HTTP server keeps
  `/.well-known/acme-challenge/` open; everything else redirects to HTTPS.

## DNS

| Record | Name | Value |
| --- | --- | --- |
| A | `app.example.com` | edge server / SLB public IP |
| A | `api.example.com` | edge server / SLB public IP |
| CNAME | `cdn.example.com` | Aliyun CDN CNAME (from Terraform output) |

Domestic DNS changes require the domain to be ICP-filed; see
[`../compliance/icp-filing-checklist.md`](../compliance/icp-filing-checklist.md).

## Notes

- `client_max_body_size` is 2 GB to allow source-video uploads; keep it aligned
  with the API's own body limit.
- `/socket.io/` disables buffering and allows long-lived connections for task
  progress.
- Playback traffic **must not** pass through nginx: signed URLs point at
  `cdn.example.com`, which pulls from OSS and saves origin bandwidth.
- `nginx -t` before every reload; the template fails fast if a certificate path
  is wrong.
