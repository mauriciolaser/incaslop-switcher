import {
  BETTING_DURATION_MS,
  DEFAULT_STAKE,
  INTRO_DURATION_MS,
  RESULT_DURATION_MS,
  TURN_DELAY_MS,
  applyDamage,
  applyEfecto,
  calculateDamage,
  clampStake,
  createFighter,
  determineTurnOrder,
  healSurvivor,
  isStunned,
  pickAtaque,
  refreshIntroDialog,
  tickEfectos,
  trimBattleLog,
} from './battleEngine.js'

function nowIso(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString()
}

function secondsUntil(timestamp) {
  return Math.max(0, Math.ceil((new Date(timestamp).getTime() - Date.now()) / 1000))
}

function createLogEntry(type, text, extra = {}) {
  return { type, text, ...extra }
}

export class OnlineArenaService {
  constructor(store) {
    this.store = store
    this.state = null
    this.timer = null
    this.processing = false
  }

  async init() {
    await this.store.init()
    const persisted = await this.store.loadState()
    this.state = persisted ?? this.createInitialArenaState()
    await this.persistState()
    await this.catchUp()
    this.scheduleNextTick()
  }

  createInitialArenaState() {
    const fighter1 = refreshIntroDialog(createFighter('left'), 'left')
    const fighter2 = refreshIntroDialog(createFighter('right'), 'right')
    return {
      phase: 'intro',
      round: 1,
      fighter1,
      fighter2,
      battleLog: [],
      currentTurn: null,
      winner: null,
      lastResult: null,
      latestEventId: 0,
      turnOrder: determineTurnOrder(fighter1, fighter2),
      turnIndex: 0,
      nextActionAt: nowIso(INTRO_DURATION_MS),
      updatedAt: nowIso(),
    }
  }

  async persistState() {
    this.state.updatedAt = nowIso()
    await this.store.saveState(this.state)
  }

  async appendEvent(type, payload = {}) {
    const event = await this.store.appendEvent({ type, roundNumber: this.state.round, payload })
    this.state.latestEventId = event.id

    if (payload.logEntry) {
      this.state.battleLog = trimBattleLog([...this.state.battleLog, payload.logEntry])
    }

    return event
  }

  buildPublicState() {
    return {
      phase: this.state.phase,
      round: this.state.round,
      fighter1: this.state.fighter1,
      fighter2: this.state.fighter2,
      battleLog: this.state.battleLog,
      currentTurn: this.state.currentTurn,
      winner: this.state.winner,
      lastResult: this.state.lastResult,
      countdown: secondsUntil(this.state.nextActionAt),
      updatedAt: this.state.updatedAt,
    }
  }

  async getStateForUser(userKey) {
    await this.store.ensureUser(userKey)
    const user = await this.store.getUserView(userKey, this.state.round, this.state.phase)
    const effectiveLastResult = user.lastResult ?? (this.state.phase === 'result' && this.state.lastResult
      ? {
          winnerSide: this.state.lastResult.winnerSide,
          betResult: 'none',
          coinDelta: 0,
          stake: 0,
        }
      : null)

    return {
      state: this.buildPublicState(),
      user: {
        ...user,
        lastResult: effectiveLastResult,
        pendingStake: user.currentBet?.stake ?? DEFAULT_STAKE,
      },
      latestEventId: this.state.latestEventId,
      serverTime: nowIso(),
    }
  }

  async getEventsSince(since = 0) {
    const events = await this.store.getEventsSince(since)
    return {
      events,
      latestEventId: events.at(-1)?.id ?? since,
      serverTime: nowIso(),
    }
  }

  async placeBet(userKey, side, stake) {
    if (this.state.phase !== 'betting') {
      throw new Error('Las apuestas no estan abiertas en este momento.')
    }

    await this.store.ensureUser(userKey)
    const user = await this.store.getUserView(userKey, this.state.round, this.state.phase)
    const normalizedStake = clampStake(stake, user.coins)

    if (user.coins < normalizedStake) {
      throw new Error('No tienes suficientes monedas para esa apuesta.')
    }

    await this.store.placeBet(userKey, {
      roundNumber: this.state.round,
      side,
      stake: normalizedStake,
    })

    return this.getStateForUser(userKey)
  }

  scheduleNextTick() {
    if (this.timer) {
      clearTimeout(this.timer)
    }

    const delay = Math.max(250, new Date(this.state.nextActionAt).getTime() - Date.now())
    this.timer = setTimeout(() => {
      void this.catchUp()
    }, delay)
  }

  async catchUp() {
    if (this.processing) return
    this.processing = true

    try {
      while (new Date(this.state.nextActionAt).getTime() <= Date.now()) {
        await this.advanceState()
      }
      await this.persistState()
    } finally {
      this.processing = false
      this.scheduleNextTick()
    }
  }

