import 'dotenv/config'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import cors from 'cors'
import { StreamManager } from './stream-manager.js'
import { PlaylistManager } from './playlist-manager.js'
import { UserService } from './user-service.js'
import { SwitcherLogManager } from './log-manager.js'
import { TelegramNotifier } from './telegram-notifier.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', 'telegram', '.env') })

const PORT = process.env.PORT || 3000
const API_TOKEN = process.env.API_TOKEN || ''
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'
const STREAM_RESTART_INTERVAL_MS = Number(process.env.STREAM_RESTART_INTERVAL_MS || 6 * 60 * 60 * 1000)
const STREAM_WATCHDOG_INTERVAL_MS = Number(process.env.STREAM_WATCHDOG_INTERVAL_MS || 60 * 1000)
const LOG_MAINTENANCE_INTERVAL_MS = Number(process.env.LOG_MAINTENANCE_INTERVAL_MS || 7 * 24 * 60 * 60 * 1000)
const LOG_RETENTION_DAYS = Number(process.env.LOG_RETENTION_DAYS || 7)
const GENERAL_LOG_MAX_LINES = Number(process.env.GENERAL_LOG_MAX_LINES || 100)

const corsOptions = { origin: ALLOWED_ORIGIN }
const app = express()
const logger = new SwitcherLogManager({ baseDir: path.join(__dirname, 'logs') })
const telegram = new TelegramNotifier({
  token: process.env.TELEGRAM_API || process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID,
  appName: 'incaslop-switcher',
})

app.use(express.json())
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))

const DEFAULT_URL = process.env.DEFAULT_URL || 'about:blank'
const OVERLAY_DURATION_MS = 8000
const OVERLAY_MAX_LENGTH = 180
const OVERLAY_DEFAULT_STYLE = 'neon-burst'
const OVERLAY_STYLE_PRESETS = new Set(['neon-burst', 'acid-fire', 'pixel-rave', 'cosmic-pop', 'warning-siren'])
const STICKER_URL_MAX_LENGTH = 2048
const userService = new UserService()

await userService.init()
logger.info('server.init', 'User service initialized')
const telegramStatus = await telegram.init()
if (telegramStatus.enabled) {
  logger.info('telegram.init.ok', 'Telegram notifier enabled', { chatId: telegramStatus.chatId })
  await sendTelegramAlert('Notificador Telegram activado.')
} else {
  logger.warn('telegram.init.disabled', 'Telegram notifier disabled', { reason: telegramStatus.reason })
}

const manager = new StreamManager({
  DISPLAY_NUM: process.env.DISPLAY_NUM,
  STREAM_WIDTH: process.env.STREAM_WIDTH,
  STREAM_HEIGHT: process.env.STREAM_HEIGHT,
  STREAM_FPS: process.env.STREAM_FPS,
  VIDEO_BITRATE: process.env.VIDEO_BITRATE,
  MAXRATE: process.env.MAXRATE,
  BUFSIZE: process.env.BUFSIZE,
  GOP: process.env.GOP,
  PRESET: process.env.PRESET,
  AUDIO_BITRATE: process.env.AUDIO_BITRATE,
  CHROMIUM_EXECUTABLE_PATH: process.env.CHROMIUM_EXECUTABLE_PATH,
  KICK_RTMP_URL: process.env.KICK_RTMP_URL,
  KICK_STREAM_KEY: process.env.KICK_STREAM_KEY,
  logger,
})

const TELEGRAM_CRITICAL_EVENTS = new Set([
  'ffmpeg.close',
  'chromium.close',
  'stream.start.fail',
  'stream.restart.fail',
  'stream.auto-start.fail',
])

logger.onLog(async (entry) => {
  if (!entry || entry.level !== 'error') return
  if (!TELEGRAM_CRITICAL_EVENTS.has(entry.event)) return
  await sendTelegramAlert(`Error crítico [${entry.event}]: ${entry.message}`)
})

const playlist = new PlaylistManager({
  defaultUrl: DEFAULT_URL,
  onSwitch: async (url) => {
    try {
      if (manager.getStatus().status === 'streaming') await manager.switchUrl(url)
    } catch (e) {
      logger.error('playlist.switch.error', 'Playlist switch failed', { error: e.message, url })
      console.error('[playlist] switch error:', e.message)
    }
  },
})

