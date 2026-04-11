# Backend — Stack, Deploy y Operación en VPS AlmaLinux

Fecha última actualización: 2026-04-11

---

## 1. Stack actual

- **Runtime:** Node.js v20.20.0 (ESM: `"type": "module"`)
- **Framework HTTP:** Express + `cors` + `cookie-parser`
- **Persistencia en producción:** SQLite (`ONLINE_STORE=sqlite`), archivo en `backend/data/arena-temp.sqlite`
- **Candidatos:** archivo local `backend/src/data/candidates.json` (fallback a `CANDIDATE_API_BASE_URL`)
- **Entrada:** `backend/src/app.js` — levanta Express, crea store, crea `OnlineArenaService`, expone endpoints
- **Proceso manager:** `systemd --user` (servicio de usuario `mauri`, no servicio global)

### Archivos clave del backend (en este repo, bajo `server/`)

| Archivo | Rol |
|---|---|
| `src/app.js` | Entry point: Express, rutas, arranque |
| `src/gameService.js` | `OnlineArenaService` — lógica de arena, fases, timers |
| `src/battleEngine.js` | Motor de pelea, cálculos, constantes de duración |
| `src/candidateCatalog.js` | Carga candidatos desde JSON o API |
| `src/gameData.js` | Lee `src/data/ataques.json` y `src/data/personajes.json` |
| `src/config.js` | Variables de entorno con defaults |
| `src/store/index.js` | Selector de store según `ONLINE_STORE` |
| `src/store/sqliteStore.js` | Store SQLite (producción) |
| `src/store/memoryStore.js` | Store en memoria (dev/test) |
| `src/store/fileStore.js` | Store en archivos JSON (dev/manual) |

---

## 2. Rutas reales en el VPS

| Qué | Dónde |
|---|---|
| Backend desplegado | `/home/mauri/incaslop-mechas/backend/` |
| Variables de entorno | `/home/mauri/incaslop-mechas/backend/.env` |
| Base de datos SQLite | `/home/mauri/incaslop-mechas/backend/data/arena-temp.sqlite` |
| Unit file systemd | `/home/mauri/.config/systemd/user/incaslop-mechas-backend.service` |
| Puerto interno Node | `127.0.0.1:3003` |

---

## 3. Unit file systemd (real en producción)

Ubicación: `/home/mauri/.config/systemd/user/incaslop-mechas-backend.service`

