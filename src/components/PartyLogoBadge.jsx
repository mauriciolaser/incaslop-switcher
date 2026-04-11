export default function PartyLogoBadge({ partyImage, party, className = '' }) {
  if (!partyImage && !party) return null

  return (
    <div className={`party-logo-badge ${className}`.trim()} title={party || 'Partido'}>
      {partyImage ? (
        <img className="party-logo-badge-image" src={partyImage} alt={party || 'Partido'} />
      ) : (
        <div className="party-logo-badge-fallback">P</div>
      )}
    </div>
  )
}