const overlay = {
  text: '',
  visible: false,
  expiresAt: null,
  updatedAt: null,
  style: OVERLAY_DEFAULT_STYLE,
}

let overlayTimer = null
let periodicRestartTimer = null
let watchdogTimer = null
let logMaintenanceTimer = null
let shouldKeepStreaming = false
let restartInProgress = false

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseLinesParam(raw, fallback = 20) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.max(1, Math.min(200, Math.floor(n)))
}

function parsePositive(raw, fallback) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return n
}

async function sendTelegramAlert(message) {
  if (!telegram.enabled) return
  const sent = await telegram.send(message)
  if (!sent) {
    logger.warn('telegram.send.fail', 'Telegram alert could not be delivered', { message })
  }
}

function getOverlayState() {
  return {
    text: overlay.text,
    visible: overlay.visible,
    expiresAt: overlay.expiresAt,
    updatedAt: overlay.updatedAt,
    style: overlay.style,
  }
}

function clearOverlayTimer() {
  if (!overlayTimer) return
  clearTimeout(overlayTimer)
  overlayTimer = null
}

function hideOverlayState(now = Date.now()) {
  overlay.text = ''
  overlay.visible = false
  overlay.expiresAt = null
  overlay.updatedAt = now
  overlay.style = OVERLAY_DEFAULT_STYLE
}

function setOverlayState(text, style, now = Date.now()) {
  overlay.text = text
  overlay.visible = true
  overlay.expiresAt = now + OVERLAY_DURATION_MS
  overlay.updatedAt = now
  overlay.style = style
}

function normalizeOverlayStyle(styleRaw) {
  if (typeof styleRaw !== 'string') return OVERLAY_DEFAULT_STYLE
  return OVERLAY_STYLE_PRESETS.has(styleRaw) ? styleRaw : OVERLAY_DEFAULT_STYLE
}

function getBearerToken(req) {
  const header = req.headers.authorization || ''
  if (!header.startsWith('Bearer ')) return ''
  return header.slice('Bearer '.length).trim()
}

function requireAuth(req, res, next) {
  const token = getBearerToken(req)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  if (API_TOKEN && token === API_TOKEN) {
    req.auth = { kind: 'api-token' }
    return next()
  }

  const session = userService.getSession(token)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  req.auth = { kind: 'session', token, session }
  next()
}

function validateUrl(url) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Only http and https URLs are allowed')
    }
    return parsed.href
  } catch (e) {
    throw new Error('Invalid URL: ' + e.message)
  }
}

function validateGifUrl(gifUrlRaw) {
  if (typeof gifUrlRaw !== 'string') throw new Error('gifUrl must be a string')
  const gifUrl = gifUrlRaw.trim()
  if (!gifUrl) throw new Error('gifUrl is required')
  if (gifUrl.length > STICKER_URL_MAX_LENGTH) {
    throw new Error(`gifUrl exceeds ${STICKER_URL_MAX_LENGTH} characters`)
  }

  const safeUrl = validateUrl(gifUrl)
  const parsed = new URL(safeUrl)
  const pathname = (parsed.pathname || '').toLowerCase()
  if (!pathname.endsWith('.gif')) {
    throw new Error('Only .gif files are allowed')
  }

  return safeUrl
}

function clearPeriodicRestart() {
  if (!periodicRestartTimer) return
  clearTimeout(periodicRestartTimer)
  periodicRestartTimer = null
}

function clearWatchdog() {
  if (!watchdogTimer) return
  clearInterval(watchdogTimer)
  watchdogTimer = null
}

function clearLogMaintenance() {
  if (!logMaintenanceTimer) return
  clearInterval(logMaintenanceTimer)
  logMaintenanceTimer = null
}