```ini
[Unit]
Description=IncaSlop Mechas backend
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/mauri/incaslop-mechas/backend
EnvironmentFile=/home/mauri/incaslop-mechas/backend/.env
ExecStart=/usr/bin/node /home/mauri/incaslop-mechas/backend/src/app.js
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

Es un **servicio de usuario** (`systemctl --user`), no un servicio global de systemd.

---

## 4. Variables de entorno (`.env` real en producción)

```env
PORT=3003
NODE_ENV=production
TRUST_PROXY=true
COOKIE_SECURE=true
CORS_ALLOWED_ORIGINS=https://mechas.incaslop.online
ONLINE_STORE=sqlite
```

> No tocar `.env` remoto salvo que el cambio lo requiera explícitamente.
> `RESET_SQLITE_ON_BOOT` no está seteado (default `true` en config.js) — si se quiere preservar el estado entre reinicios, agregar `RESET_SQLITE_ON_BOOT=false`.

---

## 5. Endpoints API

El frontend consume estos endpoints via polling HTTP con `credentials: 'include'`:

| Método | Ruta | Función |
|---|---|---|
| `POST` | `/api/online/session` | Crea/asegura usuario en el store |
| `DELETE` | `/api/online/session` | Elimina sesión del usuario |
| `GET` | `/api/online/state` | Snapshot de la arena + vista del usuario |
| `GET` | `/api/online/events?since=<id>` | Eventos incrementales para polling |
| `POST` | `/api/online/bet` | Registra/reemplaza apuesta `{ side, amount }` |
| `GET` | `/health` | Healthcheck |

Nginx reescribe `/server/*` → `/api/online/*` antes de proxear a Node.

---

## 6. Operación del servicio

```bash
# Estado
systemctl --user status incaslop-mechas-backend.service --no-pager --lines=8

# Reiniciar
systemctl --user restart incaslop-mechas-backend.service

# Logs
journalctl --user -u incaslop-mechas-backend.service -n 50 --no-pager

# Healthcheck local
curl -fsS http://127.0.0.1:3003/health
```

Todos los comandos se ejecutan como usuario `mauri` (sin sudo).

---

## 7. Deploy backend (flujo validado)

La clave SSH está en `ssh.txt` en la raíz del repo. El deploy no requiere build — Node ejecuta el código fuente directamente.

### Paso 1 — Empaquetar

```bash
tar --exclude='node_modules' --exclude='dist' -czf backend_deploy.tar.gz -C server .
```

### Paso 2 — Subir

```bash
scp -i ssh.txt -o StrictHostKeyChecking=accept-new backend_deploy.tar.gz mauri@172.234.228.138:/home/mauri/backend_deploy.tar.gz
```

### Paso 3 — Desplegar en el VPS (preserva `.env`)

```bash
ssh -i ssh.txt -o StrictHostKeyChecking=accept-new mauri@172.234.228.138 "set -e
  cd /home/mauri/incaslop-mechas
  if [ -f backend/.env ]; then cp backend/.env /home/mauri/backend.env.backup; fi
  rm -rf backend
  mkdir -p backend
  tar -xzf /home/mauri/backend_deploy.tar.gz -C backend
  if [ -f /home/mauri/backend.env.backup ]; then cp /home/mauri/backend.env.backup backend/.env; fi
  cd backend
  npm install
  systemctl --user restart incaslop-mechas-backend.service"
```

Si hay un proceso huérfano en el puerto 3003 (puede pasar si el servicio crasheó sin limpiar), matarlo antes de reiniciar:

```bash
ssh -i ssh.txt -o StrictHostKeyChecking=accept-new mauri@172.234.228.138 "fuser -k 3003/tcp 2>/dev/null || true; systemctl --user restart incaslop-mechas-backend.service"
```

### Paso 4 — Verificar

```bash
ssh -i ssh.txt -o StrictHostKeyChecking=accept-new mauri@172.234.228.138 \
  "systemctl --user status incaslop-mechas-backend.service --no-pager --lines=6; curl -fsS http://127.0.0.1:3003/health"
```

Qué confirmar:
- `Active: active (running)` con `since` reciente
- `health` responde `{"ok":true,"status":"up"}`

### Limpieza local

```bash
rm backend_deploy.tar.gz
```

---

## 8. Nginx (reverse proxy)

- **Dominio público:** `https://api-mechas.incaslop.online`
- **Config:** `/etc/nginx/conf.d/api-mechas.conf`
- Reescribe `/server/*` → `/api/online/*` antes de proxear a `127.0.0.1:3003`
- TLS gestionado por Certbot (`/usr/local/bin/certbot`)

Verificaciones:

```bash
curl -fsS http://127.0.0.1:3003/health          # directo a Node
curl -I https://api-mechas.incaslop.online/server/health  # via Nginx + TLS
```

---

## 9. Notas operativas

- `npm install` se ejecuta en el VPS en cada deploy — no subir `node_modules`.
- El backend no tiene paso de build; `node src/app.js` directo.
- El avance de fases usa `setTimeout` interno. Si el proceso se reinicia, `catchUp()` avanza estados atrasados leyendo `nextActionAt` del estado persistido en SQLite.
- `RESET_SQLITE_ON_BOOT` por defecto es `true` — los datos de jugadores y apuestas se pierden al reiniciar. Setear a `false` en `.env` para preservar estado entre reinicios.
- El servicio corre como usuario `mauri` — usar siempre `systemctl --user`, nunca `sudo systemctl`.
