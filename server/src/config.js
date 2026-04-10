import process from 'node:process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const ROOT_DIR = path.resolve(__dirname, '..')
export const DATA_DIR = path.join(ROOT_DIR, 'data')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

export const config = {
  port: Number(process.env.PORT || 3001),
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'mechas_incaslop_online',
  candidateApiBaseUrl: process.env.CANDIDATE_API_BASE_URL || 'https://api.candidatos.incaslop.online',
  storeMode: process.env.ONLINE_STORE || 'sqlite',
  sqliteFilename: process.env.SQLITE_FILENAME || path.join(DATA_DIR, 'arena-temp.sqlite'),
  resetSqliteOnBoot: process.env.RESET_SQLITE_ON_BOOT !== 'false',
  playerTtlMs: Number(process.env.PLAYER_TTL_MS || 1000 * 60 * 2),
  eliminatedTtlMs: Number(process.env.ELIMINATED_TTL_MS || 1000 * 60 * 5),
  eventRetentionCount: Number(process.env.EVENT_RETENTION_COUNT || 120),
}
