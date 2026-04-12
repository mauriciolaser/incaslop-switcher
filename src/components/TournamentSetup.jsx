import { useEffect, useMemo, useRef, useState } from 'react'
import partyCatalog from '../data/parties.json'
import { useTournament } from '../context/TournamentContext'
import {
  getCandidateById,
  getCandidateParties,
  getCandidateRegionsByParty,
  getCandidatesByFilters,
  getLegislativeCandidatePool,
  pickRandomCandidate,
} from '../utils/candidateCatalog'
import { resolvePartyImageUrl } from '../utils/partyResolver'
import PartyLogoBadge from './PartyLogoBadge'

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

function RandomCandidateModal({ candidate, onConfirm, onClose }) {
  const [phase, setPhase] = useState('loading')

  useEffect(() => {
    const timer = setTimeout(() => setPhase('reveal'), 1800)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="modal-overlay random-modal-overlay" onClick={phase === 'reveal' ? onClose : undefined}>
      <div className="random-candidate-modal" onClick={(e) => e.stopPropagation()}>
        {phase === 'loading' ? (
          <div className="random-loading">
            <div className="random-spinner" />
            <p className="random-loading-text">CARGANDO CANDIDATO...</p>
          </div>
        ) : (
          <div className="random-reveal">
            <div className="random-reveal-kicker">Tu Candidato Aleatorio</div>
            <div className="random-reveal-portrait-outer">
              <div className="random-reveal-portrait-wrap">
                {candidate.portraitUrl ? (
                  <img className="random-reveal-portrait" src={candidate.portraitUrl} alt={candidate.name} />
                ) : (
                  <div className="random-reveal-placeholder">Sin Foto</div>
                )}
              </div>
              <PartyLogoBadge
                partyImage={candidate.partyImage}
                party={candidate.party}
                className="portrait-corner-badge"
              />
            </div>
            <h2 className="random-reveal-name">{candidate.name}</h2>
            <p className="random-reveal-meta">{candidate.type} · {candidate.region}</p>
            <div className="random-reveal-stats">
              <div className="random-stat"><span>ATK</span><strong>8–14</strong></div>
              <div className="random-stat"><span>DEF</span><strong>3–7</strong></div>
              <div className="random-stat"><span>VEL</span><strong>1–10</strong></div>
            </div>
            <button className="next-round-btn random-confirm-btn" onClick={onConfirm}>
              Continuar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TournamentSetup() {
  const { stage, initTournament } = useTournament()
  const [party, setParty] = useState('')
  const [region, setRegion] = useState('')
  const [candidateId, setCandidateId] = useState('')
  const [randomCandidate, setRandomCandidate] = useState(null)

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

  const handleRandom = () => {
    const pool = getLegislativeCandidatePool()
    const picked = pickRandomCandidate({ pool })
    setRandomCandidate(picked)
  }

  const handleConfirmRandom = () => {
    if (!randomCandidate) return
    initTournament(randomCandidate, 32)
  }

  return (
    <div className="modal-overlay">
      <div className="tournament-setup">
        <div className="setup-kicker">Tournament</div>
        <h1 className="setup-title">Elige Tu Congresista</h1>
        <p className="setup-subtitle">
          Selecciona partido, region y nombre para entrar al torneo de Mechas.
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
              <option value="">Selecciona una región</option>
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
                <PartyLogoBadge
                  partyImage={selectedCandidate.partyImage}
                  party={selectedCandidate.party}
                  className="portrait-corner-badge"
                />
              </div>
              <div className="setup-preview-body">
                <h2>{selectedCandidate.name}</h2>
                <p>{selectedCandidate.type} · {selectedCandidate.region}</p>
                <PartyLogoBadge
                  partyImage={selectedCandidate.partyImage}
                  party={selectedCandidate.party}
                  className="name-logo-badge"
                />
              </div>
            </>
          ) : (
            <div className="setup-empty">
              Elige tu candidato para entrar al torneo de Mechas.
            </div>
          )}
        </div>

        <div className="setup-actions">
          <button className="random-btn" onClick={handleRandom}>
            ★ Aleatorio
          </button>
          <button className="next-round-btn" disabled={!selectedCandidate} onClick={handleStartTournament}>
            Iniciar Tournament
          </button>
        </div>
      </div>

      {randomCandidate && (
        <RandomCandidateModal
          candidate={randomCandidate}
          onConfirm={handleConfirmRandom}
          onClose={() => setRandomCandidate(null)}
        />
      )}
    </div>
  )
}
