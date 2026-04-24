import fs from 'fs'
import path from 'path'

const MAX_TAIL_LINES = 2000
const RUN_FILE_RE = /^run-(\d{8}T\d{6}Z)-([a-z0-9]{6})\.log$/i

function pad(n) {
  return String(n).padStart(2, '0')
}

function nowStamp(date = new Date()) {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    'T',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    'Z',
  ].join('')
}

function randomId() {
  return Math.random().toString(36).slice(2, 8)
}

function toLogLine({ timestamp, level, event, message, meta }) {
  const base = `${timestamp} [${String(level || 'info').toUpperCase()}] [${event || 'event'}] ${message || ''}`.trim()
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return base
  const entries = Object.entries(meta).filter(([, value]) => value !== undefined && value !== null)
  if (!entries.length) return base
  const extra = entries.map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(' ')
  return `${base} ${extra}`.trim()
}

export class SwitcherLogManager {
  #baseDir
  #generalPath
  #currentRun = null
  #listeners = new Set()

  constructor({ baseDir }) {
    if (!baseDir) throw new Error('baseDir is required')
    this.#baseDir = baseDir
    this.#generalPath = path.join(this.#baseDir, 'general.log')
    fs.mkdirSync(this.#baseDir, { recursive: true })
  }

  getGeneralLogPath() {
    return this.#generalPath
  }

  getCurrentRun() {
    return this.#currentRun
  }

  startRun(reason = 'manual') {
    const runId = `${nowStamp()}-${randomId()}`
    const fileName = `run-${runId}.log`
    const filePath = path.join(this.#baseDir, fileName)
    this.#currentRun = {
      id: runId,
      fileName,
      filePath,
      startedAt: new Date().toISOString(),
    }
    this.info('run.start', 'Run started', { runId, reason })
    return this.#currentRun
  }

  endRun(reason = 'manual-stop') {
    if (!this.#currentRun) return null
    const finished = {
      ...this.#currentRun,
      endedAt: new Date().toISOString(),
    }
    this.info('run.end', 'Run ended', { runId: finished.id, reason })
    this.#currentRun = null
    return finished
  }

  log(level, event, message, meta = {}) {
    const timestamp = new Date().toISOString()
    const line = toLogLine({ timestamp, level, event, message, meta })
    this.#appendLine(this.#generalPath, line)
    if (this.#currentRun?.filePath) {
      this.#appendLine(this.#currentRun.filePath, line)
    }
    this.#emit({ timestamp, level, event, message, meta, line })
  }

  debug(event, message, meta = {}) {
    this.log('debug', event, message, meta)
  }

  info(event, message, meta = {}) {
    this.log('info', event, message, meta)
  }

  warn(event, message, meta = {}) {
    this.log('warn', event, message, meta)
  }

  error(event, message, meta = {}) {
    this.log('error', event, message, meta)
  }

  listRuns(limit = 30) {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 30))
    const files = fs.readdirSync(this.#baseDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && RUN_FILE_RE.test(entry.name))
      .map((entry) => {
        const fullPath = path.join(this.#baseDir, entry.name)
        const stats = fs.statSync(fullPath)
        const match = entry.name.match(RUN_FILE_RE)
        return {
          id: `${match[1]}-${match[2]}`,
          fileName: entry.name,
          filePath: fullPath,
          size: stats.size,
          mtimeMs: stats.mtimeMs,
          updatedAt: stats.mtime.toISOString(),
        }
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, safeLimit)
    return files
  }

  getLatestRun() {
    return this.listRuns(1)[0] || null
  }

  resolveRunPath(runId) {
    if (typeof runId !== 'string') return null
    const trimmed = runId.trim()
    if (!/^\d{8}T\d{6}Z-[a-z0-9]{6}$/i.test(trimmed)) return null
    const filePath = path.join(this.#baseDir, `run-${trimmed}.log`)
    if (!fs.existsSync(filePath)) return null
    return filePath
  }

  tailFile(filePath, lines = 20) {
    if (!filePath || !fs.existsSync(filePath)) return []
    const safeLines = Math.max(1, Math.min(MAX_TAIL_LINES, Number(lines) || 20))
    const raw = fs.readFileSync(filePath, 'utf8')
    const split = raw.split(/\r?\n/).filter(Boolean)
    return split.slice(-safeLines)
  }

  onLog(listener) {
    if (typeof listener !== 'function') return () => {}
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  pruneRunLogsOlderThan(maxAgeMs) {
    const safeAge = Math.max(1, Number(maxAgeMs) || 0)
    const cutoff = Date.now() - safeAge
    const deleted = []
    const files = this.listRuns(10000)
    for (const run of files) {
      if (run.mtimeMs >= cutoff) continue
      try {
        fs.unlinkSync(run.filePath)
        deleted.push(run.fileName)
      } catch {
        // A concurrent process may have already removed the file.
      }
    }
    return deleted
  }

  trimGeneralToLastLines(maxLines = 100) {
    const safeMax = Math.max(1, Math.min(MAX_TAIL_LINES, Number(maxLines) || 100))
    if (!fs.existsSync(this.#generalPath)) return { trimmed: false, linesKept: 0 }
    const raw = fs.readFileSync(this.#generalPath, 'utf8')
    const split = raw.split(/\r?\n/).filter(Boolean)
    if (split.length <= safeMax) return { trimmed: false, linesKept: split.length }
    const kept = split.slice(-safeMax)
    fs.writeFileSync(this.#generalPath, kept.join('\n') + '\n', 'utf8')
    return { trimmed: true, linesKept: kept.length, removedLines: split.length - kept.length }
  }

  #appendLine(filePath, line) {
    fs.mkdirSync(this.#baseDir, { recursive: true })
    fs.appendFileSync(filePath, line + '\n', 'utf8')
  }

  #emit(entry) {
    if (!this.#listeners.size) return
    for (const listener of this.#listeners) {
      try {
        listener(entry)
      } catch {
        // Log listeners should not break logging.
      }
    }
  }
}
