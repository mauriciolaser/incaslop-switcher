import crypto from 'node:crypto'
import { ataques } from './gameData.js'

export const INITIAL_COINS = 10
export const DEFAULT_STAKE = 10
export const STAKE_OPTIONS = [5, 10, 20, 100]
export const INTRO_DURATION_MS = 5000
export const BETTING_DURATION_MS = 15000
export const TURN_DELAY_MS = 1800
export const RESULT_DURATION_MS = 7000
export const MAX_LOG_ENTRIES = 60
const BALANCED_ATTACK_RANGE = [15, 25]
const BALANCED_DEFENSE_RANGE = [4, 10]
const BALANCED_SPEED_RANGE = [1, 10]

let candidatePool = []

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function pickRandomDialog(dialogos = []) {
  if (!dialogos.length) return 'Hoy alguien cae en la arena.'
  return dialogos[Math.floor(Math.random() * dialogos.length)]
}

function randomInRange([min, max]) {
  return randomInt(min, max)
}

function getRandomCandidate() {
  if (candidatePool.length < 2) {
    throw new Error('Candidate pool no disponible en servidor.')
  }
  return candidatePool[Math.floor(Math.random() * candidatePool.length)]
}

function buildCandidateBio(candidate) {
  const role = candidate.type || 'Candidato'
  const region = candidate.region || 'region desconocida'
  const party = candidate.party || 'sin partido'
  return `${role} de ${region}, afiliado a ${party}. Entra a la arena con estrategia y resistencia.`
}

function buildCandidateDialogs(candidate) {
  const firstName = candidate.name.split(' ')[0] || candidate.name
  return [
    `Soy ${firstName}. Esta ronda es mia.`,
    'No subestimes mi ritmo en la arena.',
    'Cada turno es una oportunidad para ganar.',
  ]
}

export function setCandidatePool(candidates) {
  if (!Array.isArray(candidates)) {
    candidatePool = []
    return
  }
  candidatePool = candidates.filter((candidate) => candidate?.id && candidate?.name)
}

export function createUserKey() {
  return crypto.randomBytes(24).toString('hex')
}

export function createFighter(side, overrides = {}) {
  const candidate = getRandomCandidate()
  const dialogos = buildCandidateDialogs(candidate)
  const maxHp = overrides.maxHp ?? 100
  const hp = Math.min(overrides.hp ?? maxHp, maxHp)

  return {
    id: overrides.id ?? `${Date.now()}-${Math.random()}`,
    personajeId: String(candidate.id),
    side,
    name: candidate.name,
    portraitUrl: candidate.portraitUrl ?? null,
    party: candidate.party ?? '',
    partyImage: candidate.partyImage ?? null,
    region: candidate.region ?? '',
    type: candidate.type ?? '',
    typeKey: candidate.typeKey ?? '',
    partyId: candidate.partyId ?? null,
    maxHp,
    hp,
    attack: overrides.attack ?? randomInRange(BALANCED_ATTACK_RANGE),
    defense: overrides.defense ?? randomInRange(BALANCED_DEFENSE_RANGE),
    speed: overrides.speed ?? randomInRange(BALANCED_SPEED_RANGE),
    alive: overrides.alive ?? hp > 0,
    efectos: overrides.efectos ?? [],
    bio: buildCandidateBio(candidate),
    dialogos,
    introDialog: overrides.introDialog ?? pickRandomDialog(dialogos),
  }
}

export function refreshIntroDialog(fighter, side = fighter.side) {
  const dialogs = Array.isArray(fighter.dialogos) ? fighter.dialogos : []
  return {
    ...fighter,
    side,
    introDialog: pickRandomDialog(dialogs),
    alive: fighter.alive ?? fighter.hp > 0,
    efectos: (fighter.efectos ?? []).map((efecto) => ({ ...efecto })),
  }
}

