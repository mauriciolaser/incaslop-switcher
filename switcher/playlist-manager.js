import { randomUUID } from 'crypto'

export class PlaylistManager {
  #items = []
  #currentIndex = null
  #state = 'idle'
  #timer = null
  #tickStart = null
  #remainingMs = null
  #defaultUrl
  #onSwitch
  #activePlaylistName = null
  #repeat = false

  constructor({ defaultUrl, onSwitch }) {
    this.#defaultUrl = defaultUrl
    this.#onSwitch = onSwitch
  }

  setDefaultUrl(defaultUrl) {
    this.#defaultUrl = defaultUrl
  }

  addItem(url, duracionSegundos) {
    const item = { id: randomUUID(), url, duracionSegundos }
    this.#items.push(item)
    this.#activePlaylistName = null
    return item
  }

  loadPlaylist({ name, items, repeat }) {
    const normalized = (items || []).map((item) => ({
      id: item.id || randomUUID(),
      url: item.url,
      duracionSegundos: Number(item.duracionSegundos ?? item.durationSeconds),
    }))
    if (normalized.length === 0) throw new Error('video playlist must contain at least one item')
    this.#stopInternal()
    this.#items = normalized
    this.#activePlaylistName = name
    this.#repeat = Boolean(repeat)
  }

  removeItem(id) {
    const index = this.#items.findIndex(i => i.id === id)
    if (index === -1) return

    const isActive = index === this.#currentIndex

    this.#items.splice(index, 1)
    this.#activePlaylistName = null

    if (isActive && this.#state === 'running') {
      clearTimeout(this.#timer)
      this.#timer = null
      this.#advance(this.#currentIndex)
    } else if (index < this.#currentIndex) {
      this.#currentIndex--
    }
  }

  clearItems() {
    if (this.#state !== 'idle') this.#stopInternal()
    this.#items = []
    this.#activePlaylistName = null
    this.#repeat = false
  }

  start() {
    if (this.#state === 'running') return

    if (this.#state === 'paused' && this.#currentIndex !== null) {
      const ms = this.#remainingMs ?? 0
      this.#remainingMs = null
      this.#state = 'running'
      this.#tickStart = Date.now()
      this.#timer = setTimeout(() => this.#advance(this.#currentIndex + 1), ms)
      return
    }

    this.#advance(0)
  }

  pause() {
    if (this.#state !== 'running') return

    clearTimeout(this.#timer)
    this.#timer = null

    const item = this.#items[this.#currentIndex]
    if (item) {
      const elapsed = Date.now() - (this.#tickStart ?? Date.now())
      this.#remainingMs = Math.max(0, item.duracionSegundos * 1000 - elapsed)
    }

    this.#state = 'paused'
  }

  resume() {
    this.start()
  }

  stop() {
    this.#stopInternal()
    this.#onSwitch(this.#defaultUrl).catch(() => {})
  }

  getState() {
    const item = this.#currentIndex !== null ? this.#items[this.#currentIndex] : null
    let remainingMs = null

    if (this.#state === 'running' && item) {
      const elapsed = Date.now() - (this.#tickStart ?? Date.now())
      remainingMs = Math.max(0, item.duracionSegundos * 1000 - elapsed)
    } else if (this.#state === 'paused') {
      remainingMs = this.#remainingMs
    }

    return {
      playlistState: this.#state,
      videoMode: this.#state === 'idle' ? 'live' : 'playlist',
      activeVideoPlaylist: this.#activePlaylistName,
      videoPlaylistRepeat: this.#repeat,
      currentIndex: this.#currentIndex,
      nowPlayingVideo: item?.url || null,
      remainingMs,
      items: this.#items.map((it, i) => ({
        ...it,
        durationSeconds: it.duracionSegundos,
        active: i === this.#currentIndex,
      })),
    }
  }

  #advance(index) {
    this.#timer = null

    if (this.#items.length === 0) {
      this.#finish()
      return
    }

    if (index >= this.#items.length && this.#repeat) {
      this.#advance(0)
      return
    }

    if (index >= this.#items.length) {
      this.#finish()
      return
    }

    const item = this.#items[index]
    this.#currentIndex = index
    this.#state = 'running'
    this.#tickStart = Date.now()

    this.#onSwitch(item.url).catch(() => {})

    this.#timer = setTimeout(() => this.#advance(index + 1), item.duracionSegundos * 1000)
  }

  #finish() {
    this.#state = 'idle'
    this.#currentIndex = null
    this.#tickStart = null
    this.#remainingMs = null
    this.#onSwitch(this.#defaultUrl).catch(() => {})
  }

  #stopInternal() {
    clearTimeout(this.#timer)
    this.#timer = null
    this.#state = 'idle'
    this.#currentIndex = null
    this.#tickStart = null
    this.#remainingMs = null
  }
}
