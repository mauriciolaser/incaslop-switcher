export default function FutureChatPanel() {
  return (
    <div className="battle-panel-shell battle-chat-panel">
      <div className="battle-panel-header">
        <span className="battle-panel-kicker">Proximamente</span>
        <span className="battle-panel-title">Canal de Chat</span>
      </div>

      <div className="battle-chat-placeholder">
        <div className="battle-chat-placeholder-badge">WS</div>
        <p className="battle-chat-placeholder-copy">
          Espacio reservado para el servicio de chat conectado por websocket.
        </p>
        <p className="battle-chat-placeholder-note">
          Sprint 3 solo deja listo el panel visual.
        </p>
      </div>
    </div>
  )
}
