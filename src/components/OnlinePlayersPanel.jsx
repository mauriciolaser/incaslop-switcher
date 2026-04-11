import { useState } from 'react'
import { useGame } from '../context/GameContext'

export default function OnlinePlayersPanel() {
  const { isOnline, players = [], viewer } = useGame()
  const [open, setOpen] = useState(false)

  if (!isOnline) return null

  return (
    <>
      <button
        className="connected-btn"
        onClick={() => setOpen(true)}
        title="Ver jugadores conectados"
      >
        CONECTADO ({players.length})
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="connected-modal" onClick={e => e.stopPropagation()}>
            <div className="connected-modal-title">Jugadores Conectados</div>
            <div className="online-players-list">
              {players.map((player) => (
                <div
                  key={player.userKey}
                  className={`online-player-row ${viewer?.userKey === player.userKey ? 'is-viewer' : ''}`}
                >
                  {player.label} <span className="player-coins">({player.coins} monedas)</span>
                </div>
              ))}
              {players.length === 0 && (
                <div className="online-player-row empty">Esperando jugadores...</div>
              )}
            </div>
            <button className="connected-modal-close" onClick={() => setOpen(false)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
