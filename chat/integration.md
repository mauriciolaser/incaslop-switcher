# Cómo montar incaslop-chat en un servicio

## URL de producción

```
wss://chat.incaslop.online/ws
```

El servicio también expone un endpoint HTTP de diagnóstico:

```
https://chat.incaslop.online/health
```

---

## Requisitos para conectarse

Para que el servidor acepte la conexión WebSocket, el origen del cliente (`Origin` header) debe estar incluido en `CHAT_ALLOWED_ORIGINS`. Actualmente están permitidos:

```
https://chat.incaslop.online
https://congreso.incaslop.online
```

Si tu servicio corre en un origen diferente, agrega el dominio a la variable de entorno `CHAT_ALLOWED_ORIGINS` en el `.env` del VPS y reinicia el servicio.

---

## Protocolo WebSocket

### Conectarse

```js
const ws = new WebSocket("wss://chat.incaslop.online/ws");
```

La conexión no requiere autenticación. Al conectarse, el servidor asigna automáticamente un `playerId` de la forma `guest1`, `guest2`, etc.

---

### Mensajes del servidor → cliente

Todos los mensajes son JSON. Tienen el campo `type` y `payload`.

#### `welcome` — enviado al conectarse

```json
{
  "type": "welcome",
  "payload": {
    "playerId": "guest42",
    "connectedAt": 1775948000000
  }
}
```

Llega siempre como primer mensaje. `playerId` identifica al cliente durante la sesión.

---

#### `chat_history` — historial reciente

```json
{
  "type": "chat_history",
  "payload": {
    "messages": [
      { "playerId": "guest1", "text": "hola", "sentAt": 1775947000000 },
      { "playerId": "guest2", "text": "mundo", "sentAt": 1775947001000 }
    ]
  }
}
```

Llega justo después del `welcome` si hay mensajes en memoria (hasta 80). Si no hay historial, no se envía.

---

#### `chat_message` — mensaje nuevo en tiempo real

```json
{
  "type": "chat_message",
  "payload": {
    "playerId": "guest5",
    "text": "hola a todos",
    "sentAt": 1775948100000
  }
}
```

Se emite a todos los clientes conectados cuando alguien envía un mensaje válido.

---

#### `error` — rechazo de mensaje del cliente

```json
{
  "type": "error",
  "payload": {
    "code": "CHAT_MESSAGE_TOO_LONG",
    "message": "Chat message must be at most 280 characters."
  }
}
```

Solo se envía al cliente que originó el error. Códigos posibles:

| Código | Causa |
|---|---|
| `INVALID_CLIENT_MESSAGE` | JSON inválido o `type` incorrecto |
| `CHAT_MESSAGE_REJECTED` | Texto vacío o solo espacios |
| `CHAT_MESSAGE_TOO_LONG` | Supera 280 caracteres |
| `CHAT_RATE_LIMITED` | Más de 6 mensajes en 10 segundos |

---

### Mensajes del cliente → servidor

Solo existe un tipo de mensaje que el cliente puede enviar:

#### `chat_message` — enviar un mensaje

```json
{
  "type": "chat_message",
  "payload": {
    "text": "hola a todos"
  }
}
```

---

## Endpoint HTTP

### `GET /health`

Retorna el estado del servidor. Útil para monitoreo.

```
GET https://chat.incaslop.online/health
```

Respuesta:

```json
{
  "status": "ok",
  "timestamp": 1775948029182,
  "storedMessages": 12
}
```

---

## Ejemplo de integración en JavaScript

```js
const ws = new WebSocket("wss://chat.incaslop.online/ws");

ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "welcome") {
    console.log("Conectado como", msg.payload.playerId);
  }

  if (msg.type === "chat_history") {
    for (const m of msg.payload.messages) {
      renderMessage(m.playerId, m.text, m.sentAt);
    }
  }

  if (msg.type === "chat_message") {
    renderMessage(msg.payload.playerId, msg.payload.text, msg.payload.sentAt);
  }

  if (msg.type === "error") {
    console.warn("Error del chat:", msg.payload.code, msg.payload.message);
  }
});

function sendMessage(text) {
  ws.send(JSON.stringify({ type: "chat_message", payload: { text } }));
}
```

---

## Agregar un nuevo servicio como origen permitido

1. Conectarse al VPS:
   ```bash
   ssh -i ssh.txt mauri@172.234.228.138
   ```

2. Editar el `.env`:
   ```bash
   nano /home/mauri/incaslop-chat/.env
   ```

3. Agregar el origen a `CHAT_ALLOWED_ORIGINS` (separado por coma):
   ```bash
   CHAT_ALLOWED_ORIGINS=https://chat.incaslop.online,https://congreso.incaslop.online,https://mi-nuevo-servicio.incaslop.online
   ```

4. Reiniciar el servicio:
   ```bash
   systemctl --user restart incaslop-chat.service
   ```

---

## Límites del servicio

| Parámetro | Valor por defecto |
|---|---|
| Mensajes guardados en memoria | 80 |
| Longitud máxima de mensaje | 280 caracteres |
| Rate limit por cliente | 6 mensajes / 10 segundos |
| Persistencia | En memoria (se pierde al reiniciar) |

El chat no persiste en base de datos. Al reiniciar el servicio, el historial se borra.
