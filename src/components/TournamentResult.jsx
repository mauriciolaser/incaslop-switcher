import { useGame } from '../context/GameContext'
import { useTournament } from '../context/TournamentContext'
import { getRoundName } from '../utils/tournamentEngine'

function ChampionScreen({ champion, onNewTournament, onMenu }) {
  return (
    <div className="modal-overlay">
      <div className="result-modal champion-modal">
        <h2 className="champion-title">CAMPEON DEL TORNEO</h2>
        <div className="champion-name">{champion.name}</div>
        <div className="champion-stats">
          ATK {champion.attack} &middot; DEF {champion.defense} &middot; SPD {champion.speed}
        </div>
        <div className="champion-buttons">
          <button className="next-round-btn" onClick={onNewTournament}>
            NUEVO TORNEO
          </button>
          <button className="menu-back-btn" onClick={onMenu}>
            MENU PRINCIPAL
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TournamentResult() {
  const { phase, lastResult, fighter1, fighter2, resetGame } = useGame()
  const { mode, tournamentPhase, bracket, currentGlobalMatchIdx, matchResult, champion, initTournament, resetTournament, tournamentSize } = useTournament()

  const handleNewTournament = () => {
    resetGame()
    initTournament(tournamentSize)
  }

  // Champion screen
  if (mode === 'torneo' && tournamentPhase === 'champion' && champion) {
    return (
      <ChampionScreen
        champion={champion}
        onNewTournament={handleNewTournament}
        onMenu={resetTournament}
      />
    )
  }

  // Match result in tournament mode
  if (mode !== 'torneo' || phase !== 'result' || !lastResult || tournamentPhase !== 'fighting') return null

  const winner = lastResult.winnerSide === 'left' ? fighter1 : fighter2
  const currentMatch = bracket[currentGlobalMatchIdx]
  const roundName = currentMatch ? getRoundName(bracket, currentMatch.round) : ''

  const handleViewBracket = () => {
    matchResult(lastResult.winnerSide, winner)
  }

  return (
    <div className="modal-overlay">
      <div className="result-modal">
        <h2 className="result-title">{roundName}</h2>

        <div className="winner-announce">
          <span className="winner-name">{winner.name}</span>
          <span className="winner-label">GANA!</span>
        </div>

        <div className="winner-hp">
          HP restante: {winner.hp} / {winner.maxHp}
        </div>

        {lastResult.betResult === 'win' && (
          <div className="bet-result win">
            Ganaste +{lastResult.stake} monedas!
          </div>
        )}
        {lastResult.betResult === 'lose' && (
          <div className="bet-result lose">
            Perdiste -{lastResult.stake} monedas
          </div>
        )}
        {lastResult.betResult === 'none' && (
          <div className="bet-result none">
            No apostaste esta ronda
          </div>
        )}

        <button className="next-round-btn" onClick={handleViewBracket}>
          Ver Bracket
        </button>
      </div>
    </div>
  )
}
