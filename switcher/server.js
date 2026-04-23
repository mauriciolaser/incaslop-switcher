import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { StreamManager } from './stream-manager.js'
import { PlaylistManager } from './playlist-manager.js'
import { UserService } from './user-service.js'

const PORT = process.env.PORT || 3000
const API_TOKEN = process.env.API_TOKEN || ''
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'

const corsOptions = { origin: ALLOWED_ORIGIN }
const app = express()

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
})

const playlist = new PlaylistManager({
  defaultUrl: DEFAULT_URL,
  onSwitch: async (url) => {
    try {
      if (manager.getStatus().status === 'streaming') await manager.switchUrl(url)
    } catch (e) {
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

function requireAuth(req, res, next) {
  const token = getBearerToken(req)
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (API_TOKEN && token === API_TOKEN) {
    req.auth = { kind: 'api-token' }
    return next()
  }

  const session = userService.getSession(token)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  req.auth = { kind: 'session', token, session }
  next()
}

function getBearerToken(req) {
  const header = req.headers['authorization'] || ''
  if (!header.startsWith('Bearer ')) return ''
  return header.slice('Bearer '.length).trim()
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

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' })
  }

  try {
    const session = await userService.login(username, password)
    if (!session) return res.status(401).json({ error: 'Invalid credentials' })
    res.json({ ok: true, token: session.token, user: session.user, expiresAt: session.expiresAt })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /auth/session
app.get('/auth/session', requireAuth, (req, res) => {
  if (req.auth.kind === 'api-token') {
    return res.json({ ok: true, kind: 'api-token', user: 'api-token' })
  }
  res.json({ ok: true, kind: 'session', user: req.auth.session.user, expiresAt: req.auth.session.expiresAt })
})

// POST /auth/logout
app.post('/auth/logout', requireAuth, (req, res) => {
  if (req.auth.kind === 'session') {
    userService.logout(req.auth.token)
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
    await manager.start()
    res.json({ ok: true, ...manager.getStatus() })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// POST /stream/stop
app.post('/stream/stop', requireAuth, async (req, res) => {
  try {
    await manager.stop()
    res.json({ ok: true, ...manager.getStatus() })
  } catch (e) {
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
    res.json({ ok: true, item, ...playlist.getState() })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// DELETE /playlist/items/:id
app.delete('/playlist/items/:id', requireAuth, (req, res) => {
  playlist.removeItem(req.params.id)
  res.json({ ok: true, ...playlist.getState() })
})

// DELETE /playlist/items (clear all)
app.delete('/playlist/items', requireAuth, (req, res) => {
  playlist.clearItems()
  res.json({ ok: true, ...playlist.getState() })
})

// POST /playlist/start
app.post('/playlist/start', requireAuth, (req, res) => {
  playlist.start()
  res.json({ ok: true, ...playlist.getState() })
})

// POST /playlist/pause
app.post('/playlist/pause', requireAuth, (req, res) => {
  playlist.pause()
  res.json({ ok: true, ...playlist.getState() })
})

// POST /playlist/stop
app.post('/playlist/stop', requireAuth, (req, res) => {
  playlist.stop()
  res.json({ ok: true, ...playlist.getState() })
})

// POST /audio/rescan
app.post('/audio/rescan', requireAuth, async (req, res) => {
  try {
    const audio = await manager.rescanAudio()
    res.json({ ok: true, audio })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /overlay/message
app.post('/overlay/message', requireAuth, async (req, res) => {
  const textRaw = req.body?.text
  const styleRaw = req.body?.style
  if (typeof textRaw !== 'string') {
    return res.status(400).json({ error: 'text must be a string' })
  }
  if (styleRaw !== undefined && typeof styleRaw !== 'string') {
    return res.status(400).json({ error: 'style must be a string' })
  }

  const text = textRaw.trim()
  const textLength = Array.from(text).length
  if (!text) return res.status(400).json({ error: 'text is required' })
  if (textLength > OVERLAY_MAX_LENGTH) {
    return res.status(400).json({ error: `text exceeds ${OVERLAY_MAX_LENGTH} characters` })
  }

  if (manager.getStatus().status !== 'streaming') {
    return res.status(409).json({ error: 'Stream is not running' })
  }

  try {
    const now = Date.now()
    const style = normalizeOverlayStyle(styleRaw)
    setOverlayState(text, style, now)
    clearOverlayTimer()
    await manager.showOverlayMessage({ text: overlay.text, style: overlay.style, expiresAt: overlay.expiresAt })

    overlayTimer = setTimeout(async () => {
      hideOverlayState()
      try {
        await manager.clearOverlayMessage()
      } catch (e) {
        console.warn('[overlay] auto-clear error:', e.message)
      }
    }, OVERLAY_DURATION_MS)

    res.json({ ok: true, overlay: getOverlayState() })
  } catch (e) {
    if (e.message === 'Stream is not running') {
      return res.status(409).json({ error: e.message })
    }
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
    res.json({ ok: true, overlay: getOverlayState() })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /overlay/sticker
app.post('/overlay/sticker', requireAuth, async (req, res) => {
  if (manager.getStatus().status !== 'streaming') {
    return res.status(409).json({ error: 'Stream is not running' })
  }

  try {
    const safeGifUrl = validateGifUrl(req.body?.gifUrl)
    await manager.showGifSticker({ gifUrl: safeGifUrl })
    res.json({ ok: true, sticker: { gifUrl: safeGifUrl } })
  } catch (e) {
    if (e.message === 'Stream is not running') {
      return res.status(409).json({ error: e.message })
    }
    res.status(400).json({ error: e.message })
  }
})

// Graceful shutdown so Xvfb/FFmpeg are cleaned up on PM2 restart
async function shutdown() {
  console.log('[server] Shutting down...')
  clearOverlayTimer()
  hideOverlayState()
  playlist.stop()
  await manager.stop().catch(() => {})
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

app.listen(PORT, () => {
  console.log(`[server] Switcher listening on port ${PORT}`)

  // Auto-start stream if DEFAULT_URL is configured
  if (process.env.DEFAULT_URL) {
    manager.start().catch((e) => console.error('[server] Auto-start failed:', e.message))
  }
})
