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
2. El backend debe estar corriendo con `/auth/login` habilitado (usuario `inca` / `slop`).
3. No borrar `.htaccess` si tu hosting depende del redirect HTTPS.

## Verificacion post deploy

1. Abrir URL publica del dashboard.
2. Confirmar que aparece modal de login antes de mostrar el panel.
3. Confirmar que `GET /status` responde.

## Fallback manual

Si no hay Actions, subir por FTP con `curl`:

```bash
curl -T dashboard/index.html "ftp://$FTP_HOST/$FTP_DESTINATION" --user "$FTP_USERNAME:$FTP_PASSWORD" --ftp-create-dirs
curl -T dashboard/config.js "ftp://$FTP_HOST/$FTP_DESTINATION" --user "$FTP_USERNAME:$FTP_PASSWORD"
curl -T dashboard/.htaccess "ftp://$FTP_HOST/$FTP_DESTINATION" --user "$FTP_USERNAME:$FTP_PASSWORD"
```

En fallback local con `.env`, tambien se soporta el set:

- `API_FTP_HOST`
- `API_FTP_USER`
- `API_FTP_PASS`
- `API_FTP_DESTINATION`

Para `api-switcher`, usar `API_FTP_DESTINATION=api-switcher.incaslop.online/`.