function runWeeklyLogMaintenance() {
  const retentionDays = parsePositive(LOG_RETENTION_DAYS, 7)
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000
  const maxLines = parsePositive(GENERAL_LOG_MAX_LINES, 100)
  const deletedRuns = logger.pruneRunLogsOlderThan(retentionMs)
  const general = logger.trimGeneralToLastLines(maxLines)
  logger.info('logs.maintenance', 'Weekly log maintenance executed', {
    retentionDays,
    deletedRunCount: deletedRuns.length,
    generalTrimmed: general.trimmed,
    generalLinesKept: general.linesKept,
  })
}

function startLogMaintenance() {
  if (logMaintenanceTimer) return
  const interval = parsePositive(LOG_MAINTENANCE_INTERVAL_MS, 7 * 24 * 60 * 60 * 1000)
  logMaintenanceTimer = setInterval(runWeeklyLogMaintenance, interval)
  logger.info('logs.maintenance.schedule', 'Weekly log maintenance scheduled', { intervalMs: interval })
}

async function restartStream(reason) {
  if (restartInProgress) return
  restartInProgress = true
  logger.warn('stream.restart.begin', 'Restarting stream', { reason })
  await sendTelegramAlert(`Reinicio de stream iniciado. Motivo: ${reason}`)
  try {
    logger.endRun(`restart-${reason}`)
    await manager.stop()
    await sleep(1200)
    logger.startRun(reason)
    await manager.start()
    logger.info('stream.restart.ok', 'Stream restarted successfully', { reason })
    await sendTelegramAlert(`Reinicio de stream exitoso. Motivo: ${reason}`)
  } catch (e) {
    logger.error('stream.restart.fail', 'Stream restart failed', { reason, error: e.message })
    await sendTelegramAlert(`FALLO reinicio de stream. Motivo: ${reason}. Error: ${e.message}`)
    logger.endRun(`restart-failed-${reason}`)
  } finally {
    restartInProgress = false
    if (shouldKeepStreaming) schedulePeriodicRestart()
  }
}

function schedulePeriodicRestart() {
  clearPeriodicRestart()
  const interval = parsePositive(STREAM_RESTART_INTERVAL_MS, 6 * 60 * 60 * 1000)
  if (!shouldKeepStreaming) return

  periodicRestartTimer = setTimeout(async () => {
    if (!shouldKeepStreaming) return
    if (manager.getStatus().status !== 'streaming') {
      logger.warn('stream.restart.skip', 'Periodic restart skipped because stream is not active')
      schedulePeriodicRestart()
      return
    }
    await restartStream('periodic-6h')
  }, interval)

  logger.info('stream.restart.schedule', 'Periodic restart scheduled', { intervalMs: interval })
}

function ensureWatchdogStarted() {
  if (watchdogTimer) return
  const interval = parsePositive(STREAM_WATCHDOG_INTERVAL_MS, 60 * 1000)
  watchdogTimer = setInterval(async () => {
    if (!shouldKeepStreaming || restartInProgress) return
    const { status } = manager.getStatus()
    if (status === 'streaming' || status === 'starting') return
    logger.warn('stream.watchdog', 'Watchdog detected non-streaming state, attempting recovery', { status })
    await sendTelegramAlert(`Watchdog detectó estado ${status}. Intentando recuperación automática.`)
    await restartStream('watchdog-recovery')
  }, interval)
  logger.info('stream.watchdog.start', 'Watchdog started', { intervalMs: interval })
}

async function startStreaming(reason) {
  const createdRun = !logger.getCurrentRun()
  if (createdRun) logger.startRun(reason)
  try {
    await manager.start()
    shouldKeepStreaming = true
    ensureWatchdogStarted()
    schedulePeriodicRestart()
    logger.info('stream.start.request', 'Stream started', { reason })
    await sendTelegramAlert(`Stream iniciado. Motivo: ${reason}`)
  } catch (e) {
    if (createdRun) logger.endRun(`start-failed-${reason}`)
    await sendTelegramAlert(`FALLO al iniciar stream. Motivo: ${reason}. Error: ${e.message}`)
    throw e
  }
}

async function stopStreaming(reason) {
  shouldKeepStreaming = false
  clearPeriodicRestart()
  await manager.stop()
  logger.endRun(reason)
  logger.info('stream.stop.request', 'Stream stopped', { reason })
  await sendTelegramAlert(`Stream detenido. Motivo: ${reason}`)
}

