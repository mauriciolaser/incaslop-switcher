import crypto from 'node:crypto'
import { ataques, personajes } from './gameData.js'

export const INITIAL_COINS = 500
export const DEFAULT_STAKE = 10
export const STAKE_OPTIONS = [5, 10, 20, 100]
export const INTRO_DURATION_MS = 5000
export const BETTING_DURATION_MS = 15000
export const TURN_DELAY_MS = 1800
export const RESULT_DURATION_MS = 7000
export const MAX_LOG_ENTRIES = 60

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function pickRandomDialog(dialogos = []) {
  if (!dialogos.length) return 'Hoy alguien cae en la arena.'
  return dialogos[Math.floor(Math.random() * dialogos.length)]
}

export function createUserKey() {
  return crypto.randomBytes(24).toString('hex')
}

export function createFighter(side, overrides = {}) {
  const personaje = personajes[Math.floor(Math.random() * personajes.length)]
  const maxHp = overrides.maxHp ?? 100
  const hp = Math.min(overrides.hp ?? maxHp, maxHp)

  return {
    id: overrides.id ?? `${Date.now()}-${Math.random()}`,
    personajeId: personaje.id,
    side,
    name: personaje.name,
    maxHp,
    hp,
    attack: overrides.attack ?? randomInt(personaje.attackRange[0], personaje.attackRange[1]),
    defense: overrides.defense ?? randomInt(personaje.defenseRange[0], personaje.defenseRange[1]),
    speed: overrides.speed ?? randomInt(personaje.speedRange[0], personaje.speedRange[1]),
    alive: overrides.alive ?? hp > 0,
    efectos: overrides.efectos ?? [],
    bio: personaje.bio,
    dialogos: personaje.dialogos,
    introDialog: overrides.introDialog ?? pickRandomDialog(personaje.dialogos),
  }
}

export function refreshIntroDialog(fighter, side = fighter.side) {
  const personaje = personajes.find((item) => item.id === fighter.personajeId)
  return {
    ...fighter,
    side,
    introDialog: pickRandomDialog(personaje?.dialogos ?? fighter.dialogos),
    alive: fighter.alive ?? fighter.hp > 0,
    efectos: (fighter.efectos ?? []).map((efecto) => ({ ...efecto })),
  }
}

export function pickAtaque(attacker) {
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
