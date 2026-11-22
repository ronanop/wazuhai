# Deploy Aegis on Coolify (Ubuntu)

This repo is set up so the **same containers** you run locally (Aegis + OpenCTI companion) run on Coolify via [`docker-compose.coolify.yml`](docker-compose.coolify.yml).

| Local | Coolify |
| --- | --- |
| `docker-compose.yml` (Vite + tsx, bind mounts) | `docker-compose.coolify.yml` (nginx + Node prod build) |
| `docker-compose.opencti.yml` (optional) | OpenCTI services **in the same** Coolify compose |
| `OPENCTI_URL=http://host.docker.internal:8080` | `OPENCTI_URL=http://opencti:8080` (Compose DNS) |
| Host ports `5173` / `4000` / `8080` | Coolify proxy domains (no public DB ports) |

## 1) Install Coolify on the Ubuntu server

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

Open the dashboard (port `8000` or your Coolify domain). Connect the server and enable the proxy.

### Host prerequisites (OpenCTI / Elasticsearch)

```bash
sudo sysctl -w vm.max_map_count=1048575
echo 'vm.max_map_count=1048575' | sudo tee /etc/sysctl.d/99-aegis-opencti.conf
```

Allocate **≥8 GB RAM** to the host (Elasticsearch uses ~2G; OpenCTI + workers need more).

Firewall: allow `22`, `80`, `443` (and `8000` until Coolify has a domain). Do **not** expose Postgres `5432`.

## 2) Create the Coolify application

1. **+ New** → Private GitHub repo `ronanop/wazuhai` (or your fork).
2. Build Pack / strategy: **Docker Compose**.
3. **Docker Compose Location:** `/docker-compose.coolify.yml`
4. Base Directory: `/` (repo root).

## 3) Environment variables

Copy [`.env.coolify.example`](.env.coolify.example) into **Environment Variables → Developer view**.

Replace every `change_me` and generate fresh UUIDs for:

- `OPENCTI_ADMIN_TOKEN` (also set `OPENCTI_TOKEN` to the same value)
- `OPENCTI_HEALTHCHECK_ACCESS_KEY`
- all `CONNECTOR_*_ID` values

Set a strong `POSTGRES_PASSWORD` and `JWT_SECRET`.

Leave `CORS_ORIGIN`, `OPENCTI_UI_URL`, and `OPENCTI_EXTERNAL_URL` empty unless you override domains; Coolify fills `SERVICE_URL_FRONTEND_80` and `SERVICE_URL_OPENCTI_8080`.

## 4) Domains

After the first parse/save, configure domains (include the **internal** container port):

| Service | Example | Internal port |
| --- | --- | --- |
| `frontend` | `https://aegis.example.com:80` | `80` (nginx) |
| `opencti` | `https://opencti.example.com:8080` | `8080` |

Visitors still use normal HTTPS; the `:port` tells Coolify which container port to route to.

Point DNS A/AAAA records at the server. Coolify issues certificates via the proxy.

## 5) Deploy

Click **Deploy**. First boot can take several minutes (image pulls + Elasticsearch + OpenCTI health).

Verify:

- `https://aegis.example.com/api/health` → `{"status":"ok",...}`
- Login: `admin@aegis.local` / `Admin@12345` (seeded on start)
- `https://opencti.example.com` → OpenCTI UI
- Aegis → **Threat Intel** → connected after connectors sync

## 6) Live stream (same as local)

1. OpenCTI → **Data → Data sharing → Live streams**
2. Create a stream; paste UUID into Coolify env `OPENCTI_STREAM_ID`
3. Redeploy / restart the stack

## Containers included

**Aegis:** `postgres`, `backend`, `frontend`  
**OpenCTI:** `redis`, `elasticsearch`, `minio`, `rabbitmq`, `opencti`, `worker`, `connector-export-file-stix`, `connector-export-file-csv`, `connector-import-file-stix`, `connector-opencti`, `connector-mitre`

## Local development (unchanged)

```bash
docker compose up --build
# optional CTI:
docker compose -f docker-compose.opencti.yml --env-file opencti/.env up -d
```

Local still uses the `development` Dockerfile targets with bind mounts and Vite on `:5173`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Cookies / login fail on HTTPS | Ensure `COOKIE_SECURE=true` and `CORS_ORIGIN` matches the Aegis domain (no trailing slash) |
| Threat Intel offline | Check `OPENCTI_URL=http://opencti:8080`, token matches `OPENCTI_ADMIN_TOKEN`, OpenCTI healthy |
| Elasticsearch won’t start | Set `vm.max_map_count=1048575`; raise host RAM / lower `ELASTIC_MEMORY_SIZE` |
| SSE / live feed stalls | Frontend nginx already disables buffering for `/api/`; confirm proxy domain points at `frontend:80` |
