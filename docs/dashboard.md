# Deploy del Dashboard

## Stack

El dashboard es HTML estático puro — no tiene build step. Los archivos en `dashboard/` se suben tal cual al hosting.

```
dashboard/
├── index.html      # UI del dashboard
├── config.js       # URL de la API y token de autenticación
└── .htaccess       # Redirect HTTPS
```

## Hosting

| Campo    | Valor                          |
|----------|-------------------------------|
| Host FTP | `162.0.235.179`               |
| Usuario  | `vallhzty`                    |
| Destino  | `switcher.incaslop.online/`   |
| Puerto   | `21`                          |

La contraseña FTP está en `credenciales.txt` (no commitear).

## Subir manualmente con FileZilla (o similar)

1. Conectar al host `162.0.235.179` puerto `21` con usuario y contraseña
2. Navegar al directorio `switcher.incaslop.online/`
3. Subir los tres archivos de `dashboard/`: `index.html`, `config.js`, `.htaccess`

## Subir desde línea de comandos (Windows, Git Bash)

PuTTY incluye `pscp` que soporta FTP no está disponible directamente, pero se puede usar `curl` con FTP:

```bash
curl -T dashboard/index.html ftp://162.0.235.179/switcher.incaslop.online/ \
  --user "vallhzty:PASSWORD" --ftp-create-dirs

curl -T dashboard/config.js ftp://162.0.235.179/switcher.incaslop.online/ \
  --user "vallhzty:PASSWORD"

curl -T dashboard/.htaccess ftp://162.0.235.179/switcher.incaslop.online/ \
  --user "vallhzty:PASSWORD"
```

## Configuración de la API (`config.js`)

Antes de subir, verificar que `config.js` apunta al servidor correcto:

```js
window.SWITCHER_API = 'https://api-switcher.incaslop.online'
window.SWITCHER_TOKEN = 'TOKEN_AQUI'
```

El token debe coincidir con `API_TOKEN` en el `.env` del switcher en el servidor.

## Notas

- No hay build — lo que está en `dashboard/` es lo que se despliega.
- El workflow de GitHub Actions en `.github/workflows/deploy.yml` es para el proyecto principal React/Vite (`src/`), **no** para el dashboard.
- El `.htaccess` fuerza HTTPS redirect — no borrarlo al subir.
