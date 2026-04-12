import { useGame } from '../context/GameContext'
import { useTournament } from '../context/TournamentContext'
import {
  getBracketSideMatches,
  getRoundName,
  getTotalRounds,
  isPlayerMatch,
} from '../utils/tournamentEngine'

function FighterRow({ fighter, isWinner, isEliminated, isPlayer }) {
  return (
    <div className={`bracket-fighter ${isWinner ? 'winner' : ''} ${isEliminated ? 'eliminated' : ''} ${isPlayer ? 'player' : ''}`}>
      <span className="bracket-fighter-name">
        {isPlayer && <span className="bracket-player-star">★</span>}
        {fighter ? fighter.name : '???'}
      </span>
      {fighter && (
        <span className="bracket-fighter-stats">
          {isPlayer ? 'TU PELEADOR' : `${fighter.party || fighter.region || fighter.type}`}
        </span>
      )}
    </div>
  )
}

function MatchCard({ match, fighters, currentGlobalMatchIdx, playerFighterIdx }) {
  const fighter1 = match.fighter1Idx != null ? fighters[match.fighter1Idx] : null
  const fighter2 = match.fighter2Idx != null ? fighters[match.fighter2Idx] : null
  const isCurrent = match.globalIdx === currentGlobalMatchIdx

  return (
    <div className={`bracket-match ${match.status} ${isCurrent ? 'highlight' : ''}`}>
      <FighterRow
        fighter={fighter1}
        isWinner={match.status === 'done' && match.winnerIdx === match.fighter1Idx}
        isEliminated={match.status === 'done' && fighter1 && match.winnerIdx !== match.fighter1Idx}
        isPlayer={match.fighter1Idx === playerFighterIdx}
      />
      <div className="bracket-vs">vs</div>
      <FighterRow
        fighter={fighter2}
        isWinner={match.status === 'done' && match.winnerIdx === match.fighter2Idx}
        isEliminated={match.status === 'done' && fighter2 && match.winnerIdx !== match.fighter2Idx}
        isPlayer={match.fighter2Idx === playerFighterIdx}
      />
    </div>
  )
}

function BracketSide({ side, rounds, fighters, currentGlobalMatchIdx, playerFighterIdx }) {
  return (
    <div className={`bracket-side ${side}`}>
      {rounds.map((matches, roundOffset) => (
        <div key={`${side}-${roundOffset}`} className="bracket-round">
          <div className="bracket-round-header">{getRoundName([...matches], matches[0]?.round ?? roundOffset)}</div>
          <div className="bracket-round-matches">
            {matches.map((match) => (
              <MatchCard
                key={match.globalIdx}
                match={match}
                fighters={fighters}
                currentGlobalMatchIdx={currentGlobalMatchIdx}
                playerFighterIdx={playerFighterIdx}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function TournamentBracket() {
  const {
    stage,
    bracket,
    fighters,
    currentMatch,
    currentGlobalMatchIdx,
    currentRound,
    playerFighterIdx,
    isCurrentPlayerMatch,
    startMatch,
    simulateCurrentMatch,
    skipRound,
  } = useTournament()
  const { setFighters } = useGame()

  if (stage !== 'bracket' || !bracket.length || !currentMatch) return null

  const totalRounds = getTotalRounds(bracket)
  const leftRounds = getBracketSideMatches(
    bracket.map((match, index) => ({ ...match, globalIdx: index })),
    'left',
    totalRounds,
  )
  const rightRounds = getBracketSideMatches(
    bracket.map((match, index) => ({ ...match, globalIdx: index })),
    'right',
    totalRounds,
  )
  const finalMatch = bracket.find((match) => match.round === totalRounds - 1) ?? null

  const handleWatchMatch = () => {
    const fighter1 = fighters[currentMatch.fighter1Idx]
    const fighter2 = fighters[currentMatch.fighter2Idx]
    if (!fighter1 || !fighter2) return
    setFighters(fighter1, fighter2)
    startMatch(isCurrentPlayerMatch ? 'player' : 'watch')
  }

  return (
    <div className="modal-overlay">
      <div className="bracket-shell">
        <div className="bracket-header">
          <div>
            <div className="setup-kicker">Tournament</div>
            <h2 className="bracket-title">Bracket de 32</h2>
            <p className="bracket-round-label">
              {getRoundName(bracket, currentRound)} · Combate {currentMatch.matchIndex + 1}
            </p>
          </div>
          <div className="bracket-header-actions">
            {isCurrentPlayerMatch ? (
              <button className="next-round-btn" onClick={handleWatchMatch}>
                Jugar Combate
              </button>
            ) : (
              <>
                <button className="menu-back-btn" onClick={simulateCurrentMatch}>
                  Saltar Pelea
                </button>
                <button className="menu-back-btn" onClick={skipRound}>
                  Saltar Ronda
                </button>
                <button className="next-round-btn" onClick={handleWatchMatch}>
                  Ver Pelea
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bracket-mirror-layout">
          <BracketSide
            side="left"
            rounds={leftRounds}
            fighters={fighters}
            currentGlobalMatchIdx={currentGlobalMatchIdx}
            playerFighterIdx={playerFighterIdx}
          />

          <div className="bracket-final-column">
            <div className="bracket-round-header">Final</div>
            {finalMatch && (
              <MatchCard
                match={{ ...finalMatch, globalIdx: bracket.length - 1 }}
                fighters={fighters}
                currentGlobalMatchIdx={currentGlobalMatchIdx}
                playerFighterIdx={playerFighterIdx}
              />
            )}
          </div>

          <BracketSide
            side="right"
            rounds={rightRounds.reverse()}
            fighters={fighters}
            currentGlobalMatchIdx={currentGlobalMatchIdx}
            playerFighterIdx={playerFighterIdx}
          />
        </div>

        <div className="bracket-status-banner">
          {isPlayerMatch(currentMatch, playerFighterIdx)
            ? 'Tu congresista entra ahora a la arena.'
            : 'Puedes mirar la siguiente pelea NPC o resolverla de inmediato.'}
        </div>
      </div>
    </div>
  )
}
