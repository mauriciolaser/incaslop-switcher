import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const PERU_TIME_ZONE = 'America/Lima'

function normalizeStartsAt(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('startsAt must be a valid date')
  return date.toISOString()
}

function toPeruParts(iso) {
  const date = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PERU_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value
    return acc
  }, {})
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} GMT-5`
}

export class ScheduleManager {
  #filePath
  #schedules = []
  #timer = null
  #onDue

  constructor({ filePath, onDue }) {
    this.#filePath = filePath
    this.#onDue = onDue
    this.#load()
    this.#save()
  }

  start() {
    if (this.#timer) return
    this.#timer = setInterval(() => {
      this.runDue().catch((e) => console.error('[schedules] runDue failed:', e.message))
    }, 5000)
  }

  stop() {
    if (!this.#timer) return
    clearInterval(this.#timer)
    this.#timer = null
  }

  list() {
    return this.#schedules
      .slice()
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((schedule) => this.#publicSchedule(schedule))
  }

  create(payload) {
    const now = new Date().toISOString()
    const schedule = this.#normalizePayload(payload, {
      id: randomUUID(),
      enabled: true,
      createdAt: now,
      updatedAt: now,
      lastRunAt: null,
    })
    this.#schedules.push(schedule)
    this.#save()
    return this.#publicSchedule(schedule)
  }

  update(id, payload) {
    const index = this.#schedules.findIndex((schedule) => schedule.id === id)
    if (index === -1) throw new Error('schedule not found')
    const current = this.#schedules[index]
    const updated = this.#normalizePayload({ ...current, ...payload }, {
      ...current,
      updatedAt: new Date().toISOString(),
    })
    if (payload.startsAt) updated.lastRunAt = null
    this.#schedules[index] = updated
    this.#save()
    return this.#publicSchedule(updated)
  }

  delete(id) {
    const before = this.#schedules.length
    this.#schedules = this.#schedules.filter((schedule) => schedule.id !== id)
    if (this.#schedules.length === before) throw new Error('schedule not found')
    this.#save()
  }

  setEnabled(id, enabled) {
    return this.update(id, { enabled: Boolean(enabled) })
  }

  async runDue(now = new Date()) {
    const due = this.#schedules
      .filter((schedule) => schedule.enabled && !schedule.lastRunAt && new Date(schedule.startsAt) <= now)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    const byChannel = new Map()
    for (const schedule of due) {
      if (!byChannel.has(schedule.channel)) byChannel.set(schedule.channel, schedule)
    }

    for (const schedule of byChannel.values()) {
      await this.#onDue(this.#publicSchedule(schedule))
      schedule.lastRunAt = new Date().toISOString()
      schedule.enabled = false
      schedule.updatedAt = schedule.lastRunAt
    }

    if (byChannel.size > 0) this.#save()
  }

  #normalizePayload(payload, base) {
    const channel = payload?.channel || base.channel
    if (channel !== 'audio' && channel !== 'video') throw new Error('channel must be audio or video')
    const playlistName = typeof payload?.playlistName === 'string' ? payload.playlistName.trim() : ''
    if (!playlistName) throw new Error('playlistName is required')
    return {
      ...base,
      channel,
      playlistName,
      startsAt: normalizeStartsAt(payload?.startsAt || base.startsAt),
      enabled: payload?.enabled === undefined ? Boolean(base.enabled) : Boolean(payload.enabled),
    }
  }

  #publicSchedule(schedule) {
    return {
      ...schedule,
      startsAtPeru: toPeruParts(schedule.startsAt),
      timezone: 'GMT-5',
      timezoneName: 'America/Lima',
    }
  }

  #load() {
    try {
      const data = JSON.parse(fs.readFileSync(this.#filePath, 'utf8'))
      this.#schedules = Array.isArray(data.schedules) ? data.schedules : []
    } catch {
      this.#schedules = []
    }
  }

  #save() {
    fs.mkdirSync(path.dirname(this.#filePath), { recursive: true })
    fs.writeFileSync(this.#filePath, JSON.stringify({ schedules: this.#schedules }, null, 2) + '\n', 'utf8')
  }
}
