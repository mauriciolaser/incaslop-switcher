import { useMemo } from 'react'
import { useGame } from '../context/GameContext'
import { useTournament } from '../context/TournamentContext'
import { calculateWinOdds } from '../utils/odds'
import { getMatchesInRound, getRoundName } from '../utils/tournamentEngine'

function IntroCard({ fighter, side, oddsPct }) {
  return (
    <div className={`intro-fighter-card ${side}`}>
      <div className="intro-fighter-name">{fighter.name}</div>
      <div className="intro-fighter-odds">{oddsPct}% de probabilidad</div>
      <div className="intro-dialog-bubble">"{fighter.introDialog}"</div>
      <div className="intro-fighter-stats">
        <span>ATK {fighter.attack}</span>
        <span>DEF {fighter.defense}</span>
        <span>SPD {fighter.speed}</span>
      </div>
    </div>
  )
}

export default function FightIntroModal() {
  const { phase, fighter1, fighter2, startBetting, isOnline, countdown } = useGame()
  const { mode, bracket, currentGlobalMatchIdx } = useTournament()
  const odds = useMemo(
    () => calculateWinOdds(fighter1, fighter2, { simulations: 280 }),
    [fighter1, fighter2],
  )

  if (phase !== 'intro') return null

  const currentMatch = mode === 'torneo' && currentGlobalMatchIdx != null
    ? bracket[currentGlobalMatchIdx]
    : null

  return (
    <div className="modal-overlay">
      <div className="intro-modal">
        <div className="intro-kicker">Cara a Cara</div>
        <h2 className="intro-title">
          {currentMatch
            ? getRoundName(bracket, currentMatch.round)
            : 'Presentacion del Combate'}
        </h2>
        <p className="intro-subtitle">
          {currentMatch
            ? `Combate ${currentMatch.matchIndex + 1} de ${getMatchesInRound(bracket, currentMatch.round)}`
            : isOnline
              ? 'La arena online abrira las apuestas automaticamente cuando termine la presentacion.'
              : 'Los peleadores entran a la arena antes de abrir las apuestas.'}
        </p>

        <div className="intro-fighters-grid">
          <IntroCard fighter={fighter1} side="left" oddsPct={odds.pct1} />
          <div className="intro-versus">VS</div>
          <IntroCard fighter={fighter2} side="right" oddsPct={odds.pct2} />
        </div>

        {isOnline ? (
          <div className="intro-online-status">
            {countdown != null ? `Comienza en ${countdown}s` : 'Esperando al servidor...'}
          </div>
        ) : (
          <button className="next-round-btn" onClick={startBetting}>
            Abrir Apuestas
          </button>
        )}
      </div>
    </div>
  )
}
