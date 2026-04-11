function WinnerPortrait({ winner }) {
  if (winner?.portraitUrl) {
    return <img className="winner-portrait" src={winner.portraitUrl} alt={winner.name} />
  }

  return <div className="winner-portrait winner-portrait-placeholder">?</div>
}

export default function WinnerSummary({ winner, label = 'GANA!' }) {
  return (
    <div className="winner-announce">
      <WinnerPortrait winner={winner} />
      <span className="winner-name">{winner.name}</span>
      <span className="winner-label">{label}</span>
    </div>
  )
}
