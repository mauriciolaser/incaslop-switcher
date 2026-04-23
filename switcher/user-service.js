import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

const SESSION_TTL_MS = 1000 * 60 * 60 * 24

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DEFAULT_USERS_PATH = join(__dirname, '.internal', '.users.json')

export class UserService {
  constructor({ usersPath = DEFAULT_USERS_PATH } = {}) {
    this.usersPath = usersPath
    this.sessions = new Map()
  }

  async init() {
    await mkdir(dirname(this.usersPath), { recursive: true })

    try {
      await readFile(this.usersPath, 'utf8')
    } catch {
      const seed = {
        users: [{ username: 'inca', password: 'slop' }],
      }
      await writeFile(this.usersPath, JSON.stringify(seed, null, 2), 'utf8')
    }
  }

  async login(username, password) {
    const users = await this.readUsers()
    const found = users.find((user) => user.username === username && user.password === password)
    if (!found) return null

    const token = randomBytes(24).toString('hex')
    const expiresAt = Date.now() + SESSION_TTL_MS
    const session = { token, user: found.username, expiresAt }
    this.sessions.set(token, session)
    return session
  }

  getSession(token) {
    if (!token) return null

    const now = Date.now()
    this.cleanupExpired(now)

    const session = this.sessions.get(token)
    if (!session) return null
    if (session.expiresAt <= now) {
      this.sessions.delete(token)
      return null
    }
    return session
  }

  logout(token) {
    if (!token) return
    this.sessions.delete(token)
  }

  async readUsers() {
    const raw = await readFile(this.usersPath, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed.users)) return []
    return parsed.users
      .map((user) => ({
        username: typeof user?.username === 'string' ? user.username.trim() : '',
        password: typeof user?.password === 'string' ? user.password : '',
      }))
      .filter((user) => user.username && user.password)
  }

  cleanupExpired(now = Date.now()) {
    for (const [token, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) this.sessions.delete(token)
    }
  }
}
