# Mechas IncaSlop - Deploy en AlmaLinux VPS

Guia practica para publicar esta aplicacion en un VPS con AlmaLinux usando:
- Frontend React/Vite (archivos estaticos `dist/`)
- Backend Node/Express (`server/`)
- Nginx como reverse proxy
- MariaDB para persistencia
- systemd para mantener el backend levantado

## 1) Requisitos

- VPS con AlmaLinux 9
- Dominio apuntando al servidor (opcional, pero recomendado)
- Usuario con permisos `sudo`
- Puertos 80/443 accesibles

## 2) Instalar paquetes base

```bash
sudo dnf -y update
sudo dnf -y install nginx git mariadb-server
sudo systemctl enable --now nginx
sudo systemctl enable --now mariadb
```

Configura seguridad inicial de MariaDB:

```bash
sudo mysql_secure_installation
```

## 3) Instalar Node.js (LTS)

Ejemplo con Node 20:

```bash
sudo dnf -y module list nodejs
sudo dnf -y module enable nodejs:20
sudo dnf -y install nodejs
node -v
npm -v
```

## 4) Crear base de datos

Entra a MariaDB:

```bash
sudo mariadb
```

Crea DB y usuario (cambia la clave):

```sql
CREATE DATABASE mechas_incaslop CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'mechas_user'@'localhost' IDENTIFIED BY 'CAMBIA_ESTA_CLAVE_LARGA';
GRANT ALL PRIVILEGES ON mechas_incaslop.* TO 'mechas_user'@'localhost';
FLUSH PRIVILEGES;
```

## 5) Clonar y compilar la aplicacion

```bash
sudo mkdir -p /opt/mechas-incaslop
sudo chown -R $USER:$USER /opt/mechas-incaslop
cd /opt/mechas-incaslop

git clone <URL_DE_TU_REPO> .

npm ci
npm --prefix server ci
npm run build
```

## 6) Configurar variables del backend

Crea `server/.env`:

```bash
cat > /opt/mechas-incaslop/server/.env <<'EOF'
PORT=3001
SESSION_COOKIE_NAME=mechas_incaslop_online
ALLOW_FILE_FALLBACK=false

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=mechas_incaslop
DB_USER=mechas_user
DB_PASSWORD=CAMBIA_ESTA_CLAVE_LARGA
EOF
```

Notas:
- Este backend lee variables desde entorno del proceso (systemd `EnvironmentFile`).
- Con `ALLOW_FILE_FALLBACK=false`, si falla DB no cae a JSON local silenciosamente.

## 7) Crear servicio systemd

Crear usuario de sistema:

```bash
sudo useradd --system --create-home --shell /sbin/nologin mechas-incaslop
sudo chown -R mechas-incaslop:mechas-incaslop /opt/mechas-incaslop
```

Crear archivo `/etc/systemd/system/mechas-incaslop-online.service`:

```ini
[Unit]
Description=Mechas IncaSlop Online Server
After=network.target mariadb.service

[Service]
Type=simple
User=mechas-incaslop
WorkingDirectory=/opt/mechas-incaslop/server
EnvironmentFile=/opt/mechas-incaslop/server/.env
ExecStart=/usr/bin/node /opt/mechas-incaslop/server/src/app.js
Restart=always
RestartSec=2
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Activar servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mechas-incaslop-online.service
sudo systemctl status mechas-incaslop-online.service
```

Ver logs:

```bash
sudo journalctl -u mechas-incaslop-online.service -f
```

Healthcheck local:

```bash
curl -s http://127.0.0.1:3001/health
```

## 8) Configurar Nginx

Crear `/etc/nginx/conf.d/mechas-incaslop.conf`:

```nginx
server {
  listen 80;
  server_name TU_DOMINIO_O_IP;

  root /opt/mechas-incaslop/dist;
  index index.html;

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

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

Validar y recargar:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 9) Firewall y SELinux

Si usas `firewalld`:

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

Si SELinux bloquea proxy de Nginx -> Node:

```bash
sudo setsebool -P httpd_can_network_connect 1
```

## 10) HTTPS (recomendado)

Instala TLS con Certbot (Let's Encrypt) para servir frontend y API por HTTPS.

Importante de seguridad:
- En `server/src/app.js` la cookie esta con `secure: false`.
- En produccion HTTPS conviene cambiar a `secure: true` y usar `app.set('trust proxy', 1)` al estar detras de Nginx.

## 11) Despliegue de actualizaciones

Cada vez que subas cambios:

```bash
cd /opt/mechas-incaslop
git pull
npm ci
npm --prefix server ci
npm run build
sudo systemctl restart mechas-incaslop-online.service
sudo systemctl reload nginx
```

## 12) Troubleshooting rapido

- Backend no levanta:
  - `sudo journalctl -u mechas-incaslop-online.service -n 200 --no-pager`
- Error de DB:
  - revisa `DB_*` en `/opt/mechas-incaslop/server/.env`
  - prueba acceso: `mariadb -u mechas_user -p mechas_incaslop`
- Frontend carga pero API falla:
  - revisa bloque `location /api/online/` en Nginx
  - prueba `curl http://127.0.0.1:3001/health`

## 13) Notas de arquitectura actual

- El modo online es una arena global en una sola instancia de Node (MVP).
- No hay login real: se usa cookie HTTP-only para identificar jugador.
- Persistencia recomendada: MariaDB (no fallback a archivos en produccion).
