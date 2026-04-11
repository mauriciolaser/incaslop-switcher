import { useEffect, useRef, useState, useCallback } from 'react'
import { connectChat } from '../utils/chatApi'

const STATUS_LABEL = {
  connecting: 'Conectando...',
  connected: null,
  error: 'Sin conexión',
  closed: 'Desconectado',
}

function TournamentChatPanel() {
  return (
    <div className="battle-panel-shell battle-chat-panel battle-chat-tournament">
      <div className="battle-chat-unavailable">
        CHAT NO DISPONIBLE EN MODO TOURNAMENT
      </div>
    </div>
  )
}

function EndlessChatPanel() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState('connecting')
  const [playerId, setPlayerId] = useState(null)
  const [serverError, setServerError] = useState(null)
  const connRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    const conn = connectChat({
      onWelcome: (id) => setPlayerId(id),
      onHistory: (msgs) => setMessages(msgs),
      onMessage: (msg) => setMessages((prev) => [...prev, msg]),
      onError: (code, message) => {
        setServerError({ code, message })
        setTimeout(() => setServerError(null), 4000)
      },
      onStatus: setStatus,
    })
    connRef.current = conn
    return () => conn.close()
  }, [])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text) return
    connRef.current?.send(text)
    setInput('')
  }, [input])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') handleSend()
  }, [handleSend])

  const statusLabel = STATUS_LABEL[status]

  return (
    <div className="battle-panel-shell battle-chat-panel">
      <div className="battle-chat-header">
        <span className="battle-chat-title">Chat</span>
        {statusLabel && (
          <span className={`battle-chat-status battle-chat-status--${status}`}>
            {statusLabel}
          </span>
        )}
        {status === 'connected' && playerId && (
          <span className="battle-chat-playerid">{playerId}</span>
        )}
      </div>

      <ul className="battle-chat-list" ref={listRef} aria-live="polite">
        {messages.map((m, i) => (
          <li key={i} className={`battle-chat-msg ${m.playerId === playerId ? 'battle-chat-msg--own' : ''}`}>
            <span className="battle-chat-msg-author">{m.playerId}</span>
            <span className="battle-chat-msg-text">{m.text}</span>
          </li>
        ))}
      </ul>

      {serverError && (
        <div className="battle-chat-error">
          {serverError.code === 'CHAT_RATE_LIMITED' && 'Demasiados mensajes, espera un momento.'}
          {serverError.code === 'CHAT_MESSAGE_TOO_LONG' && 'Mensaje demasiado largo (máx. 280 caracteres).'}
          {serverError.code !== 'CHAT_RATE_LIMITED' && serverError.code !== 'CHAT_MESSAGE_TOO_LONG' && serverError.message}
        </div>
      )}

      <div className="battle-chat-compose">
        <input
          className="battle-chat-input"
          type="text"
          maxLength={280}
          placeholder="Escribe un mensaje..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={status !== 'connected'}
        />
        <button
          className="battle-chat-send"
          onClick={handleSend}
          disabled={status !== 'connected' || !input.trim()}
        >
          Enviar
        </button>
      </div>
    </div>
  )
}

export default function BattleChatPanel({ sessionType }) {
  if (sessionType === 'tournament') return <TournamentChatPanel />
  return <EndlessChatPanel />
}
