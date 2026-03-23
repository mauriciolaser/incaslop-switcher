import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const ROOT_DIR = path.resolve(__dirname, '..')
export const DATA_DIR = path.join(ROOT_DIR, 'data')

export const config = {
  port: Number(process.env.PORT || 3001),
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'mechas_incaslop_online',
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  allowFileFallback: process.env.ALLOW_FILE_FALLBACK !== 'false',
}

export function hasDatabaseConfig() {
  const { host, database, user, password } = config.db
  return Boolean(host && database && user && password)
}

