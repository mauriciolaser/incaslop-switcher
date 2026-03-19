import mysql from 'mysql2/promise'
import { config } from '../config.js'
import { INITIAL_COINS } from '../battleEngine.js'

export class MySQLStore {
  constructor() {
    this.pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: 5,
    })
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS online_state (
        id TINYINT PRIMARY KEY,
        state_json LONGTEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS online_events (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        event_type VARCHAR(64) NOT NULL,
        round_number INT NOT NULL,
        payload_json LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS online_users (
        user_key VARCHAR(128) PRIMARY KEY,
        coins INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS online_bets (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_key VARCHAR(128) NOT NULL,
        round_number INT NOT NULL,
        side VARCHAR(8) NOT NULL,
        stake INT NOT NULL,
        status VARCHAR(16) NOT NULL,
        coin_delta INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_round (user_key, round_number)
      )
    `)
  }

  async loadState() {
    const [rows] = await this.pool.query('SELECT state_json FROM online_state WHERE id = 1 LIMIT 1')
    if (!rows.length) return null
    return JSON.parse(rows[0].state_json)
  }

  async saveState(state) {
    await this.pool.query(
      'INSERT INTO online_state (id, state_json) VALUES (1, ?) ON DUPLICATE KEY UPDATE state_json = VALUES(state_json)',
      [JSON.stringify(state)],
    )
  }

  async appendEvent(event) {
    const [result] = await this.pool.query(
      'INSERT INTO online_events (event_type, round_number, payload_json) VALUES (?, ?, ?)',
      [event.type, event.roundNumber, JSON.stringify(event.payload ?? {})],
    )

    return {
      id: result.insertId,
      type: event.type,
      roundNumber: event.roundNumber,
      payload: event.payload ?? {},
      createdAt: new Date().toISOString(),
    }
  }

  async getEventsSince(since = 0) {
    const [rows] = await this.pool.query(
      'SELECT id, event_type, round_number, payload_json, created_at FROM online_events WHERE id > ? ORDER BY id ASC',
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

  async ensureUser(userKey) {
    await this.pool.query(
      'INSERT INTO online_users (user_key, coins) VALUES (?, ?) ON DUPLICATE KEY UPDATE user_key = user_key',
      [userKey, INITIAL_COINS],
    )
  }

  async placeBet(userKey, bet) {
    await this.pool.query(
      `INSERT INTO online_bets (user_key, round_number, side, stake, status, coin_delta)
       VALUES (?, ?, ?, ?, 'pending', 0)
       ON DUPLICATE KEY UPDATE side = VALUES(side), stake = VALUES(stake), status = 'pending', coin_delta = 0`,
      [userKey, bet.roundNumber, bet.side, bet.stake],
    )
  }

  async settleRound(roundNumber, winnerSide) {
    const connection = await this.pool.getConnection()
    try {
      await connection.beginTransaction()
      const [bets] = await connection.query(
        "SELECT user_key, side, stake FROM online_bets WHERE round_number = ? AND status = 'pending' FOR UPDATE",
        [roundNumber],
      )

      for (const bet of bets) {
        const didWin = bet.side === winnerSide
        const status = didWin ? 'win' : 'lose'
        const coinDelta = didWin ? bet.stake : -bet.stake

        await connection.query(
          'UPDATE online_bets SET status = ?, coin_delta = ? WHERE user_key = ? AND round_number = ?',
          [status, coinDelta, bet.user_key, roundNumber],
        )

        await connection.query(
          'INSERT INTO online_users (user_key, coins) VALUES (?, ?) ON DUPLICATE KEY UPDATE user_key = user_key',
          [bet.user_key, INITIAL_COINS],
        )

        await connection.query(
          'UPDATE online_users SET coins = GREATEST(0, coins + ?) WHERE user_key = ?',
          [coinDelta, bet.user_key],
        )
      }

      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async getUserView(userKey, currentRound, currentPhase) {
    await this.ensureUser(userKey)

    const [[user]] = await this.pool.query('SELECT coins FROM online_users WHERE user_key = ? LIMIT 1', [userKey])
    const [[currentBet]] = await this.pool.query(
      'SELECT side, stake, round_number, status, coin_delta FROM online_bets WHERE user_key = ? AND round_number = ? LIMIT 1',
      [userKey, currentRound],
    )

    return {
      coins: user?.coins ?? INITIAL_COINS,
      currentBet: currentBet ? { side: currentBet.side, stake: currentBet.stake, roundNumber: currentBet.round_number } : null,
      lastResult: currentPhase === 'result' && currentBet && currentBet.status !== 'pending'
        ? {
            winnerSide: currentBet.status === 'win' ? currentBet.side : currentBet.side === 'left' ? 'right' : 'left',
            betResult: currentBet.status,
            coinDelta: currentBet.coin_delta,
            stake: currentBet.stake,
          }
        : null,
    }
  }
}
