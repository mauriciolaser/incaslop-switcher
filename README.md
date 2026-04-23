# IncaSlop Switcher

Switcher de streaming para controlar una transmision web hacia Kick y operarlo desde un dashboard estatico.

## Estructura

- `switcher/`: backend Node/Express, Chromium/Xvfb/FFmpeg, audio playlist.
- `dashboard/`: frontend estatico de control (`index.html`, `config.js`, `.htaccess`).
- `.github/workflows/deploy.yml`: workflow `Deploy Switcher` para despliegue en GitHub Actions.
- `scripts/deploy-switcher-backend.ps1`: fallback local para deploy manual desde Windows.
- `docs/`: runbooks y referencia operativa.

## Deploy

La guia completa esta en:

- [docs/deploy.md](docs/deploy.md)

Resumen rapido:

1. Confirmar que los GitHub Secrets esten cargados.
2. Ejecutar workflow `Deploy Switcher` por `workflow_dispatch`.
3. Elegir si desplegar `dashboard`, `switcher` o ambos.
4. Verificar salida en logs y estado final en servidor.

## Variables de entorno del backend

Referencia: `switcher/.env.example`.

Variables usadas por runtime:

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

## Documentacion relacionada

- [docs/deploy.md](docs/deploy.md)
- [docs/dashboard.md](docs/dashboard.md)
- [docs/switcher.md](docs/switcher.md)
- [docs/messages.md](docs/messages.md)
