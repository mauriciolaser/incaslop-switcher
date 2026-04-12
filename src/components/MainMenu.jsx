export default function MainMenu({ onSelect, isDev = false }) {
  return (
    <div className="home-shell">
      <div className="home-panel">
        <div className="home-kicker">Mechas IncaSlop</div>
        <h1 className="home-title">Selecciona el Modo</h1>

        <div className="home-grid">
          <button className="mode-card online" onClick={() => onSelect('endless')}>
            <span className="mode-card-title">
              ENDLESS
              <span className="mode-card-live-badge">EN VIVO</span>
            </span>
            <span className="mode-card-desc">
              Apuesta en la arena permanente, mira a los jugadores conectados y sobrevive todo lo posible.
            </span>
          </button>

          <button className="mode-card local" onClick={() => onSelect('tournament')}>
            <span className="mode-card-title">TOURNAMENT</span>
            <span className="mode-card-desc">
              Elige un congresista, entra al bracket de 32 y decide si ver o skipear las peleas ajenas.
            </span>
          </button>

          {isDev && (
            <button className="mode-card debug" onClick={() => onSelect('debug-sprite')}>
              <span className="mode-card-title">SPRITE DEBUG</span>
              <span className="mode-card-desc">
                Laboratorio local para el spritesheet: cambia el candidato, el frame y el tamaño en tiempo real.
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
