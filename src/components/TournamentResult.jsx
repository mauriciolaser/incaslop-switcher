import { useGame } from '../context/GameContext'
import { useTournament } from '../context/TournamentContext'
import { getRoundName } from '../utils/tournamentEngine'
import WinnerSummary from './WinnerSummary'

function ChampionScreen({ champion, onNewTournament, onMenu }) {
  return (
    <div className="modal-overlay">
      <div className="result-modal champion-modal">
        <h2 className="champion-title">Campeon del Tournament</h2>
        <WinnerSummary winner={champion} label="CAMPEON" />
        <div className="champion-name">{champion.name}</div>
        <div className="champion-stats">
          {champion.party || champion.region || champion.type}
        </div>
        <div className="champion-buttons">
          <button className="next-round-btn" onClick={onNewTournament}>
            Nuevo Tournament
          </button>
          <button className="menu-back-btn" onClick={onMenu}>
            Volver al Home
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TournamentResult({ onExitHome }) {
  const { phase, lastResult, fighter1, fighter2, resetGame } = useGame()
  const {
    stage,
    bracket,
    currentMatch,
    resolveMatch,
    champion,
    selectedCandidate,
    initTournament,
  } = useTournament()

  const handleNewTournament = () => {
    resetGame()
    if (selectedCandidate) {
      initTournament(selectedCandidate, 32)
    }
  }

  if (stage === 'champion' && champion) {
    return (
      <ChampionScreen
        champion={champion}
        onNewTournament={handleNewTournament}
        onMenu={onExitHome}
      />
    )
  }

  if (stage !== 'fighting' || phase !== 'result' || !lastResult || !currentMatch) return null

  const winner = lastResult.winnerSide === 'left' ? fighter1 : fighter2
  const loser = lastResult.winnerSide === 'left' ? fighter2 : fighter1
  const roundName = getRoundName(bracket, currentMatch.round)

  const handleContinue = () => {
    resolveMatch(lastResult.winnerSide, winner, loser)
  }

  return (
    <div className="modal-overlay">
      <div className="result-modal">
        <h2 className="result-title">{roundName}</h2>

        <WinnerSummary winner={winner} label="GANA" />

        <div className="winner-hp">
          HP restante: {winner.hp} / {winner.maxHp}
        </div>

        <button className="next-round-btn" onClick={handleContinue}>
          Continuar
        </button>
      </div>
    </div>
  )
}
