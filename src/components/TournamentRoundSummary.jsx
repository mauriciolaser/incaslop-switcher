import { useTournament } from '../context/TournamentContext'

export default function TournamentRoundSummary() {
  const {
    stage,
    roundSummary,
    fighters,
    playerFighterIdx,
    playerStatus,
    continueAfterSummary,
  } = useTournament()

  if (stage !== 'round_summary' || !roundSummary) return null

  const player = playerFighterIdx != null ? fighters[playerFighterIdx] : null

  return (
    <div className="modal-overlay">
      <div className="round-summary-modal">
        <div className="setup-kicker">Fin de Ronda</div>
        <h2 className="result-title">{roundSummary.roundName}</h2>

        {player && (
          <div className="round-summary-player">
            <div className="round-summary-player-name">{player.name}</div>
            <div className="round-summary-player-meta">
              {playerStatus === 'alive' && `Sigue en carrera con ${player.hp}/${player.maxHp} HP`}
              {playerStatus === 'eliminated' && 'Quedo eliminado. El torneo continua en modo espectador.'}
              {playerStatus === 'champion' && 'Se convirtio en campeon del torneo.'}
            </div>
          </div>
        )}

        <div className="round-summary-copy">
          {roundSummary.playerAdvanced && 'Tu congresista avanzo a la siguiente llave.'}
          {roundSummary.playerEliminated && 'Tu congresista cayo en combate, pero puedes seguir viendo el torneo.'}
          {!roundSummary.playerMatch && 'La ronda sigue avanzando con el resto de combates.'}
        </div>

        <button className="next-round-btn" onClick={continueAfterSummary}>
          Continuar
        </button>
      </div>
    </div>
  )
}
