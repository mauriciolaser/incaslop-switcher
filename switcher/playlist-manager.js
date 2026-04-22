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

  constructor({ defaultUrl, onSwitch }) {
    this.#defaultUrl = defaultUrl
    this.#onSwitch = onSwitch
  }

  addItem(url, duracionSegundos) {
    const item = { id: randomUUID(), url, duracionSegundos }
    this.#items.push(item)
    return item
  }

  removeItem(id) {
    const index = this.#items.findIndex(i => i.id === id)
    if (index === -1) return

    const isActive = index === this.#currentIndex

    this.#items.splice(index, 1)

    if (isActive && this.#state === 'running') {
      clearTimeout(this.#timer)
      this.#timer = null
      // splice moved next item into currentIndex position
      this.#advance(this.#currentIndex)
    } else if (index < this.#currentIndex) {
      this.#currentIndex--
    }
  }

  clearItems() {
    if (this.#state !== 'idle') this.#stopInternal()
    this.#items = []
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
      currentIndex: this.#currentIndex,
      remainingMs,
      items: this.#items.map((it, i) => ({
        ...it,
        active: i === this.#currentIndex,
      })),
    }
  }

  #advance(index) {
    this.#timer = null

    if (this.#items.length === 0 || index >= this.#items.length) {
      this.#state = 'idle'
      this.#currentIndex = null
      this.#tickStart = null
      this.#onSwitch(this.#defaultUrl).catch(() => {})
      return
    }

    const item = this.#items[index]
    this.#currentIndex = index
    this.#state = 'running'
    this.#tickStart = Date.now()

    this.#onSwitch(item.url).catch(() => {})

    this.#timer = setTimeout(() => this.#advance(index + 1), item.duracionSegundos * 1000)
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
