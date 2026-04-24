# Integración Telegram (Switcher)

Este documento describe cómo está implementada la notificación por Telegram en el backend de `switcher`.

## Archivos involucrados

- `switcher/telegram-notifier.js`
- `switcher/server.js`
- `telegram/.env` (no versionado)

## Variables de entorno

Se cargan dos fuentes:

1. `dotenv/config` (entorno general del servicio)
2. `telegram/.env` (cargado explícitamente desde `server.js`)

Variables soportadas:

- `TELEGRAM_API` o `TELEGRAM_BOT_TOKEN`: token del bot (requerido).
- `TELEGRAM_CHAT_ID`: chat destino (opcional).

## Resolución de chat_id

Si `TELEGRAM_CHAT_ID` no existe, el sistema intenta auto-detectarlo con `getUpdates`:

- Busca el último `chat.id` disponible en updates (`message`, `edited_message`, `channel_post`).
- Si no encuentra ninguno, Telegram queda deshabilitado y el servicio sigue funcionando.

## Comportamiento de arranque

La inicialización de Telegram se ejecuta en background (`initTelegramAsync`) después de `app.listen(...)`.

Objetivo:

- evitar bloquear el arranque de la API por latencia/red de Telegram.

Además, llamadas a Telegram usan timeout (`AbortSignal.timeout`, 5s) para evitar cuelgues.

## Eventos que disparan alertas

Desde `server.js` se envían alertas para eventos operativos:

- inicio de stream
- stop de stream
- reinicio automático iniciado/exitoso/fallido
- activación de watchdog por caída
- fallos de inicio

También hay suscripción a logs críticos (`logger.onLog`) para:

- `ffmpeg.close`
- `chromium.close`
- `stream.start.fail`
- `stream.restart.fail`
- `stream.auto-start.fail`

## Formato de mensaje

Todos los mensajes se envían prefijados con:

- `[incaslop-switcher] ...`

## Fallos y degradación segura

Si Telegram falla (token inválido, red, timeout, chat_id no resuelto):

- no se cae la API
- se registra warning en logs (`telegram.init.*`, `telegram.send.fail`)
- el resto del servicio continúa normal

## Validación rápida

1. Escribe al bot por Telegram (para que exista update y pueda detectar chat_id si no está fijo).
2. Reinicia el proceso.
3. Verifica en logs:
   - `telegram.init.ok` y `chatId=...`
4. Ejecuta acciones de stream (`/stream/start`, reinicio watchdog, etc.) y valida mensajes recibidos.
