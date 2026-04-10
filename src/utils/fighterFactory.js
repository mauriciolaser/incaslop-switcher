import { getCandidatePoolOrThrow, pickRandomCandidate } from './candidateCatalog'

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

function buildCandidateProfile(candidate) {
  return {
    id: String(candidate.id),
    name: candidate.name,
    portraitUrl: candidate.portraitUrl ?? candidate.imageUrl ?? null,
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
    id: overrides.id ?? Date.now() + Math.random(),
    personajeId: String(personaje.id),
    name: personaje.name,
    portraitUrl: personaje.portraitUrl ?? null,
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
    introDialog: overrides.introDialog ?? pickRandomDialog(personaje.dialogos),
  }
}

export function generateRandomRosterFighter(side) {
  const candidate = pickRandomCandidate()
  const personaje = buildCandidateProfile(candidate)
  return instantiateRosterFighter(personaje, { side })
}

export function createTournamentRoster(count = 16) {
  const pool = getCandidatePoolOrThrow()
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, Math.min(count, shuffled.length))

  while (selected.length < count) {
    selected.push(pool[Math.floor(Math.random() * pool.length)])
  }

  return selected
    .map(candidate => buildCandidateProfile(candidate))
    .map(personaje => instantiateRosterFighter(personaje))
}

export function prepareFighterForMatch(fighter, side = fighter.side) {
  return {
    ...fighter,
    side,
    alive: fighter.alive ?? fighter.hp > 0,
    efectos: fighter.efectos ?? [],
    introDialog: pickRandomDialog(fighter.dialogos),
  }
}
