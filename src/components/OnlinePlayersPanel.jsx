import { useGame } from '../context/GameContext'

export default function OnlinePlayersPanel() {
  const { isOnline, players = [], viewer } = useGame()

  if (!isOnline) return null

  return (
    <aside className="online-players-panel">
      <div className="online-players-title">Jugadores Conectados</div>
      <div className="online-players-list">
        {players.map((player) => (
          <div
            key={player.userKey}
            className={`online-player-row ${viewer?.userKey === player.userKey ? 'is-viewer' : ''}`}
          >
            {player.label}(${player.coins})
          </div>
        ))}
        {players.length === 0 && (
          <div className="online-player-row empty">Esperando jugadores...</div>
        )}
      </div>
    </aside>
  )
}
