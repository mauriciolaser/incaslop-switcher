import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AUDIO_DIR = path.join(__dirname, 'audio')
const DATA_DIR = path.join(__dirname, 'data')
const PLAYLIST_FILE = path.join(DATA_DIR, 'audio-playlist.ffconcat')

function normalizeForConcat(filePath) {
  return filePath.replace(/\\/g, '/').replace(/'/g, "'\\''")
}

function probeDurationSeconds(filePath) {
  try {
    const result = spawnSync(
      'ffprobe',
      [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath,
      ],
      { encoding: 'utf8' },
    )

    if (result.status !== 0) return null
    const value = Number((result.stdout || '').trim())
    if (!Number.isFinite(value) || value <= 0) return null
    return value
  } catch {
    return null
  }
}

export class AudioLoopManager {
  #tracks = []
  #enabled = false
  #warnings = []
  #lastScanAt = null
  #playlistFile = PLAYLIST_FILE
  #loopLengthSec = null
  #loopStartedAt = null

  constructor() {
    this.rescan()
  }

  getPlaylistFile() {
    return this.#playlistFile
  }

  getStatus({ isStreaming }) {
    let currentTrack = null
    if (isStreaming && this.#enabled && this.#tracks.length > 0 && this.#loopStartedAt !== null) {
      currentTrack = this.#estimateCurrentTrack()
    }

    return {
      enabled: this.#enabled,
      trackCount: this.#tracks.length,
      currentTrack,
      lastScanAt: this.#lastScanAt,
      warnings: [...this.#warnings],
    }
  }

  markLoopStart() {
    this.#loopStartedAt = Date.now()
  }

  clearLoopStart() {
    this.#loopStartedAt = null
  }

  rescan() {
    const warnings = []
    const tracks = []

    this.#ensureDirs()

    let entries = []
    try {
      entries = fs.readdirSync(AUDIO_DIR, { withFileTypes: true })
    } catch (e) {
      warnings.push(`No se pudo leer carpeta de audio: ${e.message}`)
    }

    const mp3Files = entries
      .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.mp3'))
      .map(entry => entry.name)
      .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))

    for (const name of mp3Files) {
      const filePath = path.join(AUDIO_DIR, name)
      const durationSec = probeDurationSeconds(filePath)
      if (durationSec === null) warnings.push(`No se pudo leer duración de: ${name}`)

      tracks.push({
        index: tracks.length,
        name,
        filePath,
        durationSec,
      })
    }

    this.#tracks = tracks
    this.#enabled = tracks.length > 0
    this.#warnings = warnings
    this.#lastScanAt = new Date().toISOString()
    this.#loopLengthSec = this.#calculateLoopLengthSec()

    if (!this.#enabled && warnings.length === 0) {
      this.#warnings = ['No se encontraron MP3 en switcher/audio']
    }

    this.#writePlaylistFile()

    return this.getStatus({ isStreaming: false })
  }

  #ensureDirs() {
    fs.mkdirSync(AUDIO_DIR, { recursive: true })
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  #writePlaylistFile() {
    const lines = ['ffconcat version 1.0']
    for (const track of this.#tracks) {
      lines.push(`file '${normalizeForConcat(track.filePath)}'`)
    }
    fs.writeFileSync(this.#playlistFile, lines.join('\n') + '\n', 'utf8')
  }

  #calculateLoopLengthSec() {
    if (this.#tracks.length === 0) return null
    let total = 0
    for (const track of this.#tracks) {
      if (track.durationSec === null) return null
      total += track.durationSec
    }
    return total > 0 ? total : null
  }

  #estimateCurrentTrack() {
    if (this.#tracks.length === 0) return null
    if (this.#tracks.length === 1) return this.#publicTrack(this.#tracks[0])
    if (!this.#loopLengthSec || !Number.isFinite(this.#loopLengthSec)) return this.#publicTrack(this.#tracks[0])

    const elapsedSec = Math.max(0, (Date.now() - this.#loopStartedAt) / 1000)
    let offset = elapsedSec % this.#loopLengthSec

    for (const track of this.#tracks) {
      const duration = track.durationSec
      if (!duration || duration <= 0) return this.#publicTrack(this.#tracks[0])
      if (offset < duration) return this.#publicTrack(track)
      offset -= duration
    }

    return this.#publicTrack(this.#tracks[0])
  }

  #publicTrack(track) {
    if (!track) return null
    return {
      index: track.index,
      name: track.name,
      durationSec: track.durationSec,
    }
  }
}