function getLatestLogSource() {
  const currentRun = logger.getCurrentRun()
  if (currentRun?.filePath) {
    return { kind: 'run', runId: currentRun.id, filePath: currentRun.filePath, fileName: currentRun.fileName }
  }
  const latestRun = logger.getLatestRun()
  if (latestRun?.filePath) {
    return { kind: 'run', runId: latestRun.id, filePath: latestRun.filePath, fileName: latestRun.fileName }
  }
  return { kind: 'general', filePath: logger.getGeneralLogPath(), fileName: 'general.log' }
}

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' })

  try {
    const session = await userService.login(username, password)
    if (!session) return res.status(401).json({ error: 'Invalid credentials' })
    logger.info('auth.login.ok', 'User logged in', { username })
    res.json({ ok: true, token: session.token, user: session.user, expiresAt: session.expiresAt })
  } catch (e) {
    logger.error('auth.login.fail', 'Login failed', { username, error: e.message })
    res.status(500).json({ error: e.message })
  }
})

// GET /auth/session
app.get('/auth/session', requireAuth, (req, res) => {
  if (req.auth.kind === 'api-token') return res.json({ ok: true, kind: 'api-token', user: 'api-token' })
  res.json({ ok: true, kind: 'session', user: req.auth.session.user, expiresAt: req.auth.session.expiresAt })
})

// POST /auth/logout
app.post('/auth/logout', requireAuth, (req, res) => {
  if (req.auth.kind === 'session') {
    userService.logout(req.auth.token)
    logger.info('auth.logout', 'User logged out', { username: req.auth.session.user })
  }
  res.json({ ok: true })
})

// GET /status
app.get('/status', requireAuth, (req, res) => {
  const now = Date.now()
  if (overlay.visible && overlay.expiresAt && overlay.expiresAt <= now) {
    hideOverlayState(now)
    clearOverlayTimer()
  }
  res.json({ ...manager.getStatus(), ...playlist.getState(), audio: manager.getAudioStatus(), overlay: getOverlayState() })
})

// POST /stream/start
app.post('/stream/start', requireAuth, async (req, res) => {
  try {
    await startStreaming('api')
    res.json({ ok: true, ...manager.getStatus() })
  } catch (e) {
    logger.error('stream.start.api.fail', 'API start failed', { error: e.message })
    res.status(400).json({ error: e.message })
  }
})

// POST /stream/stop
app.post('/stream/stop', requireAuth, async (req, res) => {
  try {
    await stopStreaming('api')
    res.json({ ok: true, ...manager.getStatus() })
  } catch (e) {
    logger.error('stream.stop.api.fail', 'API stop failed', { error: e.message })
    res.status(500).json({ error: e.message })
  }
})

