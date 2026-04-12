import { useGame } from '../context/GameContext'
import { useTournament } from '../context/TournamentContext'
import { useBattle } from '../hooks/useBattle'
import { getMatchesInRound, getRoundName } from '../utils/tournamentEngine'
import PartyLogoBadge from './PartyLogoBadge'

function IntroCard({ fighter, side }) {
  return (
    <div className={`intro-fighter-card ${side}`}>
      <div className="intro-fighter-portrait-wrap">
        {fighter.portraitUrl ? (
          <img className="intro-fighter-portrait" src={fighter.portraitUrl} alt={fighter.name} />
        ) : (
          <div className="intro-fighter-portrait-placeholder">Sin Foto</div>
        )}
        <PartyLogoBadge partyImage={fighter.partyImage} party={fighter.party} className="portrait-corner-badge" />
      </div>
      <div className="intro-fighter-name">{fighter.name}</div>
      <div className="intro-dialog-bubble">"{fighter.introDialog}"</div>
      <div className="intro-fighter-stats">
        <span>ATAQUE: {fighter.attack}</span>
        <span>DEFENSA: {fighter.defense}</span>
        <span>ACHORAMIENTO: {fighter.speed}</span>
      </div>
    </div>
  )
}

export default function FightIntroModal() {
  const { phase, fighter1, fighter2, startBetting, isOnline, countdown } = useGame()
  const { runBattle } = useBattle()
  const { stage, bracket, currentGlobalMatchIdx, watchMode } = useTournament()

  if (phase !== 'intro') return null
  if (!isOnline && stage !== 'fighting') return null

  const currentMatch = stage === 'fighting' && currentGlobalMatchIdx != null
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
          <IntroCard fighter={fighter1} side="left" />
          <div className="intro-versus">VS</div>
          <IntroCard fighter={fighter2} side="right" />
        </div>

        {isOnline ? (
          <div className="intro-online-status">
            {countdown != null ? `Comienza en ${countdown}s` : 'Esperando al servidor...'}
          </div>
        ) : currentMatch ? (
          <button className="next-round-btn" onClick={runBattle}>
            {watchMode === 'player' ? 'Comenzar Combate' : 'Ver Pelea'}
          </button>
        ) : (
          <button className="next-round-btn" onClick={startBetting}>
            Abrir Apuestas
          </button>
        )}
      </div>
    </div>
  )
}
