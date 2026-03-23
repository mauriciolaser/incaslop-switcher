import { useTournament } from '../context/TournamentContext'
import { useGame } from '../context/GameContext'

export default function MainMenu() {
  const { mode, setMode, initTournament } = useTournament()
  const { resetGame } = useGame()

  if (mode !== 'menu') return null

  const handleEndless = () => {
    resetGame()
    setMode('endless')
  }

  const handleTorneo = (size) => {
    resetGame()
    initTournament(size)
  }

  return (
    <div className="modal-overlay">
      <div className="main-menu">
        <h1 className="menu-title">Mechas IncaSlop</h1>
        <p className="menu-subtitle">Arena de Combate</p>

        <div className="menu-buttons">
          <button className="menu-btn endless" onClick={handleEndless}>
            <span className="menu-btn-icon">&#9876;</span>
            <span className="menu-btn-label">MODO INFINITO</span>
            <span className="menu-btn-desc">Peleas sin fin, apuesta y sobrevive</span>
          </button>

          <button className="menu-btn torneo short" onClick={() => handleTorneo(8)}>
            <span className="menu-btn-icon">&#9878;</span>
            <span className="menu-btn-label">TORNEO CORTO</span>
            <span className="menu-btn-desc">8 peleadores, bracket rapido</span>
          </button>

          <button className="menu-btn torneo" onClick={() => handleTorneo(16)}>
            <span className="menu-btn-icon">&#9813;</span>
            <span className="menu-btn-label">MODO TORNEO</span>
            <span className="menu-btn-desc">16 peleadores, eliminacion directa</span>
          </button>
        </div>
      </div>
    </div>
  )
}