// POST /switch
app.post('/switch', requireAuth, async (req, res) => {
  const { url } = req.body || {}
  if (!url) return res.status(400).json({ error: 'url is required' })

  try {
    const safeUrl = validateUrl(url)
    await manager.switchUrl(safeUrl)
    logger.info('stream.switch.api', 'URL switched', { url: safeUrl })
    res.json({ ok: true, currentUrl: safeUrl })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// POST /playlist/items
app.post('/playlist/items', requireAuth, (req, res) => {
  const { url, duracionSegundos } = req.body || {}
  if (!url) return res.status(400).json({ error: 'url es requerida' })
  const dur = Number(duracionSegundos)
  if (!dur || dur < 5) return res.status(400).json({ error: 'duracionSegundos debe ser >= 5' })
  try {
    const safeUrl = validateUrl(url)
    const item = playlist.addItem(safeUrl, dur)
    logger.info('playlist.item.add', 'Playlist item added', { url: safeUrl, duracionSegundos: dur })
    res.json({ ok: true, item, ...playlist.getState() })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// DELETE /playlist/items/:id
app.delete('/playlist/items/:id', requireAuth, (req, res) => {
  playlist.removeItem(req.params.id)
  logger.info('playlist.item.remove', 'Playlist item removed', { id: req.params.id })
  res.json({ ok: true, ...playlist.getState() })
})

// DELETE /playlist/items (clear all)
app.delete('/playlist/items', requireAuth, (req, res) => {
  playlist.clearItems()
  logger.info('playlist.clear', 'Playlist cleared')
  res.json({ ok: true, ...playlist.getState() })
})

// POST /playlist/start
app.post('/playlist/start', requireAuth, (req, res) => {
  playlist.start()
  logger.info('playlist.start', 'Playlist started')
  res.json({ ok: true, ...playlist.getState() })
})

// POST /playlist/pause
app.post('/playlist/pause', requireAuth, (req, res) => {
  playlist.pause()
  logger.info('playlist.pause', 'Playlist paused')
  res.json({ ok: true, ...playlist.getState() })
})

// POST /playlist/stop
app.post('/playlist/stop', requireAuth, (req, res) => {
  playlist.stop()
  logger.info('playlist.stop', 'Playlist stopped')
  res.json({ ok: true, ...playlist.getState() })
})

// POST /audio/rescan
app.post('/audio/rescan', requireAuth, async (req, res) => {
  try {
    const audio = await manager.rescanAudio()
    logger.info('audio.rescan', 'Audio folder rescanned', { trackCount: audio.trackCount })
    res.json({ ok: true, audio })
  } catch (e) {
    logger.error('audio.rescan.fail', 'Audio rescan failed', { error: e.message })
    res.status(500).json({ error: e.message })
  }
})

// POST /overlay/message
app.post('/overlay/message', requireAuth, async (req, res) => {
  const textRaw = req.body?.text
  const styleRaw = req.body?.style
  if (typeof textRaw !== 'string') return res.status(400).json({ error: 'text must be a string' })
  if (styleRaw !== undefined && typeof styleRaw !== 'string') {
    return res.status(400).json({ error: 'style must be a string' })
  }

  const text = textRaw.trim()
  const textLength = Array.from(text).length
  if (!text) return res.status(400).json({ error: 'text is required' })
  if (textLength > OVERLAY_MAX_LENGTH) {
    return res.status(400).json({ error: `text exceeds ${OVERLAY_MAX_LENGTH} characters` })
  }
  if (manager.getStatus().status !== 'streaming') return res.status(409).json({ error: 'Stream is not running' })

  try {
    const now = Date.now()
    const style = normalizeOverlayStyle(styleRaw)
    setOverlayState(text, style, now)
    clearOverlayTimer()
    await manager.showOverlayMessage({ text: overlay.text, style: overlay.style, expiresAt: overlay.expiresAt })
    logger.info('overlay.show', 'Overlay message shown', { style: overlay.style, textLength })

    overlayTimer = setTimeout(async () => {
      hideOverlayState()
      try {
        await manager.clearOverlayMessage()
      } catch (e) {
        logger.warn('overlay.auto-clear.fail', 'Overlay auto-clear failed', { error: e.message })
        console.warn('[overlay] auto-clear error:', e.message)
      }
    }, OVERLAY_DURATION_MS)

    res.json({ ok: true, overlay: getOverlayState() })
  } catch (e) {
    if (e.message === 'Stream is not running') return res.status(409).json({ error: e.message })
    res.status(500).json({ error: e.message })
  }
})

// POST /overlay/clear
app.post('/overlay/clear', requireAuth, async (req, res) => {
  clearOverlayTimer()
  hideOverlayState()

  try {
    if (manager.getStatus().status === 'streaming') {
      await manager.clearOverlayMessage()
    }
    logger.info('overlay.clear', 'Overlay cleared')
    res.json({ ok: true, overlay: getOverlayState() })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /overlay/sticker
app.post('/overlay/sticker', requireAuth, async (req, res) => {
  if (manager.getStatus().status !== 'streaming') return res.status(409).json({ error: 'Stream is not running' })

  try {
    const safeGifUrl = validateGifUrl(req.body?.gifUrl)
    await manager.showGifSticker({ gifUrl: safeGifUrl })
    logger.info('sticker.show', 'Sticker launched', { gifUrl: safeGifUrl })
    res.json({ ok: true, sticker: { gifUrl: safeGifUrl } })
  } catch (e) {
    if (e.message === 'Stream is not running') return res.status(409).json({ error: e.message })
    res.status(400).json({ error: e.message })
  }
})

// GET /logs/summary
app.get('/logs/summary', requireAuth, (req, res) => {
  const currentRun = logger.getCurrentRun()
  const latestRun = logger.getLatestRun()
  const source = getLatestLogSource()
  res.json({
    ok: true,
    currentRun,
    latestRun,
    latestSource: source.kind,
    latestRunId: source.runId || null,
    generalLog: 'general.log',
    restartPolicy: {
      periodicMs: parsePositive(STREAM_RESTART_INTERVAL_MS, 6 * 60 * 60 * 1000),
      watchdogMs: parsePositive(STREAM_WATCHDOG_INTERVAL_MS, 60 * 1000),
    },
    logPolicy: {
      maintenanceMs: parsePositive(LOG_MAINTENANCE_INTERVAL_MS, 7 * 24 * 60 * 60 * 1000),
      runRetentionDays: parsePositive(LOG_RETENTION_DAYS, 7),
      generalMaxLines: parsePositive(GENERAL_LOG_MAX_LINES, 100),
    },
  })
})

// GET /logs/latest?lines=20
app.get('/logs/latest', requireAuth, (req, res) => {
  const lines = parseLinesParam(req.query.lines, 20)
  const source = getLatestLogSource()
  const tail = logger.tailFile(source.filePath, lines)
  res.json({
    ok: true,
    source: source.kind,
    runId: source.runId || null,
    fileName: source.fileName,
    lines: tail,
  })
})

// GET /logs/latest/download
app.get('/logs/latest/download', requireAuth, (req, res) => {
  const source = getLatestLogSource()
  res.download(source.filePath, source.fileName)
})

// GET /logs/general?lines=20
app.get('/logs/general', requireAuth, (req, res) => {
  const lines = parseLinesParam(req.query.lines, 20)
  const filePath = logger.getGeneralLogPath()
  const tail = logger.tailFile(filePath, lines)
  res.json({ ok: true, fileName: 'general.log', lines: tail })
})

// GET /logs/general/download
app.get('/logs/general/download', requireAuth, (req, res) => {
  const filePath = logger.getGeneralLogPath()
  res.download(filePath, 'general.log')
})

// GET /logs/runs?limit=30
app.get('/logs/runs', requireAuth, (req, res) => {
  const limit = parseLinesParam(req.query.limit, 30)
  const runs = logger.listRuns(limit)
  res.json({ ok: true, runs })
})

// GET /logs/runs/:runId?lines=20
app.get('/logs/runs/:runId', requireAuth, (req, res) => {
  const filePath = logger.resolveRunPath(req.params.runId)
  if (!filePath) return res.status(404).json({ error: 'Run log not found' })
  const lines = parseLinesParam(req.query.lines, 20)
  const tail = logger.tailFile(filePath, lines)
  res.json({ ok: true, runId: req.params.runId, fileName: path.basename(filePath), lines: tail })
})

// GET /logs/runs/:runId/download
app.get('/logs/runs/:runId/download', requireAuth, (req, res) => {
  const filePath = logger.resolveRunPath(req.params.runId)
  if (!filePath) return res.status(404).json({ error: 'Run log not found' })
  res.download(filePath, path.basename(filePath))
})

// Graceful shutdown so Xvfb/FFmpeg are cleaned up on PM2 restart
async function shutdown() {
  logger.warn('server.shutdown', 'Shutdown signal received')
  clearOverlayTimer()
  hideOverlayState()
  clearPeriodicRestart()
  clearWatchdog()
  clearLogMaintenance()
  playlist.stop()
  await stopStreaming('shutdown').catch(() => {})
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

app.listen(PORT, () => {
  logger.info('server.listen', 'Switcher listening', { port: PORT })
  console.log(`[server] Switcher listening on port ${PORT}`)
  runWeeklyLogMaintenance()
  startLogMaintenance()

  if (process.env.DEFAULT_URL) {
    startStreaming('auto-start').catch((e) => {
      logger.error('stream.auto-start.fail', 'Auto-start failed', { error: e.message })
      console.error('[server] Auto-start failed:', e.message)
    })
  } else {
    ensureWatchdogStarted()
  }
})
