import { useGame } from '../context/GameContext'
import PartyLogoBadge from './PartyLogoBadge'

function Stat({ label, value }) {
  return (
    <div className="fighter-stat-chip">
      <span className="fighter-stat-label">{label}</span>
      <span className="fighter-stat-value">{value}</span>
    </div>
  )
}

function Bar({ fighter, side }) {
  const pct = Math.max(0, (fighter.hp / fighter.maxHp) * 100)
  const color = pct > 50 ? '#44ff44' : pct > 25 ? '#ffaa00' : '#ff3333'

  return (
    <div className={`health-bar-container ${side}`}>
      <div className="fighter-card-panel">
        <div className="fighter-card-header">
          <div className="fighter-card-title-group">
            <div className="fighter-name">{fighter.name}</div>
            <div className="fighter-role-line">
              <PartyLogoBadge partyImage={fighter.partyImage} party={fighter.party} className="health-party-badge" />
              <span className="fighter-party-name">{fighter.party || 'Sin partido'}</span>
            </div>
          </div>
        </div>

        <div className="fighter-stats-grid">
          <Stat label="Ataque" value={fighter.attack} />
          <Stat label="Defensa" value={fighter.defense} />
          <Stat label="Achoramiento" value={fighter.speed} />
        </div>

        <div className="fighter-status-panel">
          <div className="fighter-status-title">Estados</div>
          {fighter.efectos && fighter.efectos.length > 0 ? (
            <div className="fighter-efectos">
              {fighter.efectos.map((efecto, i) => (
                <span
                  key={i}
                  className="efecto-badge"
                  style={{ backgroundColor: efecto.color || '#666' }}
                >
                  <span className="efecto-badge-name">{efecto.nombre}</span>
                  <span className="efecto-badge-turns">{efecto.turnosRestantes}T</span>
                </span>
              ))}
            </div>
          ) : (
            <div className="fighter-status-empty">Sin alteraciones activas</div>
          )}
        </div>
      </div>

      <div className="health-bar-bg">
        <div
          className="health-bar-fill"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="health-bar-text">
        {fighter.hp} / {fighter.maxHp} VIDA
      </div>
    </div>
  )
}

export default function HealthBars() {
  const { fighter1, fighter2 } = useGame()

  return (
    <div className="health-bars-overlay">
      <Bar fighter={fighter1} side="left" />
      <Bar fighter={fighter2} side="right" />
    </div>
  )
}