export function pickAtaque() {
  for (const especial of ataques.especiales) {
    if (Math.random() < especial.probabilidad) {
      return { ...especial, esEspecial: true }
    }
  }

  const basico = ataques.basicos[Math.floor(Math.random() * ataques.basicos.length)]
  return { ...basico, esEspecial: false }
}

export function calculateDamage(attacker, defender, ataque) {
  let precisionMod = ataque.precision
  const cegueraEfecto = attacker.efectos.find((e) => e.id === 'ceguera')
  if (cegueraEfecto) {
    precisionMod *= ataques.efectos.ceguera.reduccion_precision
  }

  if (Math.random() > precisionMod) {
    return { damage: 0, isCrit: false, isMiss: true, ataque }
  }

  const isCrit = Math.random() < 0.15

  let attackStat = attacker.attack
  const miedoEfecto = attacker.efectos.find((e) => e.id === 'miedo')
  if (miedoEfecto) {
    attackStat = Math.floor(attackStat * ataques.efectos.miedo.reduccion_ataque)
  }

  const baseDamage = attackStat * (0.8 + Math.random() * 0.4) * ataque.poder

  let defenseStat = defender.defense
  const congeladoEfecto = defender.efectos.find((e) => e.id === 'congelamiento')
  if (congeladoEfecto) {
    defenseStat = Math.floor(defenseStat * ataques.efectos.congelamiento.reduccion_defensa)
  }

  const reduction = defenseStat * (0.3 + Math.random() * 0.3)
  let damage = Math.max(1, Math.floor(baseDamage - reduction))

  if (isCrit) {
    damage = Math.floor(damage * 2)
  }

  return { damage, isCrit, isMiss: false, ataque }
}

export function applyDamage(fighter, damage) {
  const newHp = Math.max(0, fighter.hp - damage)
  return {
    ...fighter,
    hp: newHp,
    alive: newHp > 0,
  }
}

export function applyEfecto(fighter, efectoId) {
  if (!efectoId) return fighter
  const efectoData = ataques.efectos[efectoId]
  if (!efectoData) return fighter

  const existing = fighter.efectos.findIndex((e) => e.id === efectoId)
  const newEfecto = { id: efectoId, ...efectoData, turnosRestantes: efectoData.duracion }
  const efectos = [...fighter.efectos]

  if (existing >= 0) {
    efectos[existing] = newEfecto
  } else {
    efectos.push(newEfecto)
  }

  return { ...fighter, efectos }
}

export function tickEfectos(fighter) {
  let totalDot = 0
  const efectosActualizados = []

  for (const efecto of fighter.efectos) {
    if (efecto.dano_por_turno) {
      totalDot += efecto.dano_por_turno
    }
    const remaining = efecto.turnosRestantes - 1
    if (remaining > 0) {
      efectosActualizados.push({ ...efecto, turnosRestantes: remaining })
    }
  }

  let newHp = fighter.hp
  if (totalDot > 0) {
    newHp = Math.max(0, fighter.hp - totalDot)
  }

  return {
    fighter: { ...fighter, hp: newHp, alive: newHp > 0, efectos: efectosActualizados },
    dotDamage: totalDot,
  }
}

export function isStunned(fighter) {
  return fighter.efectos.some((e) => e.pierde_turno)
}

export function healSurvivor(fighter) {
  const healAmount = Math.floor(fighter.maxHp * 0.2)
  const newHp = Math.min(fighter.maxHp, fighter.hp + healAmount)
  return { ...fighter, hp: newHp, efectos: [], alive: true }
}

export function determineTurnOrder(fighter1, fighter2) {
  if (fighter1.speed >= fighter2.speed) {
    return [fighter1.side, fighter2.side]
  }
  return [fighter2.side, fighter1.side]
}

export function clampStake(stake, coins) {
  if (coins >= stake) return stake
  const affordable = [...STAKE_OPTIONS].reverse().find((option) => option <= coins)
  return affordable ?? STAKE_OPTIONS[0]
}

export function trimBattleLog(entries = []) {
  return entries.slice(-MAX_LOG_ENTRIES)
}
