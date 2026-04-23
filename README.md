# IncaSlop Switcher
Switcher de streaming para controlar una transmision web hacia Kick y operarlo desde un dashboard estatico.
## Componentes
- switcher/: backend Node/Express + control de Chromium/Xvfb/FFmpeg y playlist de audio.
- dashboard/: frontend estatico (index.html, config.js, .htaccess) para operar el switcher.
- .github/workflows/deploy.yml: pipeline de deploy (dashboard y backend switcher).
- scripts/deploy-switcher-backend.ps1: helper local para deploy manual de backend + dashboard.
- docs/: documentacion operativa.
## Variables de entorno del switcher
Referencia: switcher/.env.example.
Variables principales:
- PORT
- KICK_RTMP_URL
- KICK_STREAM_KEY
- ALLOWED_ORIGIN
- API_TOKEN
- CHROMIUM_EXECUTABLE_PATH
- DISPLAY_NUM
- STREAM_WIDTH
- STREAM_HEIGHT
- STREAM_FPS
- VIDEO_BITRATE
- MAXRATE
- BUFSIZE
- GOP
- PRESET
- AUDIO_BITRATE
- DEFAULT_URL
## Deploy
- Dashboard: subida por FTP de dashboard/index.html, dashboard/config.js, dashboard/.htaccess.
- Switcher backend: empaquetado y despliegue al VPS, seguido de pm2 restart.
## Documentacion
- [docs/dashboard.md](docs/dashboard.md)
- [docs/switcher.md](docs/switcher.md)
- [docs/messages.md](docs/messages.md)