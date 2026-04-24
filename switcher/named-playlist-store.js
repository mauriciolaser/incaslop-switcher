import fs from 'fs'
import path from 'path'

const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/

export function validatePlaylistName(nameRaw) {
  if (typeof nameRaw !== 'string') throw new Error('name must be a string')
  const name = nameRaw.trim()
  if (!NAME_PATTERN.test(name)) {
    throw new Error('name must use 1-64 letters, numbers, hyphen or underscore')
  }
  return name
}

export class NamedPlaylistStore {
  #dir
  #kind

  constructor({ dir, kind }) {
    this.#dir = dir
    this.#kind = kind
    fs.mkdirSync(this.#dir, { recursive: true })
  }

  list() {
    fs.mkdirSync(this.#dir, { recursive: true })
    return fs.readdirSync(this.#dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
      .map((entry) => this.#readFile(path.join(this.#dir, entry.name)))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  }

  get(nameRaw) {
    const name = validatePlaylistName(nameRaw)
    const playlist = this.#readFile(this.#pathFor(name))
    if (!playlist) throw new Error(`${this.#kind} playlist not found`)
    return playlist
  }

  upsert(nameRaw, payload) {
    const name = validatePlaylistName(nameRaw)
    const now = new Date().toISOString()
    const existing = this.#readFile(this.#pathFor(name))
    const playlist = {
      name,
      repeat: Boolean(payload?.repeat),
      ...(this.#kind === 'audio'
        ? { tracks: Array.isArray(payload?.tracks) ? payload.tracks : [] }
        : { items: Array.isArray(payload?.items) ? payload.items : [] }),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    }
    fs.writeFileSync(this.#pathFor(name), JSON.stringify(playlist, null, 2) + '\n', 'utf8')
    return playlist
  }

  delete(nameRaw) {
    const name = validatePlaylistName(nameRaw)
    const filePath = this.#pathFor(name)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  }

  #pathFor(name) {
    return path.join(this.#dir, `${name}.json`)
  }

  #readFile(filePath) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      const name = validatePlaylistName(data.name || path.basename(filePath, '.json'))
      return {
        ...data,
        name,
        repeat: Boolean(data.repeat),
      }
    } catch {
      return null
    }
  }
}
