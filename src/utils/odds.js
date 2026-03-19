import {
  applyDamage,
  applyEfecto,
  calculateDamage,
  determineTurnOrder,
  isStunned,
  pickAtaque,
  tickEfectos,
} from './battleEngine'

function cloneFighter(fighter, side) {
  return {
    ...fighter,
    side,
    alive: fighter.alive ?? fighter.hp > 0,
    efectos: (fighter.efectos ?? []).map(efecto => ({ ...efecto })),
  }
}

function simulateFight(fighter1, fighter2, maxTurns = 200) {
  let left = cloneFighter(fighter1, 'left')
  let right = cloneFighter(fighter2, 'right')
  const turnOrder = determineTurnOrder(left, right)
  let turnIndex = 0

  while (turnIndex < maxTurns && left.alive && right.alive) {
    const attackerSide = turnOrder[turnIndex % 2]
    let attacker = attackerSide === 'left' ? left : right
    let defender = attackerSide === 'left' ? right : left

    const { fighter: tickedAttacker } = tickEfectos(attacker)
    attacker = tickedAttacker

    if (attackerSide === 'left') {
      left = attacker
    } else {
      right = attacker
    }

    if (!attacker.alive) {
      return attackerSide === 'left' ? 'right' : 'left'
    }

    if (isStunned(attacker)) {
      turnIndex++
      continue
    }

    const ataque = pickAtaque(attacker)
    const { damage, isMiss } = calculateDamage(attacker, defender, ataque)

    if (!isMiss) {
      defender = applyDamage(defender, damage)

      if (ataque.esEspecial && ataque.efecto) {
        defender = applyEfecto(defender, ataque.efecto)
      }

      if (attackerSide === 'left') {
        right = defender
      } else {
        left = defender
      }

      if (!defender.alive) {
        return attackerSide
      }
    }

    turnIndex++
  }

  if (left.hp === right.hp) {
    return left.speed >= right.speed ? 'left' : 'right'
  }

  return left.hp > right.hp ? 'left' : 'right'
}

export function calculateWinOdds(fighter1, fighter2, options = {}) {
  const simulations = options.simulations ?? 240
  let leftWins = 0

  for (let i = 0; i < simulations; i++) {
    if (simulateFight(fighter1, fighter2) === 'left') {
      leftWins++
    }
  }

  const smoothedLeft = (leftWins + 1) / (simulations + 2)
  const pct1 = Math.round(smoothedLeft * 100)
  const pct2 = 100 - pct1

  return {
    pct1,
    pct2,
    favorite: pct1 >= pct2 ? 'left' : 'right',
  }
}
