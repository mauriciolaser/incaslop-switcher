import { DEFAULT_STAKE, INITIAL_COINS } from '../battleEngine.js'

function nowIso() {
  return new Date().toISOString()
}

function createGuestLabel(guestNumber) {
  return `guest${guestNumber}`
}

export class MemoryStore {
  constructor() {
    this.state = null
    this.events = []
    this.players = new Map()
    this.bets = []
    this.nextGuestNumber = 1
    this.nextEventId = 1
    this.nextBetId = 1
  }

  async init() {}

  async loadState() {
    return this.state
  }

  async saveState(state) {
    this.state = structuredClone(state)
  }

  async appendEvent(event) {
    const nextEvent = {
      id: this.nextEventId++,
      type: event.type,
      roundNumber: event.roundNumber,
      payload: event.payload ?? {},
      createdAt: nowIso(),
    }
    this.events.push(nextEvent)
    return nextEvent
  }

  async getEventsSince(since = 0) {
    return this.events.filter((event) => event.id > since)
  }

  async ensureUser(userKey) {
    const existing = this.players.get(userKey)
    const timestamp = nowIso()

    if (!existing || existing.status !== 'active') {
      const player = {
        user_key: userKey,
        guest_number: this.nextGuestNumber++,
        coins: INITIAL_COINS,
        status: 'active',
        created_at: timestamp,
        updated_at: timestamp,
        last_seen_at: timestamp,
      }
      this.players.set(userKey, player)
      this.bets = this.bets.filter((bet) => bet.user_key !== userKey)
      return player
    }

    existing.updated_at = timestamp
    existing.last_seen_at = timestamp
    return existing
  }

  async touchUser(userKey) {
    const player = this.players.get(userKey)
    if (!player) return
    player.updated_at = nowIso()
    player.last_seen_at = player.updated_at
  }

  async getPlayer(userKey) {
    return this.players.get(userKey) ?? null
  }

  async listActivePlayers() {
    return [...this.players.values()]
      .filter((player) => player.status === 'active')
      .sort((left, right) => left.guest_number - right.guest_number)
      .map((player) => ({
        userKey: player.user_key,
        guestNumber: player.guest_number,
        label: createGuestLabel(player.guest_number),
        coins: player.coins,
        status: player.status,
      }))
  }

  async placeBet(userKey, bet) {
    const idx = this.bets.findIndex((item) => item.user_key === userKey && item.round_number === bet.roundNumber)
    const nextBet = {
      id: idx >= 0 ? this.bets[idx].id : this.nextBetId++,
      user_key: userKey,
      round_number: bet.roundNumber,
      side: bet.side,
      stake: bet.stake,
      status: 'pending',
      coin_delta: 0,
      created_at: idx >= 0 ? this.bets[idx].created_at : nowIso(),
      updated_at: nowIso(),
    }

    if (idx >= 0) {
      this.bets[idx] = nextBet
    } else {
      this.bets.push(nextBet)
    }
  }

  async settleRound(roundNumber, winnerSide) {
    for (const bet of this.bets) {
      if (bet.round_number !== roundNumber || bet.status !== 'pending') continue
      const didWin = bet.side === winnerSide
      const player = this.players.get(bet.user_key)
      if (!player) continue

      bet.status = didWin ? 'win' : 'lose'
      bet.coin_delta = didWin ? bet.stake : -bet.stake
      bet.updated_at = nowIso()
      player.coins = Math.max(0, player.coins + bet.coin_delta)
      player.updated_at = nowIso()
      if (player.coins <= 0) {
        player.status = 'eliminated'
      }
    }
  }

  async getUserView(userKey, currentRound, currentPhase) {
    const player = this.players.get(userKey) ?? null
    const currentBet = this.bets.find((bet) => bet.user_key === userKey && bet.round_number === currentRound) ?? null

    return {
      userKey,
      guestNumber: player?.guest_number ?? null,
      guestLabel: player ? createGuestLabel(player.guest_number) : null,
      coins: player?.coins ?? INITIAL_COINS,
      status: player?.status ?? 'active',
      gameOver: player?.status === 'eliminated',
      currentBet: currentBet ? { side: currentBet.side, stake: currentBet.stake, roundNumber: currentBet.round_number } : null,
      lastResult: currentPhase === 'result' && currentBet && currentBet.status !== 'pending'
        ? {
            winnerSide: currentBet.status === 'win' ? currentBet.side : currentBet.side === 'left' ? 'right' : 'left',
            betResult: currentBet.status,
            coinDelta: currentBet.coin_delta,
            stake: currentBet.stake,
          }
        : null,
      pendingStake: currentBet?.stake ?? DEFAULT_STAKE,
    }
  }

  async removeUser(userKey) {
    this.players.delete(userKey)
    this.bets = this.bets.filter((bet) => bet.user_key !== userKey)
  }

  async cleanup() {
    this.events = this.events.slice(-120)
    this.bets = this.bets.filter((bet) => bet.status === 'pending' || this.players.has(bet.user_key))
  }
}
