import { useGame } from '../context/GameContext'
import { useTournament } from '../context/TournamentContext'
import { getRoundName, getMatchesInRound } from '../utils/tournamentEngine'

export default function BattleHUD() {
  const { round, coins, phase, isOnline, connectionStatus } = useGame()
  const { mode, bracket, currentGlobalMatchIdx } = useTournament()

  const isTorneo = mode === 'torneo'
  const currentMatch = isTorneo && currentGlobalMatchIdx != null ? bracket[currentGlobalMatchIdx] : null

  return (
    <div className="battle-hud">
      {isTorneo && currentMatch ? (
        <div className="hud-item">
          <span className="hud-label">{getRoundName(bracket, currentMatch.round)}</span>
          <span className="hud-value">
            {currentMatch.matchIndex + 1}/{getMatchesInRound(bracket, currentMatch.round)}
          </span>
        </div>
      ) : (
        <div className="hud-item">
          <span className="hud-label">Ronda</span>
          <span className="hud-value">{round}</span>
        </div>
      )}
      <div className="hud-item">
        <span className="hud-label">Monedas</span>
        <span className="hud-value coins">{coins}</span>
      </div>
      <div className="hud-item">
        <span className="hud-label">Modo</span>
        <span className="hud-value phase">{isOnline ? 'Online' : 'Local'}</span>
      </div>
      <div className="hud-item">
        <span className="hud-label">Estado</span>
        <span className="hud-value phase">
          {phase === 'intro' ? 'Presentacion' : phase === 'betting' ? 'Apuestas' : phase === 'fighting' ? 'Luchando' : 'Resultado'}
        </span>
      </div>
      {isOnline && (
        <div className="hud-item">
          <span className="hud-label">Conexion</span>
          <span className="hud-value phase">
            {connectionStatus === 'connected' ? 'Activa' : connectionStatus === 'connecting' ? 'Conectando' : 'Reintentando'}
          </span>
        </div>
      )}
    </div>
  )
}
