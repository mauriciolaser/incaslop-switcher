import { useGame } from '../context/GameContext'
import WinnerSummary from './WinnerSummary'

export default function GameOver({ onExitHome }) {
  const {
    phase,
    lastResult,
    fighter1,
    fighter2,
    nextRound,
    isOnline,
    countdown,
    gameOver,
    eliminationReason,
    totalRoundsPlayed,
    totalWins,
    playerStats,
  } = useGame()

  if (!lastResult) return null
  if (phase !== 'result') return null

  const winner = lastResult.winnerSide === 'left' ? fighter1 : fighter2
  const roundsPlayed = isOnline ? playerStats?.roundsPlayed ?? 0 : totalRoundsPlayed
  const fightsWon = isOnline ? playerStats?.fightsWon ?? 0 : totalWins
  const lostByNoCoins = gameOver && (eliminationReason === 'no_coins' || !isOnline)

  if (lostByNoCoins) {
    return (
      <div className="modal-overlay">
        <div className="result-modal">
          <h2 className="result-title">Te quedaste sin dinero</h2>
          <div className="winner-name">Perdiste la run</div>
          <div className="winner-hp">No tienes monedas para continuar apostando.</div>
          <div className="bet-result lose">
            Rondas jugadas: {roundsPlayed}
          </div>
          <div className="bet-result win">
            Peleas ganadas: {fightsWon}
          </div>
          <button className="next-round-btn" onClick={onExitHome}>
            Volver al Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay">
      <div className="result-modal">
        <h2 className="result-title">Pelea Terminada!</h2>

        <WinnerSummary winner={winner} label="GANA!" />

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

        {isOnline && gameOver ? (
          <button className="next-round-btn" onClick={onExitHome}>
            Volver al Home
          </button>
        ) : isOnline ? (
          <div className="online-result-note">
            La siguiente ronda comenzara automaticamente{countdown != null ? ` en ${countdown}s` : '.'}
          </div>
        ) : (
          <button className="next-round-btn" onClick={nextRound}>
            Siguiente Ronda
          </button>
        )}
      </div>
    </div>
  )
}
