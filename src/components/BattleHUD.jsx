import { useGame } from '../context/GameContext'

export default function BattleHUD() {
  const { round, coins, phase } = useGame()

  return (
    <div className="battle-hud">
      <div className="hud-item">
        <span className="hud-label">Ronda</span>
        <span className="hud-value">{round}</span>
      </div>
      <div className="hud-item">
        <span className="hud-label">Monedas</span>
        <span className="hud-value coins">{coins}</span>
      </div>
      <div className="hud-item">
        <span className="hud-label">Estado</span>
        <span className="hud-value phase">
          {phase === 'betting' ? 'Apuestas' : phase === 'fighting' ? 'Luchando' : 'Resultado'}
        </span>
      </div>
    </div>
  )
}
