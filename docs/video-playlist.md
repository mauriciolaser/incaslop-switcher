# Video Playlists

Una video-playlist es una secuencia de URLs de video con duraciones definidas. El switcher las reproduce en orden, cambiando la fuente al siguiente item cuando se cumple el tiempo asignado.

## Almacenamiento

Los archivos JSON se guardan en `switcher/video-playlist/<nombre>.json` en el servidor. El nombre del archivo es el identificador de la playlist.

## Formato del JSON

```json
{
  "name": "programa-tarde",
  "repeat": false,
  "items": [
    { "url": "https://stream.ejemplo.com/fuente1", "duration": 3600 },
    { "url": "https://stream.ejemplo.com/fuente2", "duration": 1800 },
    { "url": "rtmp://live.ejemplo.com/canal", "duration": 600 }
  ]
}
```

### Campos

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `name` | string | sí | Identificador. Solo letras, números, `-` y `_`, máximo 64 caracteres. Debe coincidir con el nombre del archivo. |
| `repeat` | boolean | sí | Si es `true`, vuelve al primer item al terminar. Si es `false`, al finalizar vuelve al `DEFAULT_URL`. |
| `items` | array | sí | Lista de items en orden de reproducción. Mínimo 1 item. |

### Campos de cada item

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `url` | string | sí | URL de la fuente de video (HTTP, HTTPS o RTMP). |
| `duration` | number | sí | Duración en segundos. Debe ser un número entero positivo. |

## Nombre de la playlist

El nombre sigue el patrón `^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$`:

- Empieza con letra o número.
- Puede contener letras, números, guion (`-`) y guion bajo (`_`).
- Longitud máxima: 64 caracteres.

Ejemplos válidos: `programa-tarde`, `loop_cortos`, `stream01`

Ejemplos inválidos: `-inicio`, `nombre con espacios`, `a`.

## Cómo generar el JSON

### Desde el dashboard

1. Ir al modo **PLAYLIST** en el dashboard.
2. Agregar items con URL y duración (en minutos y segundos; el dashboard convierte a segundos).
3. Asignar un nombre y guardar. Se hace `POST /video/playlists/:name` automáticamente.

### A mano

Crear el archivo JSON con el formato indicado y subirlo al servidor en `switcher/video-playlist/`. También se puede importar desde el dashboard usando la opción de carga de JSON.

### Ejemplo mínimo

```json
{
  "name": "test",
  "repeat": false,
  "items": [
    { "url": "https://www.youtube.com/watch?v=ejemplo", "duration": 300 }
  ]
}
```

## API de playlists

```http
GET    /video/playlists              # listar todas
GET    /video/playlists/:name        # obtener una
POST   /video/playlists/:name        # crear o reemplazar
DELETE /video/playlists/:name        # eliminar
POST   /video/playlists/:name/play   # iniciar reproducción
```

Body para crear/reemplazar (sin el campo `name`, se toma del parámetro de ruta):

```json
{
  "repeat": false,
  "items": [
    { "url": "https://stream.ejemplo.com/fuente1", "duration": 3600 }
  ]
}
```

## Comportamiento de reproducción

- Al ejecutar `play`, el `PlaylistManager` comienza desde el primer item.
- Cada item dura exactamente `duration` segundos según el timer interno.
- Al terminar un item se llama el callback `onSwitch`, que hace `POST /switch` con la siguiente URL.
- Si la playlist termina sin `repeat`, el switcher vuelve al `DEFAULT_URL`.
- Si el stream se detiene mientras una playlist está activa, al reiniciar retoma desde `DEFAULT_URL` (no reanuda la playlist).

## Estado en /status

```json
{
  "playlist": {
    "state": "running",
    "activePlaylistName": "programa-tarde",
    "currentIndex": 1,
    "currentUrl": "https://stream.ejemplo.com/fuente2"
  }
}
```

Estados posibles: `idle`, `running`, `paused`.
