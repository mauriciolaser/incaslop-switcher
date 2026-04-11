# Backend (MVP) Summary y Deploy en VPS AlmaLinux

Fecha: 2026-04-11

Este documento resume el stack backend actual (modo `ONLINE`) y cómo montarlo en un VPS AlmaLinux para correr la lógica de la pelea y persistir en base de datos en versión MVP.

## 1) Qué backend tenemos hoy

Ubicación del backend: `server/`

Stack:

- Runtime: Node.js (ESM: `"type": "module"`).
- Framework HTTP: Express (`express`) con `cors` y `cookie-parser`.
- Sesión “ligera” por cookie: cookie HTTP-only con una `userKey` aleatoria.
- Persistencia actual del backend desplegado: SQLite (`ONLINE_STORE=sqlite`).
- Fuente de candidatos en producción: archivo local `server/src/data/candidates.json`, con fallback a `CANDIDATE_API_BASE_URL` si hace falta regenerar catálogo.

Entrada:

- `server/src/app.js`: levanta Express, crea `store`, crea `OnlineArenaService`, expone endpoints.

### 1.1 Flujo del juego (arena online)

El servidor es la fuente de verdad del modo `ONLINE`. Mantiene una “arena global” compartida por todos los usuarios (MVP: una sola arena, una sola instancia de Node).

- Servicio principal: `server/src/gameService.js` (`OnlineArenaService`).
- Motor/reglas y utilidades: `server/src/battleEngine.js`.
- Datos del juego: `server/src/gameData.js` lee JSON del frontend:
  - `src/data/ataques.json`
  - `src/data/personajes.json`

Fases del ciclo:

1. `intro` (presentación).
2. `betting` (apuestas abiertas).
3. `fighting` (turnos automáticos).
4. `result` (liquidación + pausa y pasa a la siguiente ronda).

Timers (definidos en `server/src/battleEngine.js`):

- `INTRO_DURATION_MS = 5000`
- `BETTING_DURATION_MS = 15000`
- `TURN_DELAY_MS = 1800`
- `RESULT_DURATION_MS = 7000`

Nota MVP importante: el avance de fases depende de timers internos del proceso Node (`setTimeout`). Si el proceso se cae y reinicia, el servicio hace `catchUp()` para avanzar estados atrasados según `nextActionAt`, apoyándose en el estado persistido.

### 1.2 Identidad del jugador (sin login)

El backend identifica a cada jugador por una cookie HTTP-only:

- Nombre de cookie: `SESSION_COOKIE_NAME` (default: `mechas_incaslop_online`).
- Valor: `userKey` generado con `crypto.randomBytes(...)`.

Con eso se guarda:

- monedas por usuario
- apuesta por usuario/ronda

### 1.3 API HTTP (consumida por el frontend)

Endpoints (ver `server/src/app.js`):

- `POST /api/online/session`
  - crea/asegura cookie y garantiza que el usuario exista en el store.
- `GET /api/online/state`
  - snapshot del estado público de la arena + vista del usuario (coins/bet).
- `GET /api/online/events?since=<id>`
  - eventos incrementales (para polling).
- `POST /api/online/bet` body `{ side: 'left'|'right', amount: number }`
  - registra o reemplaza la apuesta de la ronda actual (solo en fase `betting`).
- `GET /health`
  - healthcheck simple.

El frontend (ver `src/utils/onlineApi.js`) hace polling por HTTP con `credentials: 'include'` para enviar/recibir la cookie.

## 2) Persistencia actual (SQLite)

Selector de store: `server/src/store/index.js`

- El modo que usa la instalación real es `ONLINE_STORE=sqlite`.
- El archivo SQLite se controla con `SQLITE_FILENAME`.
- Si `RESET_SQLITE_ON_BOOT=true`, el backend recrea la base al arrancar.
- `FileStore` sigue existiendo como opción de desarrollo/manual, pero no es la instalación real del VPS.

### 2.1 Tablas SQLite (se crean automáticamente)

`server/src/store/sqliteStore.js` crea estas tablas al iniciar:

- `arena_state`
  - guarda el snapshot completo del estado de la arena como JSON (fila fija `id = 1`).
- `arena_events`
  - eventos append-only (para “events?since=”).
- `arena_players`
  - jugador, monedas, estado y `guest_number`.
