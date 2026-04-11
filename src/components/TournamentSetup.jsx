import { useMemo, useState } from 'react'
import { useTournament } from '../context/TournamentContext'
import {
  getCandidateById,
  getCandidateParties,
  getCandidateRegionsByParty,
  getCandidatesByFilters,
} from '../utils/candidateCatalog'

export default function TournamentSetup() {
  const { stage, initTournament } = useTournament()
  const [party, setParty] = useState('')
  const [region, setRegion] = useState('')
  const [candidateId, setCandidateId] = useState('')

  const parties = useMemo(
    () => getCandidateParties({ legislativeOnly: true }),
    [],
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

  const selectedCandidate = candidateId ? getCandidateById(candidateId) : null

  if (stage !== 'setup') return null

  const handlePartyChange = (event) => {
    setParty(event.target.value)
    setRegion('')
    setCandidateId('')
  }

  const handleRegionChange = (event) => {
    setRegion(event.target.value)
    setCandidateId('')
  }

  const handleCandidateChange = (event) => {
    setCandidateId(event.target.value)
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
          <label className="setup-field">
            <span>Partido</span>
            <select value={party} onChange={handlePartyChange}>
              <option value="">Selecciona un partido</option>
              {parties.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="setup-field">
            <span>Region</span>
            <select value={region} onChange={handleRegionChange} disabled={!party}>
              <option value="">Selecciona una region</option>
              {regions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="setup-field">
            <span>Nombre</span>
            <select value={candidateId} onChange={handleCandidateChange} disabled={!party || !region}>
              <option value="">Selecciona un congresista</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
              ))}
            </select>
          </label>
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
