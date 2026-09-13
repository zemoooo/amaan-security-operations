# AMAN Security Operations

AMAN is a multi-tenant CCTV/security operations platform with an Edge AI Monitoring Agent, attendance management, Supabase storage/database and WhatsApp alerts through Evolution API.

## Production architecture

```text
Cameras / NVR / DVR
        |
        v
AMAN Edge Agent (inside customer LAN)
        |
        | periodic frames + AI analysis
        v
AMAN Cloud on Render
   |             |
   v             v
Supabase      Evolution API
                 |
                 v
              WhatsApp
```

The Edge Agent behaves like a continuous virtual CCTV operator: it samples enabled camera streams, analyzes each frame with the configured vision model, filters normal events, and submits only meaningful events. The cloud stores the event and sends WhatsApp only when severity/confidence thresholds are met and cooldown permits it.

## Repositories
- AMAN application: this repository
- Evolution API deployment: `evolution/` (can be copied to the separate `amaan-evolution-api` GitHub repository)

## Render
Build: `npm install && npm run build`
Start: `npm start`
Health: `/api/health`

Set secrets in Render, never in GitHub:
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CREDENTIAL_ENCRYPTION_KEY`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_WEBHOOK_SECRET`, `APP_URL`.

## Supabase
Run `supabase-schema.sql` once. It creates tenants, cameras, employees, attendance, security events, incidents, recorder devices and Edge Agent tables plus the `security-evidence` storage bucket.

## Edge Agent
See `agent/README.md`. The agent requires access to RTSP/NVR/DVR and an AI API key. It never exposes the camera network to Render. It connects outbound to AMAN Cloud.

## WhatsApp
Evolution API v2.3.7 is pinned for reproducible testing. The current Evolution API documentation uses `POST /message/sendText/{instance}` with `number`, `options` and `textMessage`. AMAN uses that format.

## Important security notes
- Keep GitHub repository private.
- Never commit `.env`, API keys, NVR passwords or service-role keys.
- Use strong random secrets.
- Do not expose PostgreSQL/Redis publicly.
- Review AI alerts before taking consequential action; AI is an assistive monitoring system, not proof of intent or identity.
