# Sistema de imagenes y GIFs

## Objetivo

El dashboard permite lanzar una imagen o GIF como sticker sobre el navegador que se esta capturando para el stream. El sticker aparece en una posicion aleatoria, permanece visible por un tiempo limitado y luego se oculta automaticamente.

## Carga desde dashboard

En `dashboard/index.html`, la tarjeta **Sticker imagen/GIF** acepta una URL publica con una de estas extensiones:

- `.gif`
- `.png`
- `.jpg`
- `.jpeg`
- `.webp`

Antes de enviarla al backend, el dashboard sanitiza la URL con `sanitizeStickerUrl(rawUrl)`:

1. Construye un objeto `URL`.
2. Verifica que el `pathname` termine en una extension permitida.
3. Elimina metadata de URL con `parsed.search = ''` y `parsed.hash = ''`.
4. Envia la URL limpia a `POST /overlay/sticker`.

Ejemplo:

```text
https://i.ytimg.com/vi/aDhHSpsopNo/hq720.jpg?sqp=-
```

se convierte en:

```text
https://i.ytimg.com/vi/aDhHSpsopNo/hq720.jpg
```

## API backend

Endpoint:

```http
POST /overlay/sticker
Authorization: Bearer <token>
Content-Type: application/json
```

Request recomendado:

```json
{
  "stickerUrl": "https://i.ytimg.com/vi/aDhHSpsopNo/hq720.jpg?sqp=-"
}
```

Por compatibilidad, el backend tambien acepta `imageUrl` o `gifUrl`.

Respuesta exitosa:

```json
{
  "ok": true,
  "sticker": {
    "stickerUrl": "https://i.ytimg.com/vi/aDhHSpsopNo/hq720.jpg",
    "type": "image",
    "extension": "jpg"
  }
}
```

Validaciones en `switcher/server.js`:

- La URL debe ser string no vacio.
- Longitud maxima: 2048 caracteres.
- Solo protocolos `http` y `https`.
- Solo extensiones `.gif`, `.png`, `.jpg`, `.jpeg` o `.webp`.
- El backend vuelve a cortar `query` y `hash`, aunque el dashboard ya lo haya hecho.
- Si el stream no esta activo, responde `409`.

## Render en el stream

`switcher/stream-manager.js` usa `showSticker({ stickerUrl, type })` para guardar el sticker activo y sincronizarlo dentro de Chromium con `#syncStickerToPage()`.

El render:

- Inserta un contenedor fijo con `page.evaluate(...)`.
- Usa un `<img>` con `src` apuntando a la URL sanitizada.
- Elige una posicion aleatoria con `#pickStickerPosition()`.
- Aplica `max-width: min(400px, 38vw)` y `height: auto`.
- Limita el alto con `max-height: 40vh` para no tapar demasiado la transmision.
- Remueve el `src` cuando el sticker deja de estar visible.

## Duracion

Los GIFs intentan usar su duracion real mediante `ffprobe`. Si no se puede medir, usan el fallback de 8 segundos.

Las imagenes estaticas usan 8 segundos por defecto.

En todos los casos, la duracion final se limita entre 1.2 segundos y 45 segundos.

## Flujo completo

1. El usuario pega una URL en el dashboard.
2. El dashboard valida extension y corta metadata de URL.
3. El dashboard llama `POST /overlay/sticker` con `stickerUrl`.
4. El backend valida de nuevo, sanitiza de nuevo y clasifica el archivo como `gif` o `image`.
5. `StreamManager` calcula la duracion, elige posicion aleatoria e inyecta el `<img>` en Chromium.
6. Al vencer el timer, el sticker se oculta y se limpia el `src`.
