import {
  getLegislativeCandidatePool,
  pickRandomCandidate,
  pickUniqueCandidates,
} from './candidateCatalog'
import { resolvePortraitUrl } from './portraitResolver'

const BALANCED_ATTACK_RANGE = [15, 25]
const BALANCED_DEFENSE_RANGE = [4, 10]
const BALANCED_SPEED_RANGE = [1, 10]

function randomInRange(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

export function pickRandomDialog(dialogos = []) {
  if (!dialogos.length) return 'Hoy alguien cae en la arena.'
  return dialogos[Math.floor(Math.random() * dialogos.length)]
}

function buildCandidateBio(candidate) {
  const role = candidate.type || 'Candidato'
  const region = candidate.region || 'region desconocida'
  const party = candidate.party || 'sin partido'
  return `${role} de ${region}, afiliado a ${party}. Entra a la arena listo para demostrar reflejos y temple.`
}

function buildCandidateDialogs(candidate) {
  const firstName = candidate.name.split(' ')[0] || candidate.name
  return [
    `Soy ${firstName}. Hoy no retrocedo.`,
    'No vine a mirar. Vine a ganar esta ronda.',
    'Cada golpe cuenta. Esta arena es mia.',
  ]
}

export function buildCandidateProfile(candidate) {
  const rawPortrait = candidate.portraitUrl ?? candidate.imageUrl ?? null
  const portraitUrl = resolvePortraitUrl(rawPortrait) ?? rawPortrait
  return {
    id: String(candidate.id),
    candidateId: String(candidate.id),
    name: candidate.name,
    portraitUrl,
    party: candidate.party ?? '',
    region: candidate.region ?? '',
    type: candidate.type ?? '',
    typeKey: candidate.typeKey ?? '',
    partyId: candidate.partyId ?? null,
    attackRange: BALANCED_ATTACK_RANGE,
    defenseRange: BALANCED_DEFENSE_RANGE,
    speedRange: BALANCED_SPEED_RANGE,
    bio: buildCandidateBio(candidate),
    dialogos: buildCandidateDialogs(candidate),
  }
}

export function instantiateRosterFighter(personaje, overrides = {}) {
  const maxHp = overrides.maxHp ?? 100
  const hp = Math.min(overrides.hp ?? maxHp, maxHp)

  return {
    id: overrides.id ?? `${personaje.id}-${Math.random().toString(36).slice(2, 10)}`,
    personajeId: String(personaje.id),
    candidateId: String(personaje.candidateId ?? personaje.id),
    name: personaje.name,
    portraitUrl: personaje.portraitUrl ?? null,
    party: personaje.party ?? '',
    region: personaje.region ?? '',
    type: personaje.type ?? '',
    typeKey: personaje.typeKey ?? '',
    partyId: personaje.partyId ?? null,
    side: overrides.side ?? null,
    maxHp,
    hp,
    attack: overrides.attack ?? randomInRange(personaje.attackRange[0], personaje.attackRange[1]),
    defense: overrides.defense ?? randomInRange(personaje.defenseRange[0], personaje.defenseRange[1]),
    speed: overrides.speed ?? randomInRange(personaje.speedRange[0], personaje.speedRange[1]),
    alive: overrides.alive ?? hp > 0,
    efectos: overrides.efectos ?? [],
    bio: personaje.bio,
    dialogos: personaje.dialogos,
    isPlayer: overrides.isPlayer ?? false,
    introDialog: overrides.introDialog ?? pickRandomDialog(personaje.dialogos),
  }
}

export function createFighterFromCandidate(candidate, overrides = {}) {
  return instantiateRosterFighter(buildCandidateProfile(candidate), overrides)
}

export function generateRandomRosterFighter(side) {
  const candidate = pickRandomCandidate()
  return createFighterFromCandidate(candidate, { side })
}

export function createTournamentRoster(selectedCandidate, count = 32) {
  const pool = getLegislativeCandidatePool()
  const selected = createFighterFromCandidate(selectedCandidate, {
    isPlayer: true,
  })
  const rivals = pickUniqueCandidates(count - 1, {
    pool,
    excludeIds: [selectedCandidate.id],
  }).map((candidate) => createFighterFromCandidate(candidate))

  const roster = [selected, ...rivals]
  return roster.sort(() => Math.random() - 0.5)
}

export function prepareFighterForMatch(fighter, side = fighter.side) {
  return {
    ...fighter,
    side,
    alive: fighter.alive ?? fighter.hp > 0,
    efectos: (fighter.efectos ?? []).map((efecto) => ({ ...efecto })),
    introDialog: pickRandomDialog(fighter.dialogos),
  }
}
