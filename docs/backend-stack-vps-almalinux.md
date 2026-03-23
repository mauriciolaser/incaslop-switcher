# Backend (MVP) Summary y Deploy en VPS AlmaLinux

Fecha: 2026-03-23

Este documento resume el stack backend actual (modo `ONLINE`) y cómo montarlo en un VPS AlmaLinux para correr la lógica de la pelea y persistir en base de datos en versión MVP.

## 1) Qué backend tenemos hoy

Ubicación del backend: `server/`

Stack:

- Runtime: Node.js (ESM: `"type": "module"`).
- Framework HTTP: Express (`express`).
- Sesión “ligera” por cookie: `cookie-parser` + cookie HTTP-only con una `userKey` aleatoria.
- Persistencia: MySQL/MariaDB vía `mysql2/promise`, con fallback a archivos JSON para dev (`FileStore`).

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

- Nombre de cookie: `SESSION_COOKIE_NAME` (default: `peru_polymarket_online`).
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

## 2) Persistencia (MySQL/MariaDB)

Selector de store: `server/src/store/index.js`

- Si existen `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: usa MySQL (`MySQLStore`).
- Si no hay DB y `ALLOW_FILE_FALLBACK=true`: usa archivos JSON (`FileStore`).

### 2.1 Tablas (se crean automáticamente)

`server/src/store/mysqlStore.js` crea estas tablas al iniciar:

- `online_state`
  - guarda el snapshot completo del estado de la arena como JSON (fila fija `id = 1`).
- `online_events`
  - eventos append-only (para “events?since=”).
- `online_users`
  - saldo de monedas por `user_key`.
- `online_bets`
  - apuesta por `user_key` y `round_number` (con `UNIQUE (user_key, round_number)`).

No hay migraciones externas: el `init()` del store crea tablas si no existen.

### 2.2 Fallback a archivos (solo dev)

`server/src/store/fileStore.js` usa:

- `server/data/arena-state.json`
- `server/data/arena-users.json`
- `server/data/arena-bets.json`
- `server/data/arena-events.json`

Para un VPS, lo recomendado es DB real; el fallback queda como modo de desarrollo.

## 3) Variables de entorno (MVP)

Ejemplo: `server/.env.example`

- `PORT=3001`
- `SESSION_COOKIE_NAME=peru_polymarket_online`
- `ALLOW_FILE_FALLBACK=true|false`
- `DB_HOST=...`
- `DB_PORT=3306`
- `DB_NAME=...`
- `DB_USER=...`
- `DB_PASSWORD=...`

Recomendación producción:

- `ALLOW_FILE_FALLBACK=false` (para no “degradar” silenciosamente a archivos si la DB está mal configurada).

## 4) Deploy en VPS AlmaLinux (Nginx + systemd + MariaDB)

Asumimos AlmaLinux 9, un dominio apuntando al VPS, y que queremos:

- Nginx sirviendo el frontend (`dist/`) como SPA.
- Nginx proxy a backend en `127.0.0.1:3001` para `/api/online/*`.
- 1 instancia del backend (MVP).

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

3. Instala MariaDB (compatible con el cliente MySQL del backend):

```bash
sudo dnf -y install mariadb-server
sudo systemctl enable --now mariadb
sudo mysql_secure_installation
```

### 4.2 Base de datos y usuario

Entra a MariaDB:

```bash
sudo mariadb
```

Crea DB y usuario (ajusta nombres/clave):

```sql
CREATE DATABASE peru_polymarket CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ppm'@'localhost' IDENTIFIED BY 'una_clave_larga';
GRANT ALL PRIVILEGES ON peru_polymarket.* TO 'ppm'@'localhost';
FLUSH PRIVILEGES;
```

### 4.3 Instalar Node.js y dependencias

Necesitamos Node para correr el servidor. Usa una versión LTS (20 o 22).

Luego (una vez que Node y npm estén disponibles):

```bash
sudo mkdir -p /opt/peru-polymarket
sudo chown -R $USER:$USER /opt/peru-polymarket
cd /opt/peru-polymarket

git clone <tu-repo> .

npm ci
npm --prefix server ci

npm run build
```

Resultado:

- frontend compilado en `dist/`
- backend listo en `server/`

### 4.4 Configurar `.env` del backend

Crea `server/.env` (no lo comitees):

```bash
cat > /opt/peru-polymarket/server/.env <<'EOF'
PORT=3001
SESSION_COOKIE_NAME=peru_polymarket_online
ALLOW_FILE_FALLBACK=false

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=peru_polymarket
DB_USER=ppm
DB_PASSWORD=una_clave_larga
EOF
```

### 4.5 systemd unit para el backend

Crea un usuario de sistema para correr Node:

```bash
sudo useradd --system --create-home --shell /sbin/nologin peru-polymarket
sudo chown -R peru-polymarket:peru-polymarket /opt/peru-polymarket
```

Crea el servicio `/etc/systemd/system/peru-polymarket-online.service`:

```ini
[Unit]
Description=Peru Polymarket Online Arena (Node/Express)
After=network.target mariadb.service

[Service]
Type=simple
User=peru-polymarket
WorkingDirectory=/opt/peru-polymarket/server
EnvironmentFile=/opt/peru-polymarket/server/.env
ExecStart=/usr/bin/node /opt/peru-polymarket/server/src/app.js
Restart=always
RestartSec=2

# Logs a journald
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Activa y levanta:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now peru-polymarket-online.service
sudo journalctl -u peru-polymarket-online.service -f
```

Healthcheck local:

```bash
curl -s http://127.0.0.1:3001/health
```

### 4.6 Nginx: SPA + reverse proxy del API

Config recomendado (ejemplo `/etc/nginx/conf.d/peru-polymarket.conf`):

```nginx
server {
  listen 80;
  server_name tu-dominio.com;

  root /opt/peru-polymarket/dist;
  index index.html;

  # API -> Node
  location /api/online/ {
    proxy_pass http://127.0.0.1:3001/api/online/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location = /health {
    proxy_pass http://127.0.0.1:3001/health;
  }

  # SPA fallback
  location / {
    try_files $uri $uri/ /index.html;
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

Una vez que tengas TLS (por ejemplo con certbot), el frontend y el backend quedan bajo HTTPS.

Nota: actualmente la cookie del backend se crea con `secure: false` en `server/src/app.js`. En HTTPS funciona, pero no fuerza seguridad; para producción conviene cambiar a `secure: true` y configurar `trust proxy` si Nginx está delante.

## 5) MVP: límites y checklist

Límites actuales del diseño (aceptables para MVP):

- 1 proceso Node = 1 arena global. No está diseñado para múltiples instancias concurrentes sin coordinación.
- Polling HTTP (no WebSockets).
- Identidad por cookie sin auth real.

Checklist mínimo producción:

- DB configurada y `ALLOW_FILE_FALLBACK=false`.
- Nginx proxy para `/api/online/*`.
- systemd con restart automático.
- Backups de MariaDB.
- TLS habilitado.

