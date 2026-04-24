import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AUDIO_DIR = path.join(__dirname, 'audio')
const DATA_DIR = path.join(__dirname, 'data')
const STATE_FILE = path.join(DATA_DIR, 'audio-state.json')
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
  #allTracks = []
  #activeTracks = []
  #warnings = []
  #lastScanAt = null
  #playlistFile = PLAYLIST_FILE
  #loopLengthSec = null
  #loopStartedAt = null
  #state = {
    mode: 'catalog',
    archived: [],
    playlistName: null,
    playlistTracks: [],
    repeat: false,
  }

  constructor() {
    this.#ensureDirs()
    this.#loadState()
    this.rescan()
  }

  getPlaylistFile() {
    return this.#playlistFile
  }

  getStatus({ isStreaming }) {
    const enabled = this.#activeTracks.length > 0 && this.#state.mode !== 'muted' && this.#state.mode !== 'stopped'
    let currentTrack = null
    if (isStreaming && enabled && this.#loopStartedAt !== null) {
      currentTrack = this.#estimateCurrentTrack()
    }

    return {
      enabled,
      mode: this.#state.mode,
      muted: this.#state.mode === 'muted',
      playlistName: this.#state.playlistName,
      repeat: this.#state.repeat,
      trackCount: this.#activeTracks.length,
      catalogCount: this.#allTracks.filter((track) => !this.#isArchived(track.name)).length,
      currentTrack,
      tracks: this.listTracks(),
      lastScanAt: this.#lastScanAt,
      warnings: [...this.#warnings],
      finiteDurationSec: this.getFiniteDurationSec(),
    }
  }

  listTracks() {
    return this.#allTracks.map((track) => ({
      index: track.index,
      name: track.name,
      durationSec: track.durationSec,
      archived: this.#isArchived(track.name),
      active: this.#activeTracks.some((active) => active.name === track.name),
    }))
  }

  archiveTrack(name) {
    const track = this.#findTrack(name)
    const archived = new Set(this.#state.archived)
    archived.add(track.name)
    this.#state.archived = [...archived].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    this.#state.playlistTracks = this.#state.playlistTracks.filter((trackName) => trackName !== track.name)
    this.#saveState()
    this.rescan()
    return this.listTracks().find((item) => item.name === track.name)
  }

  unarchiveTrack(name) {
    const track = this.#findTrack(name)
    this.#state.archived = this.#state.archived.filter((trackName) => trackName !== track.name)
    this.#saveState()
    this.rescan()
    return this.listTracks().find((item) => item.name === track.name)
  }

  playCatalog() {
    this.#state.mode = 'catalog'
    this.#state.playlistName = null
    this.#state.playlistTracks = []
    this.#state.repeat = false
    this.#saveState()
    this.#selectActiveTracks()
    this.#writePlaylistFile()
  }

  playPlaylist({ name, tracks, repeat }) {
    const allowed = this.#trackNamesSet()
    const selected = []
    for (const trackNameRaw of tracks || []) {
      const trackName = typeof trackNameRaw === 'string' ? trackNameRaw.trim() : ''
      if (!allowed.has(trackName)) throw new Error(`track not available: ${trackName}`)
      if (!selected.includes(trackName)) selected.push(trackName)
    }
    if (selected.length === 0) throw new Error('audio playlist must contain at least one available track')

    this.#state.mode = 'playlist'
    this.#state.playlistName = name
    this.#state.playlistTracks = selected
    this.#state.repeat = Boolean(repeat)
    this.#saveState()
    this.#selectActiveTracks()
    this.#writePlaylistFile()
  }

  mute() {
    this.#state.mode = 'muted'
    this.#state.playlistName = null
    this.#state.playlistTracks = []
    this.#state.repeat = false
    this.#saveState()
    this.#selectActiveTracks()
    this.#writePlaylistFile()
  }

  stop() {
    this.#state.mode = 'stopped'
    this.#state.playlistName = null
    this.#state.playlistTracks = []
    this.#state.repeat = false
    this.#saveState()
    this.#selectActiveTracks()
    this.#writePlaylistFile()
  }

  markLoopStart() {
    this.#loopStartedAt = Date.now()
  }

  clearLoopStart() {
    this.#loopStartedAt = null
  }

  getFiniteDurationSec() {
    if (this.#state.mode !== 'playlist' || this.#state.repeat) return null
    if (!this.#loopLengthSec || !Number.isFinite(this.#loopLengthSec)) return null
    return this.#loopLengthSec
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

    this.#allTracks = tracks
    this.#warnings = warnings
    this.#lastScanAt = new Date().toISOString()
    this.#state.archived = this.#state.archived.filter((name) => tracks.some((track) => track.name === name))
    this.#selectActiveTracks()
    this.#loopLengthSec = this.#calculateLoopLengthSec()

    if (this.#activeTracks.length === 0 && warnings.length === 0 && this.#state.mode !== 'muted' && this.#state.mode !== 'stopped') {
      this.#warnings = ['No se encontraron MP3 activos en switcher/audio']
    }

    this.#saveState()
    this.#writePlaylistFile()

    return this.getStatus({ isStreaming: false })
  }

  #ensureDirs() {
    fs.mkdirSync(AUDIO_DIR, { recursive: true })
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  #loadState() {
    try {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
      this.#state = {
        mode: ['catalog', 'playlist', 'muted', 'stopped'].includes(data.mode) ? data.mode : 'catalog',
        archived: Array.isArray(data.archived) ? data.archived.filter((name) => typeof name === 'string') : [],
        playlistName: typeof data.playlistName === 'string' ? data.playlistName : null,
        playlistTracks: Array.isArray(data.playlistTracks) ? data.playlistTracks.filter((name) => typeof name === 'string') : [],
        repeat: Boolean(data.repeat),
      }
    } catch {
      // Missing or invalid state file starts with the catalog defaults.
    }
  }

  #saveState() {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
    fs.writeFileSync(STATE_FILE, JSON.stringify(this.#state, null, 2) + '\n', 'utf8')
  }

  #selectActiveTracks() {
    if (this.#state.mode === 'muted' || this.#state.mode === 'stopped') {
      this.#activeTracks = []
      this.#loopLengthSec = null
      return
    }

    const available = this.#allTracks.filter((track) => !this.#isArchived(track.name))
    if (this.#state.mode === 'playlist') {
      const byName = new Map(available.map((track) => [track.name, track]))
      this.#activeTracks = this.#state.playlistTracks.map((name) => byName.get(name)).filter(Boolean)
      if (this.#activeTracks.length === 0) {
        this.#state.mode = 'catalog'
        this.#state.playlistName = null
        this.#state.playlistTracks = []
        this.#state.repeat = false
        this.#activeTracks = available
      }
    } else {
      this.#activeTracks = available
    }
  }

  #writePlaylistFile() {
    const lines = ['ffconcat version 1.0']
    for (const track of this.#activeTracks) {
      lines.push(`file '${normalizeForConcat(track.filePath)}'`)
    }
    fs.writeFileSync(this.#playlistFile, lines.join('\n') + '\n', 'utf8')
  }

  #calculateLoopLengthSec() {
    if (this.#activeTracks.length === 0) return null
    let total = 0
    for (const track of this.#activeTracks) {
      if (track.durationSec === null) return null
      total += track.durationSec
    }
    return total > 0 ? total : null
  }

  #estimateCurrentTrack() {
    if (this.#activeTracks.length === 0) return null
    if (this.#activeTracks.length === 1) return this.#publicTrack(this.#activeTracks[0])
    if (!this.#loopLengthSec || !Number.isFinite(this.#loopLengthSec)) return this.#publicTrack(this.#activeTracks[0])

    const elapsedSec = Math.max(0, (Date.now() - this.#loopStartedAt) / 1000)
    let offset = elapsedSec % this.#loopLengthSec

    for (const track of this.#activeTracks) {
      const duration = track.durationSec
      if (!duration || duration <= 0) return this.#publicTrack(this.#activeTracks[0])
      if (offset < duration) return this.#publicTrack(track)
      offset -= duration
    }

    return this.#publicTrack(this.#activeTracks[0])
  }

  #publicTrack(track) {
    if (!track) return null
    return {
      index: track.index,
      name: track.name,
      durationSec: track.durationSec,
    }
  }

  #isArchived(name) {
    return this.#state.archived.includes(name)
  }

  #findTrack(nameRaw) {
    const name = typeof nameRaw === 'string' ? nameRaw.trim() : ''
    const track = this.#allTracks.find((item) => item.name === name)
    if (!track) throw new Error('track not found')
    return track
  }

  #trackNamesSet() {
    return new Set(this.#allTracks.filter((track) => !this.#isArchived(track.name)).map((track) => track.name))
  }
}
