# Plan Playlist

# Plan: Playlist de URLs — IncaSlop Switcher

## Context

El usuario necesita poder programar una secuencia de URLs con duración fija. El switcher avanza automáticamente al siguiente item al expirar el timer. Al terminar la lista vuelve a `DEFAULT_URL`. La funcionalidad se controla desde el dashboard.

---

## Archivos a modificar

| Archivo | Acción |
|---------|--------|
| `switcher/playlist-manager.js` | Crear (nuevo) |
| `switcher/server.js` | Agregar endpoints + instanciar PlaylistManager |
| `dashboard/index.html` | Nueva card de playlist + JS |

`switcher/stream-manager.js` — sin cambios, se reutiliza `switchUrl(url)` y `getStatus()` tal como están.

---

## 1. `switcher/playlist-manager.js` (nuevo)

Clase `PlaylistManager` con estado interno:

```js
{ items: [{id, url, duracionSegundos}], currentIndex, state, _timer, _tickStart }
```

**Estados:** `'idle'` | `'running'` | `'paused'`

**Constructor:**
```js
constructor({ defaultUrl, onSwitch })
// onSwitch: async (url) => void  — callback que llama manager.switchUrl
```

**Métodos públicos:**
- `addItem(url, duracionSegundos)` → retorna item con id (`crypto.randomUUID()`)
- `removeItem(id)` — si es el item activo, cancela timer y avanza al siguiente
- `clearItems()` — llama `stop()` interno si está running, luego vacía array
- `start()` — desde índice 0 si idle, reanuda con `_remainingMs` si paused
- `pause()` — guarda `_remainingMs = duracion - (now - _tickStart)`, cancela timer
- `stop()` — cancela timer, llama `onSwitch(defaultUrl)`, resetea a idle
- `getState()` → `{ playlistState, currentIndex, remainingMs, items: [..., active: bool] }`

**`_advance(index)` (privado):**
```
si index >= items.length o items vacío:
  onSwitch(defaultUrl), state='idle', currentIndex=null → return
item = items[index]
currentIndex = index, _tickStart = Date.now()
onSwitch(item.url)   ← async, no await (no bloquea timer)
_timer = setTimeout(() => _advance(index + 1), item.duracionSegundos * 1000)
```

---

## 2. `switcher/server.js`

**Importar e instanciar** después de `manager`:
```js
import { PlaylistManager } from './playlist-manager.js'

const playlist = new PlaylistManager({
  defaultUrl: process.env.DEFAULT_URL || 'about:blank',
  onSwitch: async (url) => {
    try {
      if (manager.getStatus().status === 'streaming') await manager.switchUrl(url)
    } catch (e) { console.error('[playlist] switch error:', e.message) }
  },
})
```

**Ampliar `GET /status`** (línea 55):
```js
res.json({ ...manager.getStatus(), ...playlist.getState() })
```

**Nuevos endpoints** (todos con `requireAuth` excepto GET):
```
POST   /playlist/items        body: {url, duracionSegundos}  → addItem
DELETE /playlist/items/:id    → removeItem(id)
DELETE /playlist/items        → clearItems()
POST   /playlist/start        → playlist.start()
POST   /playlist/pause        → playlist.pause()
POST   /playlist/stop         → playlist.stop()
```
Validar `url` con `validateUrl()` (ya existe). Validar `duracionSegundos >= 5`.

**En `shutdown()`** (línea 93), antes de `manager.stop()`:
```js
playlist.stop()
```

---

## 3. `dashboard/index.html`

**CSS — agregar en `<style>`:**
```css
input[type="number"] { /* mismo estilo que input[type="text"] */ }
.pl-item { display:flex; gap:8px; padding:6px 10px; border-radius:6px;
           margin-bottom:4px; background:#0f1117; font-size:0.8rem; }
.pl-item.active { background:#1e3a5f; border:1px solid #3b82f6; }
.pl-item .pl-url { flex:1; overflow:hidden; text-overflow:ellipsis;
                   white-space:nowrap; color:#94a3b8; }
.pl-item.active .pl-url { color:#60a5fa; }
.pl-item .pl-dur { color:#475569; font-size:0.75rem; flex-shrink:0; }
.pl-item .pl-del { background:none; border:none; color:#ef4444;
                   cursor:pointer; padding:2px 6px; flex-shrink:0; }
```

**HTML — nueva card** (insertar entre "Cambiar URL" y "Controles"):
```html
<div class="card">
  <h2>Playlist</h2>
  <div class="input-row" style="gap:8px; margin-bottom:12px;">
    <input type="text"   id="pl-url"      placeholder="https://..." />
    <input type="number" id="pl-duracion" placeholder="seg" min="5" style="width:80px;flex:none;" />
    <button class="btn-primary" onclick="plAdd()">+ Agregar</button>
  </div>
  <div id="pl-list"></div>
  <div id="pl-status" style="font-size:0.8rem;color:#94a3b8;margin:8px 0;"></div>
  <div class="controls-row">
    <button class="btn-success" onclick="plStart()">▶ Iniciar</button>
    <button class="btn-primary"  onclick="plPause()">⏸ Pausar</button>
    <button class="btn-danger"   onclick="plStop()">■ Detener</button>
    <button style="background:#374151;color:#e2e8f0;padding:8px 16px;border-radius:6px;border:none;font-size:0.875rem;font-weight:600;cursor:pointer;" onclick="plClear()">✕ Limpiar</button>
  </div>
</div>
```

**JS — agregar en `<script>`:**

Variables de estado local:
```js
let _plItems = [], _plState = 'idle', _plCurrentIndex = null,
    _plRemainingMs = null, _plCountdown = null
```

`updatePlaylistUI(data)` — llamar al final de `updateUI(data)`:
```js
function updatePlaylistUI(data) {
  if (!data.items) return
  _plItems = data.items; _plState = data.playlistState
  _plCurrentIndex = data.currentIndex; _plRemainingMs = data.remainingMs
  renderPlList(); renderPlStatus()
}
```

`renderPlList()` — genera `.pl-item` por cada item, con clase `active` si `item.active`.

`renderPlStatus()` — muestra countdown local con `setInterval` de 500ms entre polls para suavizar la UI. Reinicia en cada poll.

Funciones de acción: `plAdd`, `plRemove(id)`, `plClear`, `plStart`, `plPause`, `plStop` — cada una llama `apiFetch` al endpoint correspondiente y luego `pollStatus()`.

**Modificar `updateUI(data)`** — agregar al final:
```js
updatePlaylistUI(data)
```

---

## Validaciones importantes

- `duracionSegundos >= 5` en servidor (page.goto tiene timeout 30s, valores muy bajos colapsan Puppeteer)
- `removeItem` del item activo → cancelar timer y llamar `_advance(currentIndex)` (el splice ya movió el siguiente item a esa posición)
- `clearItems` mientras running → llamar `stop()` antes de vaciar
- `onSwitch` errors capturados con try/catch para no romper la cadena del scheduler

---

## Orden de deploy

1. Subir `playlist-manager.js` al VPS (base64)
2. Subir `server.js` al VPS (base64)
3. `pm2 restart all`
4. Subir `dashboard/index.html` al FTP
