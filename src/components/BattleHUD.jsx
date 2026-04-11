import { useGame } from '../context/GameContext'
import { useTournament } from '../context/TournamentContext'
import { getRoundName, getMatchesInRound } from '../utils/tournamentEngine'

export default function BattleHUD({ sessionType }) {
  const { round, phase, isOnline, connectionStatus, players = [] } = useGame()
  const { bracket, currentMatch, playerStatus } = useTournament()

  const isTournament = sessionType === 'tournament'
  const phaseLabel = phase === 'intro'
    ? 'Presentacion'
    : phase === 'betting'
      ? 'Apuestas'
      : phase === 'fighting'
        ? 'Luchando'
        : phase === 'ko'
          ? 'KO Dramatico'
          : 'Resultado'

  return (
    <div className="battle-hud">
      {isTournament && currentMatch ? (
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
        <span className="hud-label">Modo</span>
        <span className="hud-value phase">{isTournament ? 'Tournament' : 'Endless'}</span>
      </div>
      <div className="hud-item">
        <span className="hud-label">Estado</span>
        <span className="hud-value phase">{phaseLabel}</span>
      </div>
      {isTournament && (
        <div className="hud-item">
          <span className="hud-label">Tu Estado</span>
          <span className="hud-value phase">{playerStatus === 'alive' ? 'Activo' : playerStatus === 'champion' ? 'Campeon' : 'Espectador'}</span>
        </div>
      )}
      {isOnline && (
        <div className="hud-item">
          <span className="hud-label">Conexion</span>
          <span className="hud-value phase">
            {connectionStatus === 'connected' ? 'Activa' : connectionStatus === 'connecting' ? 'Conectando' : 'Reintentando'}
          </span>
        </div>
      )}
      {isOnline && (
        <div className="hud-item">
          <span className="hud-label">Sala</span>
          <span className="hud-value phase">{players.length} players</span>
        </div>
      )}
    </div>
  )
}
