# Deploy del Dashboard

Fuente de verdad: [docs/deploy.md](./deploy.md).

## Objetivo

Publicar los archivos estaticos de `dashboard/` por FTP.

Archivos desplegados:

- `dashboard/index.html`
- `dashboard/config.js`
- `dashboard/.htaccess`

## Metodo recomendado

Usar GitHub Actions workflow `Deploy Switcher` con:

- `deploy_dashboard=true`
- `deploy_switcher=false` (si no quieres tocar backend)

Secrets requeridos:

- `FTP_HOST`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- `FTP_DESTINATION`

## Verificaciones previas

1. `dashboard/config.js` debe apuntar a la API correcta.
2. `window.SWITCHER_TOKEN` debe coincidir con `API_TOKEN` del backend.
3. No borrar `.htaccess` si tu hosting depende del redirect HTTPS.

## Verificacion post deploy

1. Abrir URL publica del dashboard.
2. Confirmar que las acciones llaman a la API sin `401` ni `CORS`.
3. Confirmar que `GET /status` responde.

## Fallback manual

Si no hay Actions, subir por FTP con `curl`:

```bash
curl -T dashboard/index.html "ftp://$FTP_HOST/$FTP_DESTINATION" --user "$FTP_USERNAME:$FTP_PASSWORD" --ftp-create-dirs
curl -T dashboard/config.js "ftp://$FTP_HOST/$FTP_DESTINATION" --user "$FTP_USERNAME:$FTP_PASSWORD"
curl -T dashboard/.htaccess "ftp://$FTP_HOST/$FTP_DESTINATION" --user "$FTP_USERNAME:$FTP_PASSWORD"
```
