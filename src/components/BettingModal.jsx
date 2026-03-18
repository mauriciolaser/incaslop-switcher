import { useState, useEffect, useRef, useMemo } from 'react'
import { useGame } from '../context/GameContext'
import { useBattle } from '../hooks/useBattle'

const BET_TIMER = 15

function calcOdds(f1, f2) {
  const power1 = f1.attack * 1.2 + f1.defense * 0.8 + f1.speed * 0.5 + (f1.hp / f1.maxHp) * 10
  const power2 = f2.attack * 1.2 + f2.defense * 0.8 + f2.speed * 0.5 + (f2.hp / f2.maxHp) * 10
  const total = power1 + power2
  const pct1 = Math.round((power1 / total) * 100)
  const pct2 = 100 - pct1
  return { pct1, pct2 }
}

export default function BettingModal() {
  const { phase, fighter1, fighter2, stake, coins, bet, placeBet } = useGame()
  const { runBattle } = useBattle()
  const [timer, setTimer] = useState(BET_TIMER)
  const intervalRef = useRef(null)
  const startedRef = useRef(false)
  const odds = useMemo(() => calcOdds(fighter1, fighter2), [fighter1, fighter2])

  useEffect(() => {
    if (phase !== 'betting') {
      startedRef.current = false
      return
    }

    setTimer(BET_TIMER)
    startedRef.current = false

    intervalRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          if (!startedRef.current) {
            startedRef.current = true
            setTimeout(() => runBattle(), 100)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [phase, runBattle])

  const handleBet = (side) => {
    if (coins < stake) return
    placeBet(side)
  }

  const handleStartEarly = () => {
    clearInterval(intervalRef.current)
    if (!startedRef.current) {
      startedRef.current = true
      runBattle()
    }
  }

  if (phase !== 'betting') return null

  return (
    <div className="modal-overlay">
      <div className="betting-modal">
        <h2>Ronda de Apuestas</h2>

        <div className="timer-circle">
          <svg viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke="#333"
              strokeWidth="5"
            />
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke="#ffaa00"
              strokeWidth="5"
              strokeDasharray={`${(timer / BET_TIMER) * 283} 283`}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
          </svg>
          <span className="timer-text">{timer}s</span>
        </div>

        <div className="stake-display">
          Apuesta: <span className="stake-amount">{stake}</span> monedas
        </div>

        {/* Odds bar */}
        <div className="odds-bar-container">
          <div className="odds-bar">
            <div className="odds-fill left" style={{ width: `${odds.pct1}%` }}>
              {odds.pct1}%
            </div>
            <div className="odds-fill right" style={{ width: `${odds.pct2}%` }}>
              {odds.pct2}%
            </div>
          </div>
          <div className="odds-labels">
            <span className="odds-label left">{odds.pct1 >= odds.pct2 ? 'Favorito' : ''}</span>
            <span className="odds-label right">{odds.pct2 > odds.pct1 ? 'Favorito' : ''}</span>
          </div>
        </div>

        <div className="fighters-preview">
          <div className={`fighter-card left ${bet === 'left' ? 'selected' : ''}`}>
            <div className="fighter-card-name">{fighter1.name}</div>
            <div className="fighter-odds">{odds.pct1}% prob.</div>
            <div className="fighter-card-stats">
              <div>ATK: {fighter1.attack}</div>
              <div>DEF: {fighter1.defense}</div>
              <div>SPD: {fighter1.speed}</div>
            </div>
            <button
              className="bet-button bet-left"
              onClick={() => handleBet('left')}
              disabled={bet !== null || coins < stake}
            >
              {bet === 'left' ? 'Apostado!' : 'Apostar'}
            </button>
          </div>

          <div className="vs-divider">VS</div>

          <div className={`fighter-card right ${bet === 'right' ? 'selected' : ''}`}>
            <div className="fighter-card-name">{fighter2.name}</div>
            <div className="fighter-odds">{odds.pct2}% prob.</div>
            <div className="fighter-card-stats">
              <div>ATK: {fighter2.attack}</div>
              <div>DEF: {fighter2.defense}</div>
              <div>SPD: {fighter2.speed}</div>
            </div>
            <button
              className="bet-button bet-right"
              onClick={() => handleBet('right')}
              disabled={bet !== null || coins < stake}
            >
              {bet === 'right' ? 'Apostado!' : 'Apostar'}
            </button>
          </div>
        </div>

        {coins < stake && (
          <div className="no-coins-warning">No tienes suficientes monedas para apostar</div>
        )}

        <button className="start-early-btn" onClick={handleStartEarly}>
          {bet ? 'Comenzar Pelea!' : 'Saltar (sin apuesta)'}
        </button>
      </div>
    </div>
  )
}
