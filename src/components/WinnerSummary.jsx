import PartyLogoBadge from './PartyLogoBadge'

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
      <div className="winner-name-row">
        <PartyLogoBadge partyImage={winner.partyImage} party={winner.party} />
        <span className="winner-name">{winner.name}</span>
      </div>
      <span className="winner-label">{label}</span>
    </div>
  )
}
