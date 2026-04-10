export default function MainMenu({ onSelect }) {
  return (
    <div className="home-shell">
      <div className="home-panel">
        <div className="setup-kicker">Mechas IncaSlop</div>
        <h1 className="home-title">Selecciona el Modo</h1>
        <p className="home-subtitle">
          Endless es la arena online permanente. Tournament te deja elegir un congresista y llevarlo por una llave de 32.
        </p>

        <div className="home-grid">
          <button className="mode-card online" onClick={() => onSelect('endless')}>
            <span className="mode-card-title">ENDLESS</span>
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
        </div>
      </div>
    </div>
  )
}