- `arena_bets`
  - apuesta por `user_key` y `round_number` (con `UNIQUE(user_key, round_number)`).

No hay migraciones externas: el `init()` del store crea tablas si no existen.

### 2.2 Opcion de archivos (solo dev)

`server/src/store/fileStore.js` usa:

- `server/data/arena-state.json`
- `server/data/arena-users.json`
- `server/data/arena-bets.json`
- `server/data/arena-events.json`

En el VPS actual no se usa este modo. Queda como opción de desarrollo.

## 3) Variables de entorno (MVP)

Ejemplo: `server/.env.example`

- `PORT`
- `SESSION_COOKIE_NAME`
- `TRUST_PROXY=true|false`
- `COOKIE_SECURE=true|false`
- `CORS_ALLOWED_ORIGINS=https://frontend.example.com`
- `ONLINE_STORE=sqlite|file|memory`
- `SQLITE_FILENAME=/ruta/al.sqlite`
- `RESET_SQLITE_ON_BOOT=true|false`
- `CANDIDATE_API_BASE_URL=...`

Recomendación producción:

- `PORT=3003`
- `NODE_ENV=production`
- `TRUST_PROXY=true`
- `COOKIE_SECURE=true`
- `CORS_ALLOWED_ORIGINS=https://mechas.incaslop.online`
- `ONLINE_STORE=sqlite`
- `RESET_SQLITE_ON_BOOT=false` si se quiere preservar el estado entre reinicios

## 4) Deploy en VPS AlmaLinux (Nginx + systemd + SQLite)

Asumimos AlmaLinux 9, el backend de este repo y la instalación real validada:

- frontend público: `https://mechas.incaslop.online`
- backend público: `https://api-mechas.incaslop.online/server`
- backend interno Node: `http://127.0.0.1:3003`
- 1 instancia del backend (MVP)
- Nginx en el VPS solo como reverse proxy del backend

### 4.1 Paquetes base

1. Actualiza el sistema:

```bash
sudo dnf -y update
```

2. Instala Nginx y herramientas:

```bash
sudo dnf -y install nginx git
sudo systemctl enable --now nginx
```

### 4.2 Instalar Node.js y dependencias

Necesitamos Node para correr el servidor. Usa una versión LTS (20 o 22). En AlmaLinux suele ser más simple usar módulos de DNF.

Ejemplo (Node 20):

```bash
sudo dnf -y module list nodejs
sudo dnf -y module enable nodejs:20
sudo dnf -y install nodejs
node -v
npm -v
```

Luego (una vez que Node y npm estén disponibles):

```bash
sudo mkdir -p /opt/incaslop-mechas
sudo chown -R $USER:$USER /opt/incaslop-mechas
cd /opt/incaslop-mechas

git clone <tu-repo> repo
cd repo
npm --prefix server ci
```

Resultado:

- backend listo en `repo/server/`
- datos del juego disponibles para sincronizar desde `repo/src/data`

Nota: como frontend y backend van en dominios distintos, el frontend debe usar `VITE_ONLINE_API_BASE=https://api-mechas.incaslop.online/server`.

### 4.3 Desplegar backend en `/opt`

La instalación real del VPS no ejecuta el backend desde `/home/mauri/...`, sino desde `/opt/incaslop-mechas/backend`. El flujo seguro es:

```bash
sudo rm -rf /opt/incaslop-mechas/backend
sudo mkdir -p /opt/incaslop-mechas/backend
sudo cp -a /ruta/del/repo/server/. /opt/incaslop-mechas/backend/

sudo rm -rf /opt/incaslop-mechas/src/data
sudo mkdir -p /opt/incaslop-mechas/src
sudo cp -a /ruta/del/repo/src/data /opt/incaslop-mechas/src/

sudo chown -R mauri:mauri /opt/incaslop-mechas
```

### 4.4 Configurar `backend.env`

Crea `/etc/incaslop-mechas/backend.env`:

