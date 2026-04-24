# Controles del Switcher

El dashboard expone dos modos principales: **LIVE** y **PLAYLIST**. Ambos conviven y se pueden alternar desde la barra de navegación superior.

## Barra de estado superior

Una línea fija en la parte superior muestra:

- **Status**: indicador rojo/verde según si el stream está activo.
- **Now playing (video)**: URL o nombre de la fuente de video actual.
- **Now playing (audio)**: nombre del track de audio en reproducción.
- **Uptime**: tiempo transcurrido desde que arrancó el stream.

## Modo LIVE

Controla el stream en tiempo real.

### Cambiar URL

Ingresa una URL en el campo correspondiente y confirma. El switcher hace un `POST /switch` al backend y cambia la fuente sin reiniciar el proceso.

> El campo de texto no se sobreescribe con la URL activa. Lo que se tipea permanece hasta que el usuario lo borra.

### DEFAULT_URL

La URL por defecto (la que se carga al iniciar el servidor o al finalizar una playlist sin `repeat`) es configurable desde el dashboard mediante `POST /settings/default-url`. No es necesario editar el `.env` para cambiarla; el valor persiste en `switcher/data/settings.json`.

### Overlay de mensajes

Panel dedicado con opciones de texto y estilos:

| Estilo | Descripción |
|---|---|
| `neon-burst` | Texto neón parpadeante |
| `acid-fire` | Texto con degradado de fuego |
| `pixel-rave` | Texto pixelado animado |
| `cosmic-pop` | Texto con efecto espacial |
| `warning-siren` | Texto de alerta rojo intermitente |

```http
POST /overlay/message
POST /overlay/clear
Authorization: Bearer <token>
```

### Sticker imagen/GIF

Lanza una imagen o GIF sobre el stream en posición aleatoria. Ver [docs/images.md](./images.md) para el flujo completo.

## Modo PLAYLIST (video)

Permite crear y ejecutar video-playlists. Ver [docs/video-playlist.md](./video-playlist.md) para el formato de los JSON.

### Crear una playlist

En el panel de creación se agregan items con:

- **URL**: fuente de video.
- **Duración**: en minutos y segundos (el dashboard convierte a segundos antes de enviar).

Al guardar se hace `POST /video/playlists/:name` con el JSON resultante.

### Reproducir una playlist

Seleccionar una playlist de la lista y presionar **Play**. El backend ejecuta los items en orden, cambiando la URL al siguiente item cuando se cumple la duración.

```http
POST /video/playlists/:name/play
Authorization: Bearer <token>
```

### Controles de playlist

- **Play**: inicia o reanuda la playlist activa.
- **Pause**: pausa el timer del item actual (el video sigue, el contador se detiene).
- **Stop**: detiene la playlist y vuelve al `DEFAULT_URL`.

Estos controles tienen prioridad sobre el modo LIVE mientras una playlist está activa.

### Repeat

Si el switch **Repetir** está activo, la playlist vuelve al primer item al terminar. Si no, al finalizar el último item el switcher vuelve a `DEFAULT_URL`.

### Importar playlist

Se puede subir un JSON con el formato de video-playlist directamente desde el dashboard. El archivo se valida y se envía a `POST /video/playlists/:name`.

## Programación de playlists (Schedules)

Tanto video-playlists como audio-playlists se pueden programar para ejecutarse en una fecha/hora específica.

```http
POST   /schedules          # crear schedule
GET    /schedules          # listar schedules
PATCH  /schedules/:id      # actualizar
DELETE /schedules/:id      # eliminar
PATCH  /schedules/:id/enabled  # activar/desactivar
```

- Zona horaria: `America/Lima` (GMT-5).
- Un schedule se ejecuta una sola vez y se deshabilita automáticamente tras correr.
- El servidor verifica schedules pendientes cada 5 segundos.

Propiedades de un schedule:

```json
{
  "id": "abc123",
  "channel": "video",
  "playlistName": "programa-tarde",
  "startsAt": "2026-04-25T20:00:00",
  "enabled": true
}
```

`channel` puede ser `"video"` o `"audio"`.
