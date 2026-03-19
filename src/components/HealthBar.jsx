import { useMemo } from 'react'
import { useGame } from '../context/GameContext'
import { calculateWinOdds } from '../utils/odds'

function Bar({ fighter, side, oddsPct }) {
  const pct = Math.max(0, (fighter.hp / fighter.maxHp) * 100)
  const color = pct > 50 ? '#44ff44' : pct > 25 ? '#ffaa00' : '#ff3333'

  return (
    <div className={`health-bar-container ${side}`}>
      <div className="fighter-name">
        {fighter.name}
        <span className="live-odds">{oddsPct}%</span>
      </div>
      <div className="health-bar-bg">
        <div
          className="health-bar-fill"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="health-bar-text">
        {fighter.hp} / {fighter.maxHp} HP
      </div>
      <div className="fighter-stats">
        ATK: {fighter.attack} | DEF: {fighter.defense} | SPD: {fighter.speed}
      </div>
      {fighter.efectos && fighter.efectos.length > 0 && (
        <div className="fighter-efectos">
          {fighter.efectos.map((efecto, i) => (
            <span
              key={i}
              className="efecto-badge"
              style={{ backgroundColor: efecto.color || '#666' }}
            >
              {efecto.nombre} ({efecto.turnosRestantes})
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function HealthBars() {
  const { fighter1, fighter2 } = useGame()
  const odds = useMemo(
    () => calculateWinOdds(fighter1, fighter2, { simulations: 180 }),
    [fighter1, fighter2],
  )

  return (
    <div className="health-bars-overlay">
      <Bar fighter={fighter1} side="left" oddsPct={odds.pct1} />
      <Bar fighter={fighter2} side="right" oddsPct={odds.pct2} />
    </div>
  )
}
