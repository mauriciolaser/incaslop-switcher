import personajes from '../data/personajes.json'

function randomInRange(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

export function pickRandomDialog(dialogos = []) {
  if (!dialogos.length) return 'Hoy alguien cae en la arena.'
  return dialogos[Math.floor(Math.random() * dialogos.length)]
}

export function instantiateRosterFighter(personaje, overrides = {}) {
  const maxHp = overrides.maxHp ?? 100
  const hp = Math.min(overrides.hp ?? maxHp, maxHp)

  return {
    id: overrides.id ?? Date.now() + Math.random(),
    personajeId: personaje.id,
    name: personaje.name,
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
  const personaje = personajes[Math.floor(Math.random() * personajes.length)]
  return instantiateRosterFighter(personaje, { side })
}

export function createTournamentRoster(count = 16) {
  const shuffled = [...personajes].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count).map(personaje => instantiateRosterFighter(personaje))
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
