# Deploy del Switcher (Backend)

Fuente de verdad: [docs/deploy.md](./deploy.md).

## Objetivo

Desplegar backend `switcher/` al VPS y reiniciar proceso PM2.

## Metodo recomendado

Usar GitHub Actions workflow `Deploy Switcher` con:

- `deploy_dashboard=false` (opcional)
- `deploy_switcher=true`

## Secrets requeridos

### Conexion VPS

- `SWITCHER_HOST`
- `SWITCHER_PORT`
- `SWITCHER_USER`
- `SWITCHER_PASSWORD`
- `SWITCHER_REMOTE_BASE_DIR`
- `SWITCHER_REMOTE_SERVICE_DIR`

### Runtime (.env)

- `PORT`
- `KICK_RTMP_URL`
- `KICK_STREAM_KEY`
- `ALLOWED_ORIGIN`
- `API_TOKEN`
- `CHROMIUM_EXECUTABLE_PATH`
- `DISPLAY_NUM`
- `STREAM_WIDTH`
- `STREAM_HEIGHT`
- `STREAM_FPS`
- `VIDEO_BITRATE`
- `MAXRATE`
- `BUFSIZE`
- `GOP`
- `PRESET`
- `AUDIO_BITRATE`
- `DEFAULT_URL`

## Que despliega el workflow

El job `switcher` empaqueta y sube:

- `switcher/server.js`
- `switcher/stream-manager.js`
- `switcher/playlist-manager.js`
- `switcher/audio-loop-manager.js`
- `switcher/package.json`
- `switcher/ecosystem.config.cjs`
- `switcher/.env.example`
- `switcher/audio/`
- `switcher/.env` generado desde secrets

## Secuencia remota

1. Sube tarball a `/tmp` del VPS.
2. Extrae en `SWITCHER_REMOTE_BASE_DIR`.
3. Reinicia con `pm2 restart all` o inicia con `pm2 start <ecosystem>`.
4. Ejecuta `pm2 list`.

## Validacion post deploy

En VPS:

```bash
pm2 list
pm2 logs --lines 100
```

En API local del VPS:

```bash
curl -s http://127.0.0.1:3000/status
```

Si `PORT` no es `3000`, usar el puerto configurado en secret.

## Fallback local (Windows)

```powershell
npm run deploy:switcher
```

Opciones utiles:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-switcher-backend.ps1 -SkipDashboard
powershell -ExecutionPolicy Bypass -File scripts/deploy-switcher-backend.ps1 -ServerHost 159.198.65.35 -Port 22 -User mauri
```
