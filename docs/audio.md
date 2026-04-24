# Audio

El switcher gestiona audio en loop continuo sobre el stream. Los archivos MP3 se almacenan en `switcher/audio/` y se organizan en playlists guardadas en `switcher/audio-playlist/`.

## Modos de reproducción

El `AudioLoopManager` opera en uno de cuatro estados:

| Estado | Descripción |
|---|---|
| `catalog` | Reproduce todos los tracks no archivados en orden aleatorio, en loop infinito |
| `playlist` | Reproduce una playlist específica; al terminar vuelve a `catalog` si `repeat` es `false` |
| `muted` | El stream sigue activo pero sin audio |
| `stopped` | Sin reproducción ni silencio activo |

El estado predeterminado al iniciar el servidor es `catalog` si hay tracks disponibles.

## Tracks

Un track es un archivo `.mp3` en `switcher/audio/`. Los tracks se cargan vía la API o manualmente copiando archivos al directorio.

### Archivar / desarchivar

Un track archivado no aparece en el catálogo ni en playlists nuevas. Se puede archivar/desarchivar sin eliminar el archivo.

```http
POST /audio/tracks/:name/archive
POST /audio/tracks/:name/unarchive
Authorization: Bearer <token>
```

## Audio playlists

Una audio-playlist es un JSON en `switcher/audio-playlist/<nombre>.json`.

### Estructura del JSON

```json
{
  "name": "tarde-relajada",
  "repeat": false,
  "tracks": ["cancion1.mp3", "cancion2.mp3"]
}
```

- `name`: identificador, solo letras, números, `-` y `_`, máximo 64 caracteres.
- `repeat`: si es `true`, la playlist se repite en loop; si es `false`, al terminar vuelve al catálogo.
- `tracks`: lista de nombres de archivo (solo el nombre, no la ruta completa). Deben existir en `switcher/audio/`.

### CRUD de playlists

```http
GET    /audio/playlists              # listar todas
GET    /audio/playlists/:name        # obtener una
POST   /audio/playlists/:name        # crear o reemplazar
DELETE /audio/playlists/:name        # eliminar
```

Body para crear/reemplazar:

```json
{
  "repeat": false,
  "tracks": ["track1.mp3", "track2.mp3"]
}
```

### Reproducir una playlist

```http
POST /audio/playlists/:name/play
Authorization: Bearer <token>
```

Detiene lo que suena y comienza la playlist desde el primer track.

## Subir archivos MP3

```http
POST /audio/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Campo: `file` (`.mp3`, máximo 10 MB). El archivo se guarda en `switcher/audio/`.

## Controles de audio

```http
POST /audio/mute     # silencia sin detener el proceso
POST /audio/stop     # detiene reproducción
POST /audio/catalog  # vuelve al catálogo general
Authorization: Bearer <token>
```

## Now Playing

`stream-manager.js` escucha cambios en el track activo y lo inyecta como overlay "Now Playing" en el stream. El texto aparece en la parte inferior de la pantalla mientras dura el track.

## Estado en /status

El endpoint `GET /status` incluye el estado de audio:

```json
{
  "audio": {
    "mode": "playlist",
    "currentTrack": "cancion1.mp3",
    "playlistName": "tarde-relajada"
  }
}
```
