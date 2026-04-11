const WS_URL = import.meta.env.VITE_CHAT_WS_URL || 'wss://chat.incaslop.online/ws'

/**
 * Opens a WebSocket connection to the chat server.
 * Returns a handle with a `send(text)` method and a `close()` method.
 *
 * @param {object} handlers
 * @param {(playerId: string) => void} handlers.onWelcome
 * @param {(messages: Array<{playerId:string,text:string,sentAt:number}>) => void} handlers.onHistory
 * @param {(msg: {playerId:string,text:string,sentAt:number}) => void} handlers.onMessage
 * @param {(code: string, message: string) => void} handlers.onError
 * @param {(status: 'connecting'|'connected'|'error'|'closed') => void} handlers.onStatus
 */
export function connectChat({ onWelcome, onHistory, onMessage, onError, onStatus }) {
  onStatus('connecting')
  const ws = new WebSocket(WS_URL)

  ws.addEventListener('open', () => {
    onStatus('connected')
  })

  ws.addEventListener('message', (event) => {
    let msg
    try {
      msg = JSON.parse(event.data)
    } catch {
      return
    }

    if (msg.type === 'welcome') {
      onWelcome?.(msg.payload.playerId)
    } else if (msg.type === 'chat_history') {
      onHistory?.(msg.payload.messages)
    } else if (msg.type === 'chat_message') {
      onMessage?.(msg.payload)
    } else if (msg.type === 'error') {
      onError?.(msg.payload.code, msg.payload.message)
    }
  })

  ws.addEventListener('error', () => {
    onStatus('error')
  })

  ws.addEventListener('close', () => {
    onStatus('closed')
  })

  return {
    send(text) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'chat_message', payload: { text } }))
      }
    },
    close() {
      ws.close()
    },
  }
}