  async advanceState() {
    if (this.state.phase === 'intro') {
      this.state.phase = 'betting'
      this.state.currentTurn = null
      this.state.nextActionAt = nowIso(BETTING_DURATION_MS)
      this.state.battleLog = []
      await this.appendEvent('betting_open', {
        logEntry: createLogEntry('info', `Ronda ${this.state.round}: las apuestas estan abiertas.`),
      })
      return
    }

    if (this.state.phase === 'betting') {
      this.state.phase = 'fighting'
      this.state.battleLog = []
      this.state.currentTurn = null
      this.state.turnOrder = determineTurnOrder(this.state.fighter1, this.state.fighter2)
      this.state.turnIndex = 0
      this.state.nextActionAt = nowIso(TURN_DELAY_MS)
      await this.appendEvent('battle_started', {
        logEntry: createLogEntry('info', `Comienza la pelea de la ronda ${this.state.round}.`),
      })
      return
    }

    if (this.state.phase === 'fighting') {
      await this.processFightTurn()
      return
    }

    if (this.state.phase === 'result') {
      this.prepareNextRound()
      await this.appendEvent('round_started', {
        logEntry: createLogEntry('info', `La ronda ${this.state.round} ya esta en preparacion.`),
      })
    }
  }

  async processFightTurn() {
    const attackerSide = this.state.turnOrder[this.state.turnIndex % 2]
    let attacker = attackerSide === 'left' ? this.state.fighter1 : this.state.fighter2
    let defender = attackerSide === 'left' ? this.state.fighter2 : this.state.fighter1
    this.state.currentTurn = attackerSide

    const { fighter: tickedAttacker, dotDamage } = tickEfectos(attacker)
    attacker = tickedAttacker
    if (attackerSide === 'left') {
      this.state.fighter1 = attacker
    } else {
      this.state.fighter2 = attacker
    }

    if (dotDamage > 0) {
      const efectoNombre = attacker.efectos[0]?.nombre ?? 'efecto'
      await this.appendEvent('dot', {
        attackerSide,
        logEntry: createLogEntry('dot', `${attacker.name} sufre ${dotDamage} de dano por ${efectoNombre}!`),
      })
      if (!attacker.alive) {
        await this.finishFight(attackerSide === 'left' ? 'right' : 'left')
        return
      }
    }

    if (isStunned(attacker)) {
      const stunEfecto = attacker.efectos.find((efecto) => efecto.pierde_turno)
      await this.appendEvent('stun', {
        attackerSide,
        logEntry: createLogEntry('stun', `${attacker.name} esta ${stunEfecto?.nombre ?? 'aturdido'} y pierde el turno!`),
      })
      this.state.turnIndex += 1
      this.state.nextActionAt = nowIso(TURN_DELAY_MS)
      return
    }

    const ataque = pickAtaque(attacker)
    const { damage, isCrit, isMiss } = calculateDamage(attacker, defender, ataque)

    if (isMiss) {
      await this.appendEvent('miss', {
        attackerSide,
        logEntry: createLogEntry('miss', `${attacker.name} usa ${ataque.nombre} pero falla!`),
      })
      this.state.turnIndex += 1
      this.state.nextActionAt = nowIso(TURN_DELAY_MS)
      return
    }

    let updatedDefender = applyDamage(defender, damage)
    if (ataque.esEspecial && ataque.efecto) {
      updatedDefender = applyEfecto(updatedDefender, ataque.efecto)
    }

    if (attackerSide === 'left') {
      this.state.fighter2 = updatedDefender
    } else {
      this.state.fighter1 = updatedDefender
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

    await this.appendEvent(type, {
      attackerSide,
      defenderSide: defender.side,
      damage,
      attackName: ataque.nombre,
      logEntry: createLogEntry(type, text),
    })

    if (!updatedDefender.alive) {
      await this.finishFight(attackerSide)
      return
    }

    this.state.turnIndex += 1
    this.state.nextActionAt = nowIso(TURN_DELAY_MS)
  }

  async finishFight(winnerSide) {
    const loserSide = winnerSide === 'left' ? 'right' : 'left'
    const winner = winnerSide === 'left' ? this.state.fighter1 : this.state.fighter2
    const loser = loserSide === 'left' ? this.state.fighter1 : this.state.fighter2

    await this.appendEvent('death', {
      winnerSide,
      loserSide,
      logEntry: createLogEntry('death', `${loser.name} ha caido!`),
    })

    this.state.phase = 'result'
    this.state.winner = winnerSide
    this.state.currentTurn = null
    this.state.lastResult = {
      winnerSide,
      loserSide,
    }
    this.state.nextActionAt = nowIso(RESULT_DURATION_MS)

    await this.store.settleRound(this.state.round, winnerSide)
    await this.appendEvent('round_finished', {
      winnerSide,
      logEntry: createLogEntry('info', `${winner.name} gana la ronda ${this.state.round}.`),
    })
  }

  prepareNextRound() {
    const previousWinnerSide = this.state.winner
    const survivor = previousWinnerSide === 'left' ? this.state.fighter1 : this.state.fighter2
    const healedSurvivor = previousWinnerSide ? healSurvivor(survivor) : null
    const nextRound = this.state.round + 1

    this.state = {
      phase: 'intro',
      round: nextRound,
      fighter1: previousWinnerSide === 'left'
        ? refreshIntroDialog(healedSurvivor, 'left')
        : refreshIntroDialog(createFighter('left'), 'left'),
      fighter2: previousWinnerSide === 'right'
        ? refreshIntroDialog(healedSurvivor, 'right')
        : refreshIntroDialog(createFighter('right'), 'right'),
      battleLog: [],
      currentTurn: null,
      winner: null,
      lastResult: null,
      latestEventId: this.state.latestEventId,
      turnOrder: [],
      turnIndex: 0,
      nextActionAt: nowIso(INTRO_DURATION_MS),
      updatedAt: nowIso(),
    }
  }
}

