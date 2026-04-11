import { useEffect, useMemo, useRef, useState } from 'react'
import partyCatalog from '../data/parties.json'
import { useTournament } from '../context/TournamentContext'
import {
  getCandidateById,
  getCandidateParties,
  getCandidateRegionsByParty,
  getCandidatesByFilters,
} from '../utils/candidateCatalog'
import { resolvePartyImageUrl } from '../utils/partyResolver'

function ImageThumb({ src, alt, className, fallback }) {
  if (src) {
    return <img className={className} src={src} alt={alt} />
  }

  return <div className={`${className} is-placeholder`}>{fallback}</div>
}

function VisualDropdown({
  label,
  value,
  onSelect,
  options,
  placeholder,
  disabled = false,
  kind,
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const isOpen = open && !disabled
  const selectedOption = options.find((option) => option.value === value) ?? null

  useEffect(() => {
    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [])

  return (
    <div className="setup-field">
      <span>{label}</span>
      <div
        ref={containerRef}
        className={`visual-dropdown ${disabled ? 'disabled' : ''} ${isOpen ? 'open' : ''}`}
      >
        <button
          type="button"
          className="visual-dropdown-trigger"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
        >
          {selectedOption ? (
            <div className="visual-dropdown-value">
              <ImageThumb
                src={selectedOption.image}
                alt={selectedOption.label}
                className={`visual-dropdown-thumb ${kind}`}
                fallback={selectedOption.fallback}
              />
              <span className="visual-dropdown-text">{selectedOption.label}</span>
            </div>
          ) : (
            <span className="visual-dropdown-placeholder">{placeholder}</span>
          )}
          <span className="visual-dropdown-chevron">{isOpen ? '▲' : '▼'}</span>
        </button>

        {isOpen && (
          <div className="visual-dropdown-menu">
            {options.length > 0 ? options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`visual-dropdown-option ${option.value === value ? 'selected' : ''}`}
                onClick={() => {
                  onSelect(option.value)
                  setOpen(false)
                }}
              >
                <ImageThumb
                  src={option.image}
                  alt={option.label}
                  className={`visual-dropdown-thumb ${kind}`}
                  fallback={option.fallback}
                />
                <span className="visual-dropdown-option-text">{option.label}</span>
              </button>
            )) : (
              <div className="visual-dropdown-empty">No hay opciones disponibles.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const partyCatalogMap = new Map(
  partyCatalog
    .filter((party) => party?.name)
    .map((party) => [String(party.name).trim(), party]),
)

function buildPartyOptions(parties) {
  return parties.map((partyName) => {
    const partyData = partyCatalogMap.get(partyName) ?? null
    const partyImage = resolvePartyImageUrl(partyData?.partyImage) ?? null

    return {
      value: partyName,
      label: partyName,
      image: partyImage,
      fallback: 'P',
    }
  })
}

function buildCandidateOption(candidate) {
  const initials = candidate.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()

  return {
    value: candidate.id,
    label: candidate.name,
    image: candidate.portraitUrl,
    fallback: initials || '??',
  }
}

export default function TournamentSetup() {
  const { stage, initTournament } = useTournament()
  const [party, setParty] = useState('')
  const [region, setRegion] = useState('')
  const [candidateId, setCandidateId] = useState('')

  const parties = useMemo(
    () => getCandidateParties({ legislativeOnly: true }),
    [],
  )

  const partyOptions = useMemo(
    () => buildPartyOptions(parties),
    [parties],
  )

  const regions = useMemo(
    () => getCandidateRegionsByParty(party, { legislativeOnly: true }),
    [party],
  )

  const candidates = useMemo(
    () => getCandidatesByFilters({
      legislativeOnly: true,
      party: party || undefined,
      region: region || undefined,
      types: ['diputado', 'senador'],
    }),
    [party, region],
  )

  const candidateOptions = useMemo(
    () => candidates.map(buildCandidateOption),
    [candidates],
  )

  const selectedCandidate = candidateId ? getCandidateById(candidateId) : null

  if (stage !== 'setup') return null

  const handlePartyChange = (value) => {
    setParty(value)
    setRegion('')
    setCandidateId('')
  }

  const handleRegionChange = (event) => {
    setRegion(event.target.value)
    setCandidateId('')
  }

  const handleCandidateChange = (value) => {
    setCandidateId(value)
  }

  const handleStartTournament = () => {
    if (!selectedCandidate) return
    initTournament(selectedCandidate, 32)
  }

  return (
    <div className="modal-overlay">
      <div className="tournament-setup">
        <div className="setup-kicker">Tournament</div>
        <h1 className="setup-title">Elige Tu Congresista</h1>
        <p className="setup-subtitle">
          Selecciona partido, region y nombre para entrar a un bracket de 32 peleadores.
        </p>

        <div className="setup-form">
          <VisualDropdown
            label="Partido"
            value={party}
            onSelect={handlePartyChange}
            options={partyOptions}
            placeholder="Selecciona un partido"
            kind="party"
          />

          <label className="setup-field">
            <span>Region</span>
            <select value={region} onChange={handleRegionChange} disabled={!party}>
              <option value="">Selecciona una region</option>
              {regions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <VisualDropdown
            label="Nombre"
            value={candidateId}
            onSelect={handleCandidateChange}
            options={candidateOptions}
            placeholder="Selecciona un congresista"
            disabled={!party || !region}
            kind="candidate"
          />
        </div>

        <div className="setup-preview">
          {selectedCandidate ? (
            <>
              <div className="setup-preview-portrait-wrap">
                {selectedCandidate.portraitUrl ? (
                  <img
                    className="setup-preview-portrait"
                    src={selectedCandidate.portraitUrl}
                    alt={selectedCandidate.name}
                  />
                ) : (
                  <div className="setup-preview-placeholder">Sin Foto</div>
                )}
                {(selectedCandidate.partyImage || selectedCandidate.party) && (
                  <div className="candidate-party-badge">
                    {selectedCandidate.partyImage && (
                      <img
                        className="candidate-party-badge-image"
                        src={selectedCandidate.partyImage}
                        alt={selectedCandidate.party}
                      />
                    )}
                    {selectedCandidate.party && (
                      <span className="candidate-party-badge-label">{selectedCandidate.party}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="setup-preview-body">
                <h2>{selectedCandidate.name}</h2>
                <p>{selectedCandidate.type} · {selectedCandidate.region}</p>
                <p>{selectedCandidate.party}</p>
              </div>
            </>
          ) : (
            <div className="setup-empty">
              Elige un congresista para preparar el bracket y generar a los 31 rivales.
            </div>
          )}
        </div>

        <button className="next-round-btn" disabled={!selectedCandidate} onClick={handleStartTournament}>
          Iniciar Tournament
        </button>
      </div>
    </div>
  )
}
