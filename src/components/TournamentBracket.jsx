import { useTournament } from '../context/TournamentContext'
import { useGame } from '../context/GameContext'
import { getMatchesInRound, getRoundName, getRoundStartIndex, getTotalRounds } from '../utils/tournamentEngine'

function MatchCard({ match, fighters, isCurrent }) {
  const f1 = match.fighter1Idx != null ? fighters[match.fighter1Idx] : null
  const f2 = match.fighter2Idx != null ? fighters[match.fighter2Idx] : null
  const isDone = match.status === 'done'

  return (
    <div className={`bracket-match ${match.status} ${isCurrent ? 'highlight' : ''}`}>
      <div className={`bracket-fighter ${isDone && match.winnerIdx === match.fighter1Idx ? 'winner' : ''} ${isDone && match.winnerIdx !== match.fighter1Idx ? 'eliminated' : ''}`}>
        <span className="bracket-fighter-name">{f1 ? f1.name : '???'}</span>
        {f1 && <span className="bracket-fighter-stats">A{f1.attack} D{f1.defense} S{f1.speed}</span>}
      </div>
      <div className="bracket-vs">vs</div>
      <div className={`bracket-fighter ${isDone && match.winnerIdx === match.fighter2Idx ? 'winner' : ''} ${isDone && match.winnerIdx !== match.fighter2Idx ? 'eliminated' : ''}`}>
        <span className="bracket-fighter-name">{f2 ? f2.name : '???'}</span>
        {f2 && <span className="bracket-fighter-stats">A{f2.attack} D{f2.defense} S{f2.speed}</span>}
      </div>
    </div>
  )
}

export default function TournamentBracket() {
  const { bracket, fighters, currentGlobalMatchIdx, startMatch, tournamentPhase, tournamentSize } = useTournament()
  const { setFighters } = useGame()

  if (tournamentPhase !== 'bracket' || !bracket.length) return null

  const handleStartMatch = () => {
    const match = bracket[currentGlobalMatchIdx]
    if (!match || match.fighter1Idx == null || match.fighter2Idx == null) return

    const f1 = { ...fighters[match.fighter1Idx] }
    const f2 = { ...fighters[match.fighter2Idx] }
    setFighters(f1, f2)
    startMatch()
  }

  const currentMatch = currentGlobalMatchIdx != null ? bracket[currentGlobalMatchIdx] : null
  const canStart = currentMatch && currentMatch.fighter1Idx != null && currentMatch.fighter2Idx != null
  const totalRounds = getTotalRounds(bracket)

  return (
    <div className="modal-overlay">
      <div className="bracket-container">
        <h2 className="bracket-title">TORNEO DE {tournamentSize}</h2>
        {currentMatch && (
          <p className="bracket-round-label">
            {getRoundName(bracket, currentMatch.round)} - Combate {currentMatch.matchIndex + 1} de {getMatchesInRound(bracket, currentMatch.round)}
          </p>
        )}

        <div className="bracket-grid" style={{ gridTemplateColumns: `repeat(${totalRounds}, minmax(0, 1fr))` }}>
          {Array.from({ length: totalRounds }, (_, round) => {
            const start = getRoundStartIndex(bracket, round)
            const count = getMatchesInRound(bracket, round)
            return (
              <div key={round} className="bracket-round">
                <div className="bracket-round-header">{getRoundName(bracket, round)}</div>
                <div className="bracket-round-matches">
                  {Array.from({ length: count }, (_, i) => {
                    const globalIdx = start + i
                    const match = bracket[globalIdx]
                    return (
                      <MatchCard
                        key={globalIdx}
                        match={match}
                        fighters={fighters}
                        isCurrent={globalIdx === currentGlobalMatchIdx}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {canStart && (
          <button className="next-round-btn bracket-start-btn" onClick={handleStartMatch}>
            Siguiente Combate
          </button>
        )}
      </div>
    </div>
  )
}
