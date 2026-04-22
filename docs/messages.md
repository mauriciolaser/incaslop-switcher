# Overlay de Mensajes (Kick)

## Objetivo

Permitir enviar mensajes desde `/dashboard` para que aparezcan sobre el navegador que se captura y se transmite al canal de Kick.

## Comportamiento (v1)

- Modo: un solo mensaje activo.
- Formato: texto plano (sin HTML/markdown), con soporte de emojis Unicode.
- Estilos: 5 presets visuales seleccionables desde dashboard/API que impactan el render.
- Posición: centro de pantalla, estilo grande.
- Duración: 8 segundos fijos con auto-hide.
- Si el stream no está activo: la API responde `409` para evitar mensajes fantasma.

## API

Base URL: la misma API del switcher (ej: `https://api-switcher.incaslop.online`).

Autenticación: `Authorization: Bearer <API_TOKEN>` para endpoints `POST`.

### `GET /status` (público)

Ahora incluye:

```json
{
  "overlay": {
    "text": "Mensaje",
    "visible": true,
    "expiresAt": 1760000000000,
    "updatedAt": 1760000000000
  }
}
```

### `POST /overlay/message`

Request:

```json
{
  "text": "Mensaje para mostrar en stream",
  "style": "neon-burst"
}
```

`style` es opcional. Presets permitidos:

- `neon-burst`
- `acid-fire`
- `pixel-rave`
- `cosmic-pop`
- `warning-siren`

Respuesta exitosa:

```json
{
  "ok": true,
  "overlay": {
    "text": "Mensaje para mostrar en stream",
    "visible": true,
    "expiresAt": 1760000000000,
    "updatedAt": 1760000000000,
    "style": "neon-burst"
  }
}
```

Validaciones:

- `400` si `text` no es string.
- `400` si `text` queda vacío tras `trim()`.
- `400` si excede 180 caracteres Unicode (conteo por code points, compatible con emojis).
- `409` si el stream no está en estado `streaming`.

### `POST /overlay/clear`

Oculta inmediatamente el overlay y limpia el estado.

Respuesta:

```json
{
  "ok": true,
  "overlay": {
    "text": "",
    "visible": false,
    "expiresAt": null,
    "updatedAt": 1760000000000,
    "style": "neon-burst"
  }
}
```

## Implementación técnica

### Backend (`switcher/server.js`)

- Mantiene estado en memoria:
  - `text`
  - `visible`
  - `expiresAt`
  - `updatedAt`
  - `style`
- Usa timer en backend para auto-hide a los 8 segundos.
- Expone el estado `overlay` en `/status`.

### Stream renderer (`switcher/stream-manager.js`)

- Nuevos métodos públicos:
  - `showOverlayMessage({ text, expiresAt, style })`
  - `clearOverlayMessage()`
- Renderiza un contenedor fijo con `page.evaluate(...)` en Chromium.
- Aplica 5 presets CSS animados (colores y formas) según `style`.
- Inserta el texto con `textContent` para evitar inyección HTML.
- Reinyecta el overlay tras `switchUrl()` para persistir mensaje vigente entre cambios de página.

### Dashboard (`dashboard/index.html`)

Se agregó tarjeta **Mensajes Overlay** con:

- Input de texto (`maxlength=180`).
- Botón **Mostrar mensaje** (`POST /overlay/message`).
- Botón **Ocultar ahora** (`POST /overlay/clear`).
- Estado visual (activo/inactivo + segundos aproximados restantes).
- Logs en el panel existente para éxito/error.

## Pruebas rápidas (manual)

1. Iniciar stream desde dashboard.
2. Enviar mensaje en tarjeta **Mensajes Overlay**.
3. Verificar aparición del texto en Kick.
4. Verificar ocultado automático a los 8 segundos.
5. Enviar un segundo mensaje antes de que termine el primero:
   reemplazo inmediato esperado.
6. Presionar **Ocultar ahora**:
   debe desaparecer de inmediato.
7. Con stream detenido, intentar enviar mensaje:
   debe devolver `409`.