```bash
sudo mkdir -p /etc/incaslop-mechas
sudo tee /etc/incaslop-mechas/backend.env >/dev/null <<'EOF'
PORT=3003
NODE_ENV=production
SESSION_COOKIE_NAME=mechas_incaslop_online
TRUST_PROXY=true
COOKIE_SECURE=true
CORS_ALLOWED_ORIGINS=https://mechas.incaslop.online
ONLINE_STORE=sqlite
SQLITE_FILENAME=/opt/incaslop-mechas/backend/data/arena-temp.sqlite
RESET_SQLITE_ON_BOOT=false

CANDIDATE_API_BASE_URL=https://api.candidatos.incaslop.online
EOF

sudo chown root:mauri /etc/incaslop-mechas/backend.env
sudo chmod 640 /etc/incaslop-mechas/backend.env
```

### 4.5 systemd unit para el backend

Crea el servicio `/etc/systemd/system/incaslop-mechas-backend.service`:

```ini
[Unit]
Description=IncaSlop Mechas backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=mauri
Group=mauri
WorkingDirectory=/opt/incaslop-mechas/backend
EnvironmentFile=/etc/incaslop-mechas/backend.env
ExecStart=/usr/bin/node /opt/incaslop-mechas/backend/src/app.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Activa y levanta:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now incaslop-mechas-backend.service
sudo journalctl -u incaslop-mechas-backend.service -f
```

Healthcheck local:

```bash
curl -s http://127.0.0.1:3003/health
```

Nota operativa importante:

- No montes la unidad global leyendo `.env` desde `/home/mauri/...`. Con SELinux eso puede fallar con `Failed to load environment files: Permission denied`.

### 4.6 Nginx: reverse proxy del API real

Config base validada (`/etc/nginx/conf.d/api-mechas.conf`):

```nginx
server {
  listen 80;
  listen [::]:80;
  server_name api-mechas.incaslop.online;

  location = /server {
    return 301 /server/;
  }

  location = /server/health {
    proxy_pass http://127.0.0.1:3003/health;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /server/ {
    rewrite ^/server/(.*)$ /api/online/$1 break;
    proxy_pass http://127.0.0.1:3003;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    return 404;
  }
}
```

Reinicia Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 4.7 Firewall y SELinux (común en AlmaLinux)

Firewall (si `firewalld` está activo):

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

Si SELinux bloquea el proxy de Nginx hacia Node, habilita:

```bash
sudo setsebool -P httpd_can_network_connect 1
```

### 4.8 HTTPS (recomendado)

En este servidor, `certbot` está instalado en `/usr/local/bin/certbot`. Para este host, el comando validado fue:

```bash
sudo /usr/local/bin/certbot --nginx --non-interactive --agree-tos \
  --register-unsafely-without-email \
  -d api-mechas.incaslop.online
```

Puntos a verificar tras emitir el certificado:

- que exista el bloque `443` para `api-mechas.incaslop.online`
- que `http://api-mechas.incaslop.online/server/health` redirija a HTTPS
- que `https://api-mechas.incaslop.online/server/health` responda `200`

Problema real encontrado y solucion:

- Sintoma: `http://api-mechas.incaslop.online/server/health` respondia `200`, pero `https://api-mechas.incaslop.online/server/health` devolvia `404 Cannot GET /server/health`.
- Causa: existia bloque Nginx para `80`, pero no uno propio para `443`; el trafico TLS caia en otra vhost y Express recibia `/server/health` sin la reescritura a `/api/online/...`.
- Solucion: emitir el certificado del subdominio con Certbot y dejar desplegada la configuracion TLS del mismo host.

Verificaciones finales recomendadas:

```bash
systemctl status incaslop-mechas-backend.service --no-pager --lines=12
curl -fsS http://127.0.0.1:3003/health
curl -I http://api-mechas.incaslop.online/server/health
curl -I https://api-mechas.incaslop.online/server/health
curl -H 'Origin: https://mechas.incaslop.online' \
  -I https://api-mechas.incaslop.online/server/state
```

## 5) MVP: límites y checklist

Límites actuales del diseño (aceptables para MVP):

- 1 proceso Node = 1 arena global. No está diseñado para múltiples instancias concurrentes sin coordinación.
- Polling HTTP (no WebSockets).
- Identidad por cookie sin auth real.

Checklist mínimo producción:

- `ONLINE_STORE=sqlite` configurado.
- `backend.env` en `/etc/incaslop-mechas/backend.env`.
- código backend desplegado en `/opt/incaslop-mechas/backend`.
- Nginx proxy para `/server/*`.
- systemd con restart automático.
- TLS habilitado.



