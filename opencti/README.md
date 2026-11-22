# OpenCTI companion stack (Aegis)

Self-hosted OpenCTI Community Edition used by the Aegis **Global Threat Intel** page.

## Requirements

- Docker Desktop with **≥8 GB RAM** allocated (Elasticsearch alone uses ~2G here)
- On WSL2 / Linux: `sudo sysctl -w vm.max_map_count=1048575`

## Start

From the repo root:

```bash
docker compose -f docker-compose.opencti.yml --env-file opencti/.env up -d
```

- OpenCTI UI: http://localhost:8080
- Default login (from `opencti/.env`):
  - Email: `admin@opencti.local`
  - Password: `OpenCti@Admin12345`
  - Admin API token: value of `OPENCTI_ADMIN_TOKEN`

Wait until `aegis-opencti` is healthy (`docker compose -f docker-compose.opencti.yml ps`).

## Live stream (real-time feed)

1. Sign in to OpenCTI.
2. Go to **Data → Data sharing → Live streams**.
3. Create a stream (e.g. name `aegis-live`) with filters covering Indicators, Malware, Intrusion-Sets, and Reports when available.
4. Copy the stream UUID into the Aegis root `.env` as `OPENCTI_STREAM_ID`.
5. Restart Aegis backend so it picks up the env:
   ```bash
   docker compose restart backend
   ```

If `OPENCTI_STREAM_ID` is empty, Aegis falls back to the raw `/stream` endpoint (no UI filters).

## Wire into Aegis

Root `.env` should include:

```env
OPENCTI_URL=http://host.docker.internal:8080
OPENCTI_TOKEN=204483d4-a2c9-4e70-8d79-048328f0078b
OPENCTI_STREAM_ID=
OPENCTI_UI_URL=http://localhost:8080
```

Then open Aegis → **Threat Intel** (`/app/threat-intel`).

## Stop

```bash
docker compose -f docker-compose.opencti.yml --env-file opencti/.env down
```

Data volumes persist (`opencti_es`, `opencti_s3`, …). Add `-v` to wipe.
