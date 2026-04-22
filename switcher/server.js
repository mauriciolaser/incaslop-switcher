import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { StreamManager } from './stream-manager.js'

const PORT = process.env.PORT || 3000
const API_TOKEN = process.env.API_TOKEN || ''
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'

const corsOptions = { origin: ALLOWED_ORIGIN }
const app = express()

app.use(express.json())
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))

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
  CHROMIUM_EXECUTABLE_PATH: process.env.CHROMIUM_EXECUTABLE_PATH,
  KICK_RTMP_URL: process.env.KICK_RTMP_URL,
  KICK_STREAM_KEY: process.env.KICK_STREAM_KEY,
})

function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || ''
  const token = header.replace('Bearer ', '')
  if (!API_TOKEN || token !== API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
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

// GET /status — public
app.get('/status', (req, res) => {
  res.json(manager.getStatus())
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

// Graceful shutdown so Xvfb/FFmpeg are cleaned up on PM2 restart
async function shutdown() {
  console.log('[server] Shutting down...')
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
