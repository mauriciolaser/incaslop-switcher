# Servidor

El backend corre en el VPS como proceso PM2. El código vive en `~/switcher/` y se gestiona con `ecosystem.config.cjs`.

## Conexión SSH

```bash
ssh mauri@159.198.65.35 -p 22
```

## Gestión del proceso

```bash
pm2 list                    # ver estado
pm2 logs --lines 100        # ver logs recientes
pm2 restart all             # reiniciar
pm2 stop all                # detener
pm2 start ~/switcher/ecosystem.config.cjs  # iniciar desde cero
```

## Verificar la API

```bash
curl -s http://127.0.0.1:3000/status
```

Si `PORT` en el `.env` del servidor es diferente a `3000`, ajustar el número de puerto.

## Variables de entorno

El archivo `.env` vive en `~/switcher/.env` y se genera automáticamente en cada deploy desde los GitHub Secrets. Para editar manualmente:

```bash
nano ~/switcher/.env
pm2 restart all
```

Variables principales:

| Variable | Descripción |
|---|---|
| `PORT` | Puerto de la API (default: 3000) |
| `KICK_RTMP_URL` | URL RTMP destino del stream |
| `KICK_STREAM_KEY` | Stream key |
| `ALLOWED_ORIGIN` | Origen CORS permitido |
| `API_TOKEN` | Token Bearer para acceso técnico |
| `CHROMIUM_EXECUTABLE_PATH` | Ruta al ejecutable de Chromium (`/usr/bin/chromium-browser` en AlmaLinux) |
| `DISPLAY_NUM` | Número de display virtual Xvfb |
| `DEFAULT_URL` | URL por defecto al iniciar o al terminar una playlist sin repeat |

## Watchdog y reinicios automáticos

El servidor incluye dos mecanismos automáticos:

- **Watchdog** (cada 60 s): si el stream se cae inesperadamente, lo reinicia con `DEFAULT_URL`.
- **Reinicio periódico** (cada 6 h): reinicia el stream para liberar recursos acumulados.

Ambos se loguean en los logs del servidor.

## Logs

Los logs estructurados están en `~/switcher/logs/`:

- `general.log`: log principal con todos los eventos.
- `run-<id>.log`: log por sesión de streaming.

Acceso vía API:

```http
GET /logs/summary
GET /logs/latest
GET /logs/runs
Authorization: Bearer <token>
```

## Directorios de datos

```
~/switcher/
  audio/              # archivos MP3 subidos
  audio-playlist/     # playlists de audio (*.json)
  video-playlist/     # playlists de video (*.json)
  data/               # estado persistente (settings.json, schedules.json, etc.)
  logs/               # archivos de log
```

## Notificaciones Telegram

El servidor puede enviar alertas a Telegram ante eventos críticos (inicio/fin de stream, errores). Se configura en `switcher/telegram-notifier.js`. Ver el README de Telegram para instrucciones de setup del bot.
