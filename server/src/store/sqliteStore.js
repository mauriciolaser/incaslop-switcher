import fs from 'node:fs/promises'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'
import { config } from '../config.js'
import { DEFAULT_STAKE, INITIAL_COINS } from '../battleEngine.js'

function nowIso() {
  return new Date().toISOString()
}

function createGuestLabel(guestNumber) {
  return `guest${guestNumber}`
}

export class SQLiteStore {
  constructor() {
    this.db = null
  }

  async init() {
    if (config.resetSqliteOnBoot) {
      await fs.rm(config.sqliteFilename, { force: true }).catch(() => {})
    }

    this.db = await open({
      filename: config.sqliteFilename,
      driver: sqlite3.Database,
    })

    await this.db.exec(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS arena_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS arena_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        round_number INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS arena_players (
        user_key TEXT PRIMARY KEY,
        guest_number INTEGER NOT NULL,
        coins INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS arena_bets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_key TEXT NOT NULL,
        round_number INTEGER NOT NULL,
        side TEXT NOT NULL,
        stake INTEGER NOT NULL,
        status TEXT NOT NULL,
        coin_delta INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_key, round_number)
      );
    `)
  }

  async loadState() {
    const row = await this.db.get('SELECT state_json FROM arena_state WHERE id = 1')
    return row ? JSON.parse(row.state_json) : null
  }

  async saveState(state) {
    const updatedAt = nowIso()
    await this.db.run(
      `INSERT INTO arena_state (id, state_json, updated_at)
       VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`,
      [JSON.stringify(state), updatedAt],
    )
  }

  async appendEvent(event) {
    const createdAt = nowIso()
    const result = await this.db.run(
      'INSERT INTO arena_events (event_type, round_number, payload_json, created_at) VALUES (?, ?, ?, ?)',
      [event.type, event.roundNumber, JSON.stringify(event.payload ?? {}), createdAt],
    )

    return {
      id: result.lastID,
      type: event.type,
      roundNumber: event.roundNumber,
      payload: event.payload ?? {},
      createdAt,
    }
  }

  async getEventsSince(since = 0) {
    const rows = await this.db.all(
      'SELECT id, event_type, round_number, payload_json, created_at FROM arena_events WHERE id > ? ORDER BY id ASC',
      [since],
    )

    return rows.map((row) => ({
      id: row.id,
      type: row.event_type,
      roundNumber: row.round_number,
      payload: JSON.parse(row.payload_json),
      createdAt: row.created_at,
    }))
  }

  async getNextGuestNumber() {
    const row = await this.db.get('SELECT COALESCE(MAX(guest_number), 0) AS max_guest FROM arena_players')
    return Number(row?.max_guest ?? 0) + 1
  }

  async ensureUser(userKey) {
    const existing = await this.db.get('SELECT * FROM arena_players WHERE user_key = ?', [userKey])
    const timestamp = nowIso()

    if (!existing) {
      const guestNumber = await this.getNextGuestNumber()
      await this.db.run(
        `INSERT INTO arena_players (user_key, guest_number, coins, status, created_at, updated_at, last_seen_at)
         VALUES (?, ?, ?, 'active', ?, ?, ?)`,
        [userKey, guestNumber, INITIAL_COINS, timestamp, timestamp, timestamp],
      )
      return this.getPlayer(userKey)
    }

    if (existing.status !== 'active') {
      const guestNumber = await this.getNextGuestNumber()
      await this.db.run(
        `UPDATE arena_players
         SET guest_number = ?, coins = ?, status = 'active', updated_at = ?, last_seen_at = ?
         WHERE user_key = ?`,
        [guestNumber, INITIAL_COINS, timestamp, timestamp, userKey],
      )
      await this.db.run('DELETE FROM arena_bets WHERE user_key = ?', [userKey])
      return this.getPlayer(userKey)
    }

    await this.touchUser(userKey)
    return this.getPlayer(userKey)
  }

  async touchUser(userKey) {
    const timestamp = nowIso()
    await this.db.run(
      'UPDATE arena_players SET updated_at = ?, last_seen_at = ? WHERE user_key = ?',
      [timestamp, timestamp, userKey],
    )
  }

  async getPlayer(userKey) {
    return this.db.get('SELECT * FROM arena_players WHERE user_key = ?', [userKey])
  }

  async listActivePlayers() {
    const recentThreshold = new Date(Date.now() - config.playerTtlMs).toISOString()
    const rows = await this.db.all(
      `SELECT user_key, guest_number, coins, status
       FROM arena_players
       WHERE status = 'active' AND last_seen_at >= ?
       ORDER BY guest_number ASC`,
      [recentThreshold],
    )

    return rows.map((row) => ({
      userKey: row.user_key,
      guestNumber: row.guest_number,
      label: createGuestLabel(row.guest_number),
      coins: row.coins,
      status: row.status,
    }))
  }

  async placeBet(userKey, bet) {
    const timestamp = nowIso()
    await this.db.run(
      `INSERT INTO arena_bets (user_key, round_number, side, stake, status, coin_delta, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', 0, ?, ?)
       ON CONFLICT(user_key, round_number)
       DO UPDATE SET side = excluded.side, stake = excluded.stake, status = 'pending', coin_delta = 0, updated_at = excluded.updated_at`,
      [userKey, bet.roundNumber, bet.side, bet.stake, timestamp, timestamp],
    )
  }

  async settleRound(roundNumber, winnerSide) {
    const players = await this.db.all('SELECT user_key, coins FROM arena_players')
    const playerCoins = new Map(players.map((player) => [player.user_key, player.coins]))
    const pendingBets = await this.db.all(
      `SELECT id, user_key, side, stake
       FROM arena_bets
       WHERE round_number = ? AND status = 'pending'`,
      [roundNumber],
    )

    for (const bet of pendingBets) {
      const didWin = bet.side === winnerSide
      const status = didWin ? 'win' : 'lose'
      const coinDelta = didWin ? bet.stake : -bet.stake
      const nextCoins = Math.max(0, (playerCoins.get(bet.user_key) ?? INITIAL_COINS) + coinDelta)
      playerCoins.set(bet.user_key, nextCoins)

      await this.db.run(
        'UPDATE arena_bets SET status = ?, coin_delta = ?, updated_at = ? WHERE id = ?',
        [status, coinDelta, nowIso(), bet.id],
      )

      await this.db.run(
        `UPDATE arena_players
         SET coins = ?, status = CASE WHEN ? <= 0 THEN 'eliminated' ELSE status END, updated_at = ?
         WHERE user_key = ?`,
        [nextCoins, nextCoins, nowIso(), bet.user_key],
      )
    }
  }

  async getUserView(userKey, currentRound, currentPhase) {
    const player = await this.getPlayer(userKey)
    const currentBet = await this.db.get(
      `SELECT side, stake, round_number, status, coin_delta
       FROM arena_bets
       WHERE user_key = ? AND round_number = ?`,
      [userKey, currentRound],
    )

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
    await this.db.run('DELETE FROM arena_bets WHERE user_key = ?', [userKey])
    await this.db.run('DELETE FROM arena_players WHERE user_key = ?', [userKey])
  }

  async cleanup() {
    const now = Date.now()
    const staleThreshold = new Date(now - config.playerTtlMs).toISOString()
    const eliminatedThreshold = new Date(now - config.eliminatedTtlMs).toISOString()

    await this.db.run(
      `DELETE FROM arena_bets
       WHERE user_key IN (
         SELECT user_key FROM arena_players
         WHERE (status = 'active' AND last_seen_at < ?)
            OR (status = 'eliminated' AND updated_at < ?)
       )`,
      [staleThreshold, eliminatedThreshold],
    )

    await this.db.run(
      `DELETE FROM arena_players
       WHERE (status = 'active' AND last_seen_at < ?)
          OR (status = 'eliminated' AND updated_at < ?)`,
      [staleThreshold, eliminatedThreshold],
    )

    const cutoff = await this.db.get(
      `SELECT id
       FROM arena_events
       ORDER BY id DESC
       LIMIT 1 OFFSET ?`,
      [Math.max(config.eventRetentionCount - 1, 0)],
    )

    if (cutoff?.id) {
      await this.db.run('DELETE FROM arena_events WHERE id < ?', [cutoff.id])
    }

    await this.db.run(
      `DELETE FROM arena_bets
       WHERE status != 'pending'
         AND updated_at < ?`,
      [eliminatedThreshold],
    )
  }
}
