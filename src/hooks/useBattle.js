import { useRef, useCallback } from 'react'
import { useGame } from '../context/GameContext'
import {
  calculateDamage, applyDamage, applyEfecto, tickEfectos,
  isStunned, pickAtaque, determineTurnOrder,
} from '../utils/battleEngine'

const TURN_DELAY = 2200

export function useBattle() {
  const {
    fighter1, fighter2,
    addLog, updateFighter, setCurrentTurn, fightEnded, startBattle,
  } = useGame()

  const fightingRef = useRef(false)
  const f1Ref = useRef(fighter1)
  const f2Ref = useRef(fighter2)

  f1Ref.current = fighter1
  f2Ref.current = fighter2

  const runBattle = useCallback(() => {
    if (fightingRef.current) return
    fightingRef.current = true
    startBattle()

    const f1 = f1Ref.current
    const f2 = f2Ref.current
    const turnOrder = determineTurnOrder(f1, f2)

    let localF1 = { ...f1, efectos: [] }
    let localF2 = { ...f2, efectos: [] }
    let turnIndex = 0

    function checkDeath() {
      if (!localF1.alive) {
        fightingRef.current = false
        setTimeout(() => {
          addLog({ type: 'death', text: `${localF1.name} ha caido!`, side: 'left' })
          fightEnded('right', 'left')
        }, 500)
        return true
      }
      if (!localF2.alive) {
        fightingRef.current = false
        setTimeout(() => {
          addLog({ type: 'death', text: `${localF2.name} ha caido!`, side: 'right' })
          fightEnded('left', 'right')
        }, 500)
        return true
      }
      return false
    }

    function executeTurn() {
      if (!fightingRef.current) return

      const attackerSide = turnOrder[turnIndex % 2]
      let attacker = attackerSide === 'left' ? localF1 : localF2
      const defender = attackerSide === 'left' ? localF2 : localF1

      setCurrentTurn(attackerSide)

      // Tick DOT effects on attacker before their turn
      const { fighter: tickedAttacker, dotDamage } = tickEfectos(attacker)
      attacker = tickedAttacker
      if (attackerSide === 'left') { localF1 = attacker } else { localF2 = attacker }
      updateFighter(attacker.side, attacker)

      if (dotDamage > 0) {
        const dotEfectos = attacker.efectos.length > 0 ? attacker.efectos[0].nombre : 'efecto'
        addLog({
          type: 'dot',
          text: `${attacker.name} sufre ${dotDamage} de dano por ${dotEfectos}!`,
          attackerSide: attacker.side,
        })
        if (checkDeath()) return
      }

      // Check if stunned
      if (isStunned(attacker)) {
        const stunEfecto = attacker.efectos.find(e => e.pierde_turno)
        addLog({
          type: 'stun',
          text: `${attacker.name} esta ${stunEfecto.nombre} y pierde el turno!`,
          attackerSide: attacker.side,
        })
        turnIndex++
        setTimeout(executeTurn, TURN_DELAY)
        return
      }

      // Pick an attack
      const ataque = pickAtaque(attacker)
      const { damage, isCrit, isMiss } = calculateDamage(attacker, defender, ataque)

      if (isMiss) {
        const missText = ataque.esEspecial
          ? `${attacker.name} usa ${ataque.nombre} pero falla!`
          : `${attacker.name} usa ${ataque.nombre} pero falla!`
        addLog({
          type: 'miss',
          attacker: attacker.name,
          attackerSide: attacker.side,
          defender: defender.name,
          text: missText,
        })
      } else {
        let updatedDefender = applyDamage(defender, damage)

        // Apply status effect if special attack has one
        if (ataque.esEspecial && ataque.efecto) {
          updatedDefender = applyEfecto(updatedDefender, ataque.efecto)
        }

        if (attackerSide === 'left') { localF2 = updatedDefender } else { localF1 = updatedDefender }
        updateFighter(defender.side, updatedDefender)

        let logType = 'hit'
        let text = `${attacker.name} usa ${ataque.nombre} contra ${defender.name} por ${damage}.`

        if (ataque.esEspecial) {
          logType = 'special'
          text = `${attacker.name} usa ${ataque.nombre} contra ${defender.name} por ${damage}!`
          if (ataque.efecto) {
            text += ` Aplica ${ataque.efecto}!`
          }
        }

        if (isCrit) {
          logType = 'crit'
          text = `CRITICO! ${attacker.name} usa ${ataque.nombre} contra ${defender.name} por ${damage}!`
        }

        addLog({
          type: logType,
          attacker: attacker.name,
          attackerSide: attacker.side,
          defender: defender.name,
          defenderSide: defender.side,
          damage,
          ataque,
          text,
        })

        if (checkDeath()) return
      }

      turnIndex++
      setTimeout(executeTurn, TURN_DELAY)
    }

    setTimeout(executeTurn, 1000)
  }, [startBattle, addLog, updateFighter, setCurrentTurn, fightEnded])

  const stopBattle = useCallback(() => {
    fightingRef.current = false
  }, [])

  return { runBattle, stopBattle }
}
