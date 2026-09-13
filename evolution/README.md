# AMAN Evolution API

Evolution API is deployed separately on a VPS. AMAN Cloud on Render connects to it using HTTPS and the Evolution API key. The official Evolution repository publishes the `evoapicloud/evolution-api:v2.3.7` image; its Docker examples use PostgreSQL and persistent instance storage. urlEvolution API GitHubhttps://github.com/evolution-foundation/evolution-api

## 1. VPS requirements

Ubuntu 22.04/24.04, Docker + Docker Compose, a public DNS name and HTTPS. Keep PostgreSQL/Redis private.

## 2. Configure Evolution

```bash
cp .env.example .env
nano .env
```

Set a strong `AUTHENTICATION_API_KEY`, database password and public `SERVER_URL`.

## 3. Start

```bash
docker compose pull
docker compose up -d
docker compose ps
docker logs -f aman_evolution_api
```

## 4. HTTPS

Expose Evolution through Nginx/Caddy/Cloudflare on a public HTTPS hostname, for example:

```text
https://evolution.your-domain.com
```

Do not expose PostgreSQL or Redis to the public internet.

## 5. AMAN Render variables

```text
EVOLUTION_API_URL=https://evolution.your-domain.com
EVOLUTION_API_KEY=<same value as AUTHENTICATION_API_KEY>
EVOLUTION_DEFAULT_INSTANCE=aman_default
EVOLUTION_WEBHOOK_SECRET=<long random secret>
```

Never commit `.env` or API keys.
