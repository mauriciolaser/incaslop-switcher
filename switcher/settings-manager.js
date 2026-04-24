import fs from 'fs'
import path from 'path'

const DEFAULT_SETTINGS = {
  defaultUrl: 'https://sinadef.incaslop.online',
}

export class SettingsManager {
  #filePath
  #settings

  constructor({ filePath, defaultUrl }) {
    this.#filePath = filePath
    this.#settings = {
      ...DEFAULT_SETTINGS,
      defaultUrl: defaultUrl || DEFAULT_SETTINGS.defaultUrl,
    }
    this.#load()
    this.#save()
  }

  get() {
    return { ...this.#settings }
  }

  getDefaultUrl() {
    return this.#settings.defaultUrl
  }

  setDefaultUrl(defaultUrl) {
    this.#settings.defaultUrl = defaultUrl
    this.#save()
    return this.get()
  }

  #load() {
    try {
      const raw = fs.readFileSync(this.#filePath, 'utf8')
      const data = JSON.parse(raw)
      if (typeof data.defaultUrl === 'string' && data.defaultUrl.trim()) {
        this.#settings.defaultUrl = data.defaultUrl.trim()
      }
    } catch {
      // Missing or invalid settings file keeps constructor defaults.
    }
  }

  #save() {
    fs.mkdirSync(path.dirname(this.#filePath), { recursive: true })
    fs.writeFileSync(this.#filePath, JSON.stringify(this.#settings, null, 2) + '\n', 'utf8')
  }
}
