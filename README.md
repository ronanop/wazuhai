# Aegis — Enterprise Security Platform

Phase 1–8 prototype: SOC UI, grounded AI, SOAR-lite, plus requirement-gap polish (auth lifecycle stubs, roles, settings/email rules, exports, richer drawers), and **OpenCTI Global Threat Intel**.

## Stack

- **Frontend:** React + Vite + Framer Motion
- **Backend:** Node.js + Express + Prisma
- **Database:** PostgreSQL
- **Threat intel:** OpenCTI Community Edition (companion Compose)
- **Runtime:** Docker Compose

## Quick start (Aegis)

```bash
docker compose up --build
```

- App: http://localhost:5173
- API: http://localhost:4000/api/health

### Coolify (Ubuntu production)

Same containers as local (Aegis + OpenCTI) via [`docker-compose.coolify.yml`](docker-compose.coolify.yml). See **[COOLIFY.md](COOLIFY.md)** for install, env vars, and domains.

### Demo users

| Email | Password | Role |
|-------|----------|------|
| `admin@aegis.local` | `Admin@12345` | Administrator |
| `analyst@aegis.local` | `Analyst@12345` | SOC Analyst |

Administrator can open **Users**. SOC Analyst is redirected away from that route.

---

## OpenCTI Global Threat Intel

Aegis embeds a premium **Threat Intel** dashboard (`/app/threat-intel`) that reads OpenCTI over GraphQL and proxies live STIX SSE streams. The OpenCTI stack is **optional** and kept in a separate Compose file so Aegis still boots light.

### 1) Host requirements

- Docker Desktop with **≥8 GB RAM** (Elasticsearch uses ~2G in this companion stack)
- WSL2 / Linux: `sudo sysctl -w vm.max_map_count=1048575`

### 2) Start OpenCTI

```bash
docker compose -f docker-compose.opencti.yml --env-file opencti/.env up -d
```

- UI: http://localhost:8080  
- Login: `admin@opencti.local` / `OpenCti@Admin12345`  
- Admin API token: `OPENCTI_ADMIN_TOKEN` in [`opencti/.env`](opencti/.env) (must match Aegis `OPENCTI_TOKEN`)

Wait until `aegis-opencti` is healthy. MITRE + OpenCTI dataset connectors fill the knowledge graph (first sync can take several minutes).

More detail: [`opencti/README.md`](opencti/README.md).

### 3) Create a live stream (recommended)

1. OpenCTI → **Data → Data sharing → Live streams**
2. Create a stream (e.g. `aegis-live`) covering Indicators / Malware / Intrusion-Sets / Reports
3. Copy the stream UUID into the Aegis root `.env`:

```env
OPENCTI_URL=http://host.docker.internal:8080
OPENCTI_TOKEN=204483d4-a2c9-4e70-8d79-048328f0078b
OPENCTI_STREAM_ID=<your-stream-uuid>
OPENCTI_UI_URL=http://localhost:8080
```

4. Restart Aegis backend:

```bash
docker compose restart backend
```

If `OPENCTI_STREAM_ID` is empty, Aegis falls back to OpenCTI’s raw `/stream` endpoint.

### 4) Open the dashboard

1. Start Aegis (`docker compose up -d` if not already running)
2. Sign in → sidebar **Threat Intel**
3. Confirm hero shows **OpenCTI connected** and KPIs populate after connectors sync
4. Live feed should move to **Live stream** (or **Polling fallback** if SSE is unavailable)

### Verification checklist

- [ ] `GET http://localhost:4000/api/health` → ok  
- [ ] OpenCTI UI login works on `:8080`  
- [ ] Aegis **Threat Intel** hero: connected + version  
- [ ] KPI counts non-zero after MITRE/dataset connectors run  
- [ ] Creating/updating an Indicator in OpenCTI appears in the live feed (or within poll interval)  
- [ ] Indicator row opens a drawer with Table / JSON `DataView`

### Non-goals (this phase)

- Wazuh alert ↔ OpenCTI IOC enrichment  
- Pushing Aegis incidents into OpenCTI  
- Replacing the native OpenCTI UI (deep analysis: use **Open OpenCTI**)
