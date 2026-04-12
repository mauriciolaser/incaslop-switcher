import { useEffect, useState } from 'react'
import { LocalGameProvider, useGame } from './context/GameContext'
import { OnlineGameProvider } from './context/OnlineGameContext'
import { TournamentProvider, useTournament } from './context/TournamentContext'
import BattleScene from './components/BattleScene'
import HealthBars from './components/HealthBar'
import BattleHUD from './components/BattleHUD'
import BattleLog from './components/BattleLog'
import BattleChatPanel from './components/BattleChatPanel'
import BettingModal from './components/BettingModal'
import FightIntroModal from './components/FightIntroModal'
import GameOver from './components/GameOver'
import MoneyHUD from './components/MoneyHUD'
import MainMenu from './components/MainMenu'
import OnlinePlayersPanel from './components/OnlinePlayersPanel'
import TournamentBracket from './components/TournamentBracket'
import TournamentResult from './components/TournamentResult'
import TournamentRoundSummary from './components/TournamentRoundSummary'
import TournamentSetup from './components/TournamentSetup'
import SpriteDebugLab from './components/SpriteDebugLab'
import BootScreen from './components/BootScreen'
import { ensureCandidatePool, getCandidateApiBase } from './utils/candidateCatalog'
import './App.css'

function SessionToolbar({ label, onExit }) {
  const { isOnline, connectionStatus, onlineError, viewer } = useGame()

  return (
    <div className="session-toolbar">
      <div className={`session-pill ${isOnline ? 'online' : 'local'}`}>
        {label}
      </div>

      {viewer?.label && (
        <div className="session-connection connected">{viewer.label}</div>
      )}

      {isOnline && connectionStatus !== 'connected' && (
        <div className={`session-connection ${connectionStatus}`}>
          {connectionStatus === 'connecting' && 'Conectando...'}
          {connectionStatus === 'error' && (onlineError || 'Reconectando...')}
        </div>
      )}

      {isOnline && <OnlinePlayersPanel />}

      <button className="session-exit-btn" onClick={onExit}>
        Volver al Home
      </button>
    </div>
  )
}

function SharedArena({ sessionType, onExit }) {
  const { phase } = useGame()
  const { stage } = useTournament()
  const showTournamentCombatUI = sessionType === 'tournament' && stage === 'fighting' && phase !== 'intro' && phase !== 'result'
  const showEndlessCombatUI = sessionType === 'endless' && phase !== 'intro' && phase !== 'result'
  const showCombatUI = showTournamentCombatUI || showEndlessCombatUI
  const showHud = sessionType === 'endless' || stage !== 'setup'

  return (
    <>
      <BattleScene />
      <SessionToolbar label={sessionType === 'endless' ? 'ENDLESS' : 'TOURNAMENT'} onExit={onExit} />
      {sessionType === 'endless' && <MoneyHUD />}
      {showHud && <BattleHUD sessionType={sessionType} />}

      {showCombatUI && <HealthBars />}
      {showCombatUI && (
        <div className="battle-bottom-panels">
          <BattleLog />
          <BattleChatPanel sessionType={sessionType} />
        </div>
      )}

      {sessionType === 'endless' && <FightIntroModal />}
      {sessionType === 'endless' && <BettingModal />}
      {sessionType === 'endless' && <GameOver onExitHome={onExit} />}

      {sessionType === 'tournament' && <TournamentSetup />}
      {sessionType === 'tournament' && <TournamentBracket />}
      {sessionType === 'tournament' && <FightIntroModal />}
      {sessionType === 'tournament' && <TournamentResult onExitHome={onExit} />}
      {sessionType === 'tournament' && <TournamentRoundSummary />}
    </>
  )
}

function TournamentSession({ onExit }) {
  return (
    <LocalGameProvider>
      <TournamentProvider>
        <div className="game-container">
          <SharedArena sessionType="tournament" onExit={onExit} />
        </div>
      </TournamentProvider>
    </LocalGameProvider>
  )
}

function TournamentSessionGate({ onExit }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void ensureCandidatePool().then(() => {
      if (!cancelled) {
        setReady(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) {
    return (
      <div className="game-container">
        <div className="candidate-loading-shell">
          <div className="candidate-loading-panel">
            <div className="candidate-loading-title">Cargando catalogo local de congresistas...</div>
            <div className="candidate-loading-subtitle">
              Preparando el roster completo para el selector y el bracket de 16.
            </div>
            <div className="candidate-loading-base">{getCandidateApiBase()}</div>
            <button className="session-exit-btn candidate-loading-back" onClick={onExit}>
              Volver
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <TournamentSession onExit={onExit} />
}

function EndlessSession({ onExit }) {
  return (
    <OnlineGameProvider>
      <TournamentProvider>
        <div className="game-container">
          <SharedArena sessionType="endless" onExit={onExit} />
        </div>
      </TournamentProvider>
    </OnlineGameProvider>
  )
}

export default function App() {
  const [route, setRoute] = useState('home')
  const [booting, setBooting] = useState(true)
  const isDev = import.meta.env.DEV

  if (booting) return <BootScreen onDone={() => setBooting(false)} />

  if (route === 'endless') {
    return <EndlessSession onExit={() => setRoute('home')} />
  }

  if (route === 'tournament') {
    return <TournamentSessionGate onExit={() => setRoute('home')} />
  }

  if (isDev && route === 'debug-sprite') {
    return <SpriteDebugLab onExit={() => setRoute('home')} />
  }

  return <MainMenu onSelect={setRoute} isDev={isDev} />
}
