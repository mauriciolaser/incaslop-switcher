import {
  applyDamage,
  applyEfecto,
  calculateDamage,
  determineTurnOrder,
  isStunned,
  pickAtaque,
  tickEfectos,
} from './battleEngine'

function cloneFighter(fighter) {
  return {
    ...fighter,
    efectos: (fighter.efectos ?? []).map((efecto) => ({ ...efecto })),
  }
}

export function simulateFight(fighter1, fighter2) {
  let localF1 = cloneFighter(fighter1)
  let localF2 = cloneFighter(fighter2)
  const battleLog = []
  const turnOrder = determineTurnOrder(localF1, localF2)
  let turnIndex = 0

  function pushLog(type, text, extra = {}) {
    battleLog.push({ type, text, ...extra })
  }

  while (localF1.alive && localF2.alive && turnIndex < 200) {
    const attackerSide = turnOrder[turnIndex % 2]
    let attacker = attackerSide === 'left' ? localF1 : localF2
    let defender = attackerSide === 'left' ? localF2 : localF1

    const { fighter: tickedAttacker, dotDamage } = tickEfectos(attacker)
    attacker = tickedAttacker

    if (attackerSide === 'left') {
      localF1 = attacker
    } else {
      localF2 = attacker
    }

    if (dotDamage > 0) {
      const efectoNombre = attacker.efectos[0]?.nombre ?? 'efecto'
      pushLog('dot', `${attacker.name} sufre ${dotDamage} de dano por ${efectoNombre}!`)
      if (!attacker.alive) {
        break
      }
    }

    if (isStunned(attacker)) {
      const stunEfecto = attacker.efectos.find((efecto) => efecto.pierde_turno)
      pushLog('stun', `${attacker.name} esta ${stunEfecto?.nombre ?? 'aturdido'} y pierde el turno!`)
      turnIndex += 1
      continue
    }

    const ataque = pickAtaque(attacker)
    const { damage, isCrit, isMiss } = calculateDamage(attacker, defender, ataque)

    if (isMiss) {
      pushLog('miss', `${attacker.name} usa ${ataque.nombre} pero falla!`)
      turnIndex += 1
      continue
    }

    let updatedDefender = applyDamage(defender, damage)
    if (ataque.esEspecial && ataque.efecto) {
      updatedDefender = applyEfecto(updatedDefender, ataque.efecto)
    }

    if (attackerSide === 'left') {
      localF2 = updatedDefender
    } else {
      localF1 = updatedDefender
    }

    let type = 'hit'
    let text = `${attacker.name} usa ${ataque.nombre} contra ${defender.name} por ${damage}.`
    if (ataque.esEspecial) {
      type = 'special'
      text = `${attacker.name} usa ${ataque.nombre} contra ${defender.name} por ${damage}!`
      if (ataque.efecto) {
        text += ` Aplica ${ataque.efecto}!`
      }
    }
    if (isCrit) {
      type = 'crit'
      text = `CRITICO! ${attacker.name} usa ${ataque.nombre} contra ${defender.name} por ${damage}!`
    }

    pushLog(type, text)
    turnIndex += 1
  }

  const winnerSide = localF1.alive ? 'left' : 'right'
  const loserSide = winnerSide === 'left' ? 'right' : 'left'
  const winner = winnerSide === 'left' ? localF1 : localF2
  const loser = loserSide === 'left' ? localF1 : localF2

  pushLog('death', `${loser.name} ha caido!`)

  return {
    winnerSide,
    loserSide,
    winnerFighter: winner,
    loserFighter: loser,
    fighter1: localF1,
    fighter2: localF2,
    battleLog,
  }
}
