import fs from 'node:fs/promises'
import path from 'node:path'
import { DATA_DIR } from '../config.js'
import { INITIAL_COINS } from '../battleEngine.js'

const STATE_FILE = path.join(DATA_DIR, 'arena-state.json')
const USERS_FILE = path.join(DATA_DIR, 'arena-users.json')
const BETS_FILE = path.join(DATA_DIR, 'arena-bets.json')
const EVENTS_FILE = path.join(DATA_DIR, 'arena-events.json')

async function ensureFile(filePath, fallback) {
  try {
    await fs.access(filePath)
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), 'utf8')
  }
}

async function readJson(filePath, fallback) {
  await ensureFile(filePath, fallback)
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8')
}

export class FileStore {
  async init() {
    await ensureFile(STATE_FILE, null)
    await ensureFile(USERS_FILE, {})
    await ensureFile(BETS_FILE, [])
    await ensureFile(EVENTS_FILE, [])
  }

  async loadState() {
    return readJson(STATE_FILE, null)
  }

  async saveState(state) {
    await writeJson(STATE_FILE, state)
  }

  async appendEvent(event) {
    const events = await readJson(EVENTS_FILE, [])
    const nextEvent = {
      ...event,
      id: (events.at(-1)?.id ?? 0) + 1,
      createdAt: new Date().toISOString(),
    }
    events.push(nextEvent)
    await writeJson(EVENTS_FILE, events)
    return nextEvent
  }

  async getEventsSince(since = 0) {
    const events = await readJson(EVENTS_FILE, [])
    return events.filter((event) => event.id > since)
  }

  async ensureUser(userKey) {
    const users = await readJson(USERS_FILE, {})
    if (!users[userKey]) {
      users[userKey] = { coins: INITIAL_COINS, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      await writeJson(USERS_FILE, users)
    }
    return users[userKey]
  }

  async placeBet(userKey, bet) {
    const bets = await readJson(BETS_FILE, [])
    const idx = bets.findIndex((item) => item.userKey === userKey && item.roundNumber === bet.roundNumber)
    const nextBet = {
      id: idx >= 0 ? bets[idx].id : (bets.at(-1)?.id ?? 0) + 1,
      userKey,
      roundNumber: bet.roundNumber,
      side: bet.side,
      stake: bet.stake,
      status: 'pending',
      coinDelta: 0,
      createdAt: idx >= 0 ? bets[idx].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    if (idx >= 0) {
      bets[idx] = nextBet
    } else {
      bets.push(nextBet)
    }

    await writeJson(BETS_FILE, bets)
    return nextBet
  }

  async settleRound(roundNumber, winnerSide) {
    const users = await readJson(USERS_FILE, {})
    const bets = await readJson(BETS_FILE, [])
    let changed = false

    for (const bet of bets) {
      if (bet.roundNumber !== roundNumber || bet.status !== 'pending') continue
      const didWin = bet.side === winnerSide
      bet.status = didWin ? 'win' : 'lose'
      bet.coinDelta = didWin ? bet.stake : -bet.stake
      bet.updatedAt = new Date().toISOString()

      users[bet.userKey] = users[bet.userKey] || { coins: INITIAL_COINS, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      users[bet.userKey].coins = Math.max(0, users[bet.userKey].coins + bet.coinDelta)
      users[bet.userKey].updatedAt = new Date().toISOString()
      changed = true
    }

    if (changed) {
      await writeJson(BETS_FILE, bets)
      await writeJson(USERS_FILE, users)
    }
  }

  async getUserView(userKey, currentRound, currentPhase) {
    const users = await readJson(USERS_FILE, {})
    const bets = await readJson(BETS_FILE, [])
    const user = users[userKey] || { coins: INITIAL_COINS }
    const currentBet = bets.find((bet) => bet.userKey === userKey && bet.roundNumber === currentRound) || null
    const roundResult = currentPhase === 'result'
      ? bets.find((bet) => bet.userKey === userKey && bet.roundNumber === currentRound && bet.status !== 'pending') || null
      : null

    return {
      coins: user.coins,
      currentBet: currentBet ? { side: currentBet.side, stake: currentBet.stake, roundNumber: currentBet.roundNumber } : null,
      lastResult: roundResult
        ? {
            winnerSide: roundResult.status === 'win' ? roundResult.side : roundResult.side === 'left' ? 'right' : 'left',
            betResult: roundResult.status,
            coinDelta: roundResult.coinDelta,
            stake: roundResult.stake,
          }
        : null,
    }
  }
}
