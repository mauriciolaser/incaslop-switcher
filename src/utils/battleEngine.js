import ataques from '../data/ataques.json'

const FIGHTER_NAMES = [
  'Guerrero Inca', 'Jaguar Negro', 'Condor de Fuego', 'Serpiente Dorada',
  'Puma Sagrado', 'Halcon Andino', 'Lobo de Plata', 'Toro Bravo',
  'Dragon Rojo', 'Fenix Oscuro', 'Titan de Piedra', 'Sombra Veloz'
]

export function generateFighter(side) {
  const name = FIGHTER_NAMES[Math.floor(Math.random() * FIGHTER_NAMES.length)]
  return {
    id: Date.now() + Math.random(),
    name,
    side,
    maxHp: 100,
    hp: 100,
    attack: 15 + Math.floor(Math.random() * 11),
    defense: 5 + Math.floor(Math.random() * 6),
    speed: 1 + Math.floor(Math.random() * 10),
    alive: true,
    efectos: [],
  }
}

export function pickAtaque(attacker) {
  // Try to trigger a special attack
  for (const especial of ataques.especiales) {
    if (Math.random() < especial.probabilidad) {
      return { ...especial, esEspecial: true }
    }
  }
  // Fallback to a random basic attack
  const basico = ataques.basicos[Math.floor(Math.random() * ataques.basicos.length)]
  return { ...basico, esEspecial: false }
}

export function calculateDamage(attacker, defender, ataque) {
  // Check precision (miss)
  let precisionMod = ataque.precision
  const cegueraEfecto = attacker.efectos.find(e => e.id === 'ceguera')
  if (cegueraEfecto) {
    precisionMod *= ataques.efectos.ceguera.reduccion_precision
  }

  if (Math.random() > precisionMod) {
    return { damage: 0, isCrit: false, isMiss: true, ataque }
  }

  const isCrit = Math.random() < 0.15

  // Base damage scaled by attack power and ataque power multiplier
  let attackStat = attacker.attack
  const miedoEfecto = attacker.efectos.find(e => e.id === 'miedo')
  if (miedoEfecto) {
    attackStat = Math.floor(attackStat * ataques.efectos.miedo.reduccion_ataque)
  }

  const baseDamage = attackStat * (0.8 + Math.random() * 0.4) * ataque.poder

  let defenseStat = defender.defense
  const congeladoEfecto = defender.efectos.find(e => e.id === 'congelamiento')
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

  // Don't stack same effect, just refresh duration
  const existing = fighter.efectos.findIndex(e => e.id === efectoId)
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
  return fighter.efectos.some(e => e.pierde_turno)
}

export function healSurvivor(fighter) {
  const healAmount = Math.floor(fighter.maxHp * 0.2)
  const newHp = Math.min(fighter.maxHp, fighter.hp + healAmount)
  return { ...fighter, hp: newHp, efectos: [] }
}

export function generateStake() {
  return 10 + Math.floor(Math.random() * 91)
}

export function determineTurnOrder(fighter1, fighter2) {
  if (fighter1.speed >= fighter2.speed) {
    return [fighter1.side, fighter2.side]
  }
  return [fighter2.side, fighter1.side]
}
