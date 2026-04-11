import PartyLogoBadge from './PartyLogoBadge'

function WinnerPortrait({ winner }) {
  if (winner?.portraitUrl) {
    return (
      <div className="winner-portrait-wrapper">
        <img className="winner-portrait" src={winner.portraitUrl} alt={winner.name} />
        <PartyLogoBadge partyImage={winner.partyImage} party={winner.party} className="portrait-corner-badge" />
      </div>
    )
  }

  return (
    <div className="winner-portrait-wrapper">
      <div className="winner-portrait winner-portrait-placeholder">?</div>
      <PartyLogoBadge partyImage={winner.partyImage} party={winner.party} className="portrait-corner-badge" />
    </div>
  )
}

export default function WinnerSummary({ winner, label = 'GANA!' }) {
  return (
    <div className="winner-announce">
      <WinnerPortrait winner={winner} />
      <div className="winner-name-row">
        <span className="winner-name">{winner.name}</span>
      </div>
      <span className="winner-label">{label}</span>
    </div>
  )
}
