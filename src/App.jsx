import { useState } from 'react'
import { LocalGameProvider, useGame } from './context/GameContext'
import { OnlineGameProvider } from './context/OnlineGameContext'
import { TournamentProvider, useTournament } from './context/TournamentContext'
import BattleScene from './components/BattleScene'
import HealthBars from './components/HealthBar'
import BattleHUD from './components/BattleHUD'
import BattleLog from './components/BattleLog'
import BettingModal from './components/BettingModal'
import FightIntroModal from './components/FightIntroModal'
import GameOver from './components/GameOver'
import MainMenu from './components/MainMenu'
import TournamentBracket from './components/TournamentBracket'
import TournamentResult from './components/TournamentResult'
import './App.css'

function ModeSelector({ onSelect }) {
  return (
    <div className="game-container">
      <div className="mode-select-shell">
        <div className="mode-select-panel">
          <div className="mode-select-kicker">Selecciona tu experiencia</div>
          <h1 className="mode-select-title">Mechas IncaSlop</h1>
          <p className="mode-select-subtitle">
            Elige si quieres jugar completamente local o mirar la arena compartida online.
          </p>

          <div className="mode-select-grid">
            <button className="mode-card local" onClick={() => onSelect('local')}>
              <span className="mode-card-title">LOCAL</span>
              <span className="mode-card-desc">
                Todo corre en tu navegador. Incluye infinito y torneo, como hasta ahora.
              </span>
            </button>

            <button className="mode-card online" onClick={() => onSelect('online')}>
              <span className="mode-card-title">ONLINE</span>
              <span className="mode-card-desc">
                Pelea infinita compartida con polling. Todos observan el mismo combate.
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SessionToolbar({ onExit }) {
  const { isOnline, connectionStatus, onlineError } = useGame()

  return (
    <div className="session-toolbar">
      <div className={`session-pill ${isOnline ? 'online' : 'local'}`}>
        {isOnline ? 'ONLINE' : 'LOCAL'}
      </div>

      {isOnline && (
        <div className={`session-connection ${connectionStatus}`}>
          {connectionStatus === 'connected' && 'Conectado'}
          {connectionStatus === 'connecting' && 'Conectando...'}
          {connectionStatus === 'error' && (onlineError || 'Reconectando...')}
        </div>
      )}

      <button className="session-exit-btn" onClick={onExit}>
        Cambiar Modo
      </button>
    </div>
  )
}

function SharedArena() {
  const { mode, tournamentPhase } = useTournament()
  const { phase } = useGame()
  const inTournamentMatchFlow = mode === 'torneo' && tournamentPhase === 'fighting'
  const inMatchFlow = mode === 'endless' || mode === 'online' || inTournamentMatchFlow
  const showCombatUI = inMatchFlow && phase !== 'intro'

  return (
    <>
      <BattleScene />
      <MainMenu />

      {mode !== 'menu' && <BattleHUD />}
      {showCombatUI && <HealthBars />}
      {showCombatUI && <BattleLog />}
      {inMatchFlow && <FightIntroModal />}
      {inMatchFlow && <BettingModal />}

      {(mode === 'endless' || mode === 'online') && <GameOver />}

      {mode === 'torneo' && tournamentPhase === 'bracket' && <TournamentBracket />}
      {mode === 'torneo' && <TournamentResult />}
    </>
  )
}

function LocalSession({ onExit }) {
  return (
    <LocalGameProvider>
      <TournamentProvider initialMode="menu">
        <div className="game-container">
          <SessionToolbar onExit={onExit} />
          <SharedArena />
        </div>
      </TournamentProvider>
    </LocalGameProvider>
  )
}

function OnlineSession({ onExit }) {
  return (
    <OnlineGameProvider>
      <TournamentProvider initialMode="online">
        <div className="game-container">
          <SessionToolbar onExit={onExit} />
          <SharedArena />
        </div>
      </TournamentProvider>
    </OnlineGameProvider>
  )
}

export default function App() {
  const [sessionMode, setSessionMode] = useState(null)

  if (sessionMode === 'local') {
    return <LocalSession onExit={() => setSessionMode(null)} />
  }

  if (sessionMode === 'online') {
    return <OnlineSession onExit={() => setSessionMode(null)} />
  }

  return <ModeSelector onSelect={setSessionMode} />
}

