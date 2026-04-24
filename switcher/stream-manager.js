import { spawn, spawnSync } from 'child_process'
/* global process */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import puppeteer from 'puppeteer-core'
import { AudioLoopManager } from './audio-loop-manager.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STATE_FILE = path.join(__dirname, 'data', 'state.json')
const REMOTE_DEBUG_PORT = 9222
const OVERLAY_DEFAULT_STYLE = 'neon-burst'
const OVERLAY_STYLE_SET = new Set(['neon-burst', 'acid-fire', 'pixel-rave', 'cosmic-pop', 'warning-siren'])
const NOW_PLAYING_DURATION_MS = 6500
const AUDIO_TRACK_WATCH_INTERVAL_MS = 1000
const STICKER_DEFAULT_DURATION_MS = 8000
const STICKER_MAX_DURATION_MS = 45000

function normalizeOverlayStyle(style) {
  if (typeof style !== 'string') return OVERLAY_DEFAULT_STYLE
  return OVERLAY_STYLE_SET.has(style) ? style : OVERLAY_DEFAULT_STYLE
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function killProc(proc) {
  if (!proc) return
  try {
    proc.kill('SIGTERM')
    setTimeout(() => {
      try { proc.kill('SIGKILL') } catch {
        // Process may already be gone.
      }
    }, 3000)
  } catch {
    // Process may already be gone.
  }
}


export class StreamManager {
  #currentUrl = null
  #status = 'stopped'
  #xvfbProc = null
  #wmProc = null
  #chromiumProc = null
  #ffmpegProc = null
  #browser = null
  #page = null
  #startedAt = null
  #runtime = null
  #audioLoop = null
  #config = {}
  #logger = null
  #overlay = {
    visible: false,
    text: '',
    expiresAt: null,
    style: OVERLAY_DEFAULT_STYLE,
  }
  #nowPlayingOverlay = {
    visible: false,
    title: '',
    expiresAt: null,
  }
  #nowPlayingTimer = null
  #audioTrackWatcherTimer = null
  #lastAudioTrackIndex = null
  #audioTrackWatcherInFlight = false
  #audioFallbackTimer = null
  #sticker = {
    visible: false,
    stickerUrl: '',
    type: 'image',
    expiresAt: null,
    position: { topPct: 24, leftPct: 30 },
  }
  #stickerTimer = null

  constructor(config) {
    this.#config = config
    this.#logger = config.logger || null
    this.#audioLoop = new AudioLoopManager()
    this.#loadState()
  }

  #log(level, event, message, meta = {}) {
    if (level === 'error') console.error(message, meta)
    else if (level === 'warn') console.warn(message, meta)
    else console.log(message, meta)

    if (this.#logger && typeof this.#logger.log === 'function') {
      this.#logger.log(level, event, message, meta)
    }
  }

  #logPipe(event, prefix, chunk) {
    const text = chunk.toString()
    process.stdout.write(`${prefix}${text}`)
    if (!this.#logger || typeof this.#logger.debug !== 'function') return
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    for (const line of lines) {
      this.#logger.debug(event, line)
    }
  }

  #loadState() {
    try {
      const raw = fs.readFileSync(STATE_FILE, 'utf8')
      const { currentUrl } = JSON.parse(raw)
      if (currentUrl) this.#currentUrl = currentUrl
    } catch {
      // Missing state is fine on first boot.
    }
  }

  #saveState() {
    try {
      fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
      fs.writeFileSync(STATE_FILE, JSON.stringify({ currentUrl: this.#currentUrl }))
    } catch (e) {
      console.error('[state] Error saving state:', e.message)
    }
  }

  #findBin(...candidates) {
    const paths = (process.env.PATH || '/usr/bin:/usr/local/bin').split(':')
    for (const bin of candidates) {
      for (const p of paths) {
        const full = path.join(p, bin)
        try { fs.accessSync(full, fs.constants.X_OK); return full } catch {
          // Try the next PATH candidate.
        }
      }
    }
    return null
  }

  getStatus() {
    return {
      status: this.#status,
      currentUrl: this.#currentUrl,
      uptimeSeconds: this.#startedAt ? Math.floor((Date.now() - this.#startedAt) / 1000) : 0,
    }
  }

  getAudioStatus() {
    return this.#audioLoop.getStatus({ isStreaming: this.#status === 'streaming' })
  }

  async rescanAudio() {
    this.#audioLoop.rescan()
    if (this.#status === 'streaming') {
      await this.#restartFfmpeg()
    }
    return this.getAudioStatus()
  }

  async playAudioCatalog() {
    this.#audioLoop.playCatalog()
    if (this.#status === 'streaming') await this.#restartFfmpeg()
    return this.getAudioStatus()
  }

  async playAudioPlaylist(playlist) {
    this.#audioLoop.playPlaylist(playlist)
    if (this.#status === 'streaming') await this.#restartFfmpeg()
    return this.getAudioStatus()
  }

  async muteAudio() {
    this.#audioLoop.mute()
    if (this.#status === 'streaming') await this.#restartFfmpeg()
    return this.getAudioStatus()
  }

  async stopAudio() {
    this.#audioLoop.stop()
    if (this.#status === 'streaming') await this.#restartFfmpeg()
    return this.getAudioStatus()
  }

  async archiveAudioTrack(name) {
    const track = this.#audioLoop.archiveTrack(name)
    if (this.#status === 'streaming') await this.#restartFfmpeg()
    return track
  }

  async unarchiveAudioTrack(name) {
    const track = this.#audioLoop.unarchiveTrack(name)
    if (this.#status === 'streaming') await this.#restartFfmpeg()
    return track
  }

  async start() {
    if (this.#status !== 'stopped' && this.#status !== 'error') {
      throw new Error('Stream is already running')
    }

    this.#status = 'starting'
    const { DISPLAY_NUM, STREAM_WIDTH, STREAM_HEIGHT, CHROMIUM_EXECUTABLE_PATH,
      KICK_RTMP_URL, KICK_STREAM_KEY, STREAM_FPS } = this.#config

    const display = DISPLAY_NUM || ':99'
    const w = STREAM_WIDTH || '1920'
    const h = STREAM_HEIGHT || '1080'
    const fps = STREAM_FPS || '30'
    const rtmpTarget = `${KICK_RTMP_URL}/${KICK_STREAM_KEY}`
    const url = this.#currentUrl || 'about:blank'

    const chromiumBin = CHROMIUM_EXECUTABLE_PATH
      || this.#findBin('chromium-browser', 'chromium', 'google-chrome')
    if (!chromiumBin) throw new Error('Chromium executable not found')

    const env = {
      ...process.env,
      DISPLAY: display,
    }
    this.#runtime = { display, w, h, fps, rtmpTarget, env }

    try {
      // 1. Kill stale processes
      try { spawn('pkill', ['-f', `Xvfb ${display}`], { stdio: 'ignore' }) } catch {
        // Stale process cleanup is best-effort.
      }
      await sleep(500)

      // 2. Start Xvfb
      this.#xvfbProc = spawn('Xvfb', [
        display, '-screen', '0', `${w}x${h}x24`, '-nolisten', 'tcp'
      ], { stdio: 'ignore', env })

      this.#xvfbProc.on('error', (e) => console.error('[xvfb] error:', e.message))
      this.#xvfbProc.on('close', (code) => {
        if (this.#status === 'streaming') {
          this.#log('error', 'xvfb.close', '[xvfb] exited unexpectedly', { code })
          this.#status = 'error'
        }
      })
      await sleep(1500)

      // 3. Start window manager (needed for Chromium to render JS properly)
      const wmBin = this.#findBin('fluxbox', 'openbox', 'twm', 'icewm')
      if (wmBin) {
        this.#wmProc = spawn(wmBin, [], { stdio: 'ignore', env })
        this.#wmProc.on('error', (e) => this.#log('error', 'wm.error', '[wm] error', { error: e.message }))
        await sleep(1000)
        this.#log('info', 'wm.start', '[wm] Started', { wmBin })
      } else {
        this.#log('warn', 'wm.missing', '[wm] No window manager found — JS rendering may be degraded')
      }

      // 4. Start Chromium directly (not via Puppeteer) for proper rendering
      this.#chromiumProc = spawn(chromiumBin, [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--no-first-run',
        '--disable-infobars',
        '--disable-session-crashed-bubble',
        '--disable-features=Translate,AutomationControlled,TranslateUI',
        '--ignore-gpu-blocklist',
        '--enable-webgl',
        '--enable-unsafe-swiftshader',
        '--use-gl=swiftshader',
        '--autoplay-policy=no-user-gesture-required',
        '--force-device-scale-factor=1',
        '--start-maximized',
        `--window-size=${w},${h}`,
        '--window-position=0,0',
        `--remote-debugging-port=${REMOTE_DEBUG_PORT}`,
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--kiosk',
        url,
      ], { stdio: ['ignore', 'pipe', 'pipe'], env })

      this.#chromiumProc.stderr.on('data', (d) => {
        const msg = d.toString()
        if (!msg.includes('DevTools') && !msg.includes('Xlib')) {
          this.#logPipe('chromium.stderr', '[chromium] ', d)
        }
      })
      this.#chromiumProc.on('error', (e) => this.#log('error', 'chromium.error', '[chromium] error', { error: e.message }))
      this.#chromiumProc.on('close', (code) => {
        if (this.#status === 'streaming') {
          this.#log('error', 'chromium.close', '[chromium] exited unexpectedly', { code })
          this.#status = 'error'
        }
      })

      await sleep(3000)

      // 5. Connect Puppeteer to the running Chromium via remote debugging
      this.#browser = await puppeteer.connect({
        browserURL: `http://localhost:${REMOTE_DEBUG_PORT}`,
        defaultViewport: null,
      })

      const pages = await this.#browser.pages()
      this.#page = pages[0] || await this.#browser.newPage()
      await this.#hideChromiumUI()
      await this.#syncOverlayToPage()

      // 6. Start FFmpeg (video + optional audio playlist)
      this.#audioLoop.rescan()
      await this.#startFfmpeg()

      this.#status = 'streaming'
      this.#startedAt = Date.now()
      this.#log('info', 'stream.start.ok', '[stream] Started, broadcasting', { url })

    } catch (e) {
      this.#status = 'error'
      this.#log('error', 'stream.start.fail', '[stream] Failed to start', { error: e.message })
      throw e
    }
  }

  async stop() {
    if (this.#status === 'stopped') return

    this.#status = 'stopped'
    this.#startedAt = null
    this.#clearNowPlayingTimer()
    this.#clearAudioTrackWatcher()
    this.#lastAudioTrackIndex = null
    this.#nowPlayingOverlay.visible = false
    this.#nowPlayingOverlay.title = ''
    this.#nowPlayingOverlay.expiresAt = null
    this.#clearStickerTimer()
    this.#sticker.visible = false
    this.#sticker.stickerUrl = ''
    this.#sticker.expiresAt = null

    await this.#stopFfmpeg()

    try {
      if (this.#browser) await this.#browser.disconnect()
    } catch {
      // Browser may already be disconnected during shutdown.
    }
    this.#browser = null
    this.#page = null

    killProc(this.#chromiumProc)
    this.#chromiumProc = null

    killProc(this.#wmProc)
    this.#wmProc = null

    killProc(this.#xvfbProc)
    this.#xvfbProc = null
    this.#runtime = null

    this.#log('info', 'stream.stop', '[stream] Stopped')
  }

  async #hideChromiumUI() {
    try {
      await this.#page.addStyleTag({
        content: `
          #g-bar, .translate-popup, [id*="translate"], [class*="translate"],
          .language-options, .infobars-container { display: none !important; }
        `
      })
    } catch {
      // Chromium UI hiding is best-effort.
    }
  }

  async #syncOverlayToPage() {
    if (!this.#page) return

    const now = Date.now()
    const stillVisible = this.#overlay.visible
      && this.#overlay.expiresAt
      && this.#overlay.expiresAt > now

    if (!stillVisible) {
      this.#overlay.visible = false
      this.#overlay.text = ''
      this.#overlay.expiresAt = null
    }

    await this.#page.evaluate(async ({ visible, text, style }) => {
      const STYLE_ID = 'incaslop-overlay-style'
      const ROOT_ID = 'incaslop-overlay-root'
      const CARD_ID = 'incaslop-overlay-card'
      const TEXT_ID = 'incaslop-overlay-text'
      const SHAPES_ID = 'incaslop-overlay-shapes'
      const TWEMOJI_SCRIPT_ID = 'incaslop-twemoji-script'
      const TWEMOJI_SRC = 'https://cdn.jsdelivr.net/npm/twemoji@14.0.2/dist/twemoji.min.js'

      let styleEl = document.getElementById(STYLE_ID)
      if (!styleEl) {
        styleEl = document.createElement('style')
        styleEl.id = STYLE_ID
        styleEl.textContent = `
          #${ROOT_ID} {
            position: fixed;
            inset: 0;
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 2147483647;
            pointer-events: none;
            padding: 38px;
          }
          #${CARD_ID} {
            position: relative;
            max-width: min(1280px, 92vw);
            border-radius: 24px;
            border: 3px solid #ffffff;
            padding: 26px 34px;
            overflow: hidden;
            isolation: isolate;
            transform-origin: center;
            animation: incaslop-float 3.2s ease-in-out infinite;
          }
          #${SHAPES_ID} {
            position: absolute;
            inset: 0;
            overflow: hidden;
            z-index: 0;
          }
          #${SHAPES_ID} span {
            position: absolute;
            display: block;
            border-radius: 999px;
            opacity: 0.8;
            filter: blur(2px);
            mix-blend-mode: screen;
          }
          #${TEXT_ID} {
            position: relative;
            z-index: 2;
            color: #f8fafc;
            text-align: center;
            font-size: 56px;
            font-weight: 800;
            line-height: 1.18;
            font-family: "Segoe UI", "Noto Sans", "DejaVu Sans", "Noto Color Emoji", "Segoe UI Emoji", "Apple Color Emoji", sans-serif;
            letter-spacing: 0.01em;
            text-shadow: 0 2px 14px rgba(0, 0, 0, 0.55);
            white-space: pre-wrap;
            overflow-wrap: anywhere;
          }
          #${TEXT_ID} img.emoji {
            height: 1em;
            width: 1em;
            margin: 0 0.04em;
            vertical-align: -0.1em;
          }
          @media (max-width: 1400px) {
            #${TEXT_ID} {
              font-size: 44px;
            }
          }
          @keyframes incaslop-float {
            0%, 100% { transform: translateY(0px) scale(1); }
            50% { transform: translateY(-4px) scale(1.01); }
          }
          @keyframes incaslop-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes incaslop-pulse {
            0%, 100% { transform: scale(1); opacity: 0.84; }
            50% { transform: scale(1.14); opacity: 0.42; }
          }
          @keyframes incaslop-flicker {
            0%, 100% { opacity: 1; }
            15% { opacity: 0.88; }
            18% { opacity: 0.56; }
            22% { opacity: 1; }
            52% { opacity: 0.72; }
          }

          #${ROOT_ID}[data-style="neon-burst"] #${CARD_ID} {
            background: radial-gradient(circle at 20% 18%, rgba(236,72,153,0.4), transparent 46%),
                        radial-gradient(circle at 80% 80%, rgba(14,165,233,0.36), transparent 50%),
                        linear-gradient(140deg, #0b1022, #161135 52%, #180b2e);
            border-color: #f9a8d4;
            box-shadow: 0 0 0 5px rgba(236,72,153,0.24), 0 0 90px rgba(56,189,248,0.46);
          }
          #${ROOT_ID}[data-style="neon-burst"] #${TEXT_ID} {
            color: #fdf4ff;
            text-shadow: 0 0 16px rgba(244,114,182,0.8), 0 0 30px rgba(56,189,248,0.62);
          }

          #${ROOT_ID}[data-style="acid-fire"] #${CARD_ID} {
            background: conic-gradient(from 210deg at 50% 50%, #2e1065, #9333ea, #f97316, #facc15, #2e1065);
            border-color: #facc15;
            box-shadow: 0 0 0 5px rgba(250,204,21,0.23), 0 0 85px rgba(249,115,22,0.52);
            animation: incaslop-float 3.2s ease-in-out infinite, incaslop-flicker 1.4s linear infinite;
          }
          #${ROOT_ID}[data-style="acid-fire"] #${TEXT_ID} {
            color: #fff8d6;
            text-shadow: 0 2px 10px rgba(96,34,180,0.65), 0 0 26px rgba(249,115,22,0.85);
          }

          #${ROOT_ID}[data-style="pixel-rave"] #${CARD_ID} {
            background:
              repeating-linear-gradient(90deg, rgba(15,23,42,0.94) 0 24px, rgba(30,41,59,0.94) 24px 48px),
              linear-gradient(135deg, #0f172a, #1e293b);
            border-color: #22d3ee;
            box-shadow: 0 0 0 5px rgba(34,211,238,0.24), 0 0 90px rgba(16,185,129,0.44);
          }
          #${ROOT_ID}[data-style="pixel-rave"] #${TEXT_ID} {
            color: #ccfbf1;
            letter-spacing: 0.03em;
            text-transform: uppercase;
            text-shadow: -2px 0 0 #0ea5e9, 2px 0 0 #10b981, 0 0 24px rgba(45,212,191,0.78);
          }

          #${ROOT_ID}[data-style="cosmic-pop"] #${CARD_ID} {
            background: radial-gradient(circle at 30% 10%, rgba(250,204,21,0.34), transparent 35%),
                        radial-gradient(circle at 70% 85%, rgba(34,197,94,0.33), transparent 42%),
                        linear-gradient(155deg, #082f49, #164e63 46%, #0f766e);
            border-color: #86efac;
            box-shadow: 0 0 0 5px rgba(134,239,172,0.2), 0 0 88px rgba(45,212,191,0.48);
          }
          #${ROOT_ID}[data-style="cosmic-pop"] #${TEXT_ID} {
            color: #ecfeff;
            text-shadow: 0 0 16px rgba(34,211,238,0.7), 0 0 30px rgba(134,239,172,0.55);
          }

          #${ROOT_ID}[data-style="warning-siren"] #${CARD_ID} {
            background: repeating-linear-gradient(-22deg, #111827 0 32px, #7f1d1d 32px 64px);
            border-color: #fca5a5;
            box-shadow: 0 0 0 5px rgba(248,113,113,0.28), 0 0 90px rgba(220,38,38,0.55);
            animation: incaslop-float 3.2s ease-in-out infinite, incaslop-flicker 1.05s linear infinite;
          }
          #${ROOT_ID}[data-style="warning-siren"] #${TEXT_ID} {
            color: #ffe4e6;
            text-shadow: 0 0 14px rgba(248,113,113,0.9), 0 0 28px rgba(185,28,28,0.88);
          }
        `
        document.head.appendChild(styleEl)
      }

      let root = document.getElementById(ROOT_ID)
      if (!root) {
        root = document.createElement('div')
        root.id = ROOT_ID
        const card = document.createElement('div')
        card.id = CARD_ID
        const shapes = document.createElement('div')
        shapes.id = SHAPES_ID
        for (let i = 0; i < 4; i += 1) {
          const bubble = document.createElement('span')
          bubble.className = `shape-${i + 1}`
          shapes.appendChild(bubble)
        }
        const textEl = document.createElement('div')
        textEl.id = TEXT_ID
        card.appendChild(shapes)
        card.appendChild(textEl)
        root.appendChild(card)
        document.body.appendChild(root)
      }

      const textEl = document.getElementById(TEXT_ID)
      const shapes = document.querySelectorAll(`#${SHAPES_ID} span`)
      const palette = {
        'neon-burst': ['#f472b6', '#38bdf8', '#c084fc', '#fb7185'],
        'acid-fire': ['#facc15', '#f97316', '#fb7185', '#c084fc'],
        'pixel-rave': ['#22d3ee', '#10b981', '#0ea5e9', '#67e8f9'],
        'cosmic-pop': ['#86efac', '#22d3ee', '#fde047', '#2dd4bf'],
        'warning-siren': ['#fca5a5', '#f87171', '#ef4444', '#fb7185'],
      }
      const activePalette = palette[style] || palette['neon-burst']
      shapes.forEach((shape, index) => {
        const size = 84 + (index * 44)
        const positions = [
          { top: '-16%', left: '-8%' },
          { top: '62%', left: '74%' },
          { top: '68%', left: '-6%' },
          { top: '-20%', left: '78%' },
        ]
        shape.style.width = `${size}px`
        shape.style.height = `${size}px`
        shape.style.top = positions[index].top
        shape.style.left = positions[index].left
        shape.style.background = activePalette[index]
        shape.style.animation = `incaslop-pulse ${1.3 + index * 0.25}s ease-in-out infinite`
      })
      if (textEl) textEl.textContent = visible ? (text || '') : ''
      root.style.display = visible ? 'flex' : 'none'
      root.dataset.style = style || 'neon-burst'

      async function ensureTwemoji() {
        if (window.twemoji) return true

        let script = document.getElementById(TWEMOJI_SCRIPT_ID)
        if (!script) {
          script = document.createElement('script')
          script.id = TWEMOJI_SCRIPT_ID
          script.src = TWEMOJI_SRC
          script.async = true
          document.head.appendChild(script)
        }

        await new Promise((resolve) => {
          if (window.twemoji) return resolve()
          const done = () => resolve()
          script.addEventListener('load', done, { once: true })
          script.addEventListener('error', done, { once: true })
          setTimeout(done, 2500)
        })

        return Boolean(window.twemoji)
      }

      if (visible && textEl && text && await ensureTwemoji()) {
        window.twemoji.parse(textEl, {
          folder: 'svg',
          ext: '.svg',
        })
      }
    }, {
      visible: stillVisible,
      text: this.#overlay.text || '',
      style: normalizeOverlayStyle(this.#overlay.style),
    })

    await this.#syncNowPlayingOverlayToPage()
    await this.#syncStickerToPage()
  }

  async #syncNowPlayingOverlayToPage() {
    if (!this.#page) return

    const now = Date.now()
    const stillVisible = this.#nowPlayingOverlay.visible
      && this.#nowPlayingOverlay.expiresAt
      && this.#nowPlayingOverlay.expiresAt > now

    if (!stillVisible) {
      this.#nowPlayingOverlay.visible = false
      this.#nowPlayingOverlay.title = ''
      this.#nowPlayingOverlay.expiresAt = null
    }

    await this.#page.evaluate(({ visible, title }) => {
      const STYLE_ID = 'incaslop-nowplaying-style'
      const ROOT_ID = 'incaslop-nowplaying-root'
      const CARD_ID = 'incaslop-nowplaying-card'
      const LABEL_ID = 'incaslop-nowplaying-label'
      const TITLE_ID = 'incaslop-nowplaying-title'
      const GLOW_ID = 'incaslop-nowplaying-glow'

      let styleEl = document.getElementById(STYLE_ID)
      if (!styleEl) {
        styleEl = document.createElement('style')
        styleEl.id = STYLE_ID
        styleEl.textContent = `
          #${ROOT_ID} {
            position: fixed;
            left: 34px;
            top: 50%;
            transform: translateY(-50%);
            z-index: 2147483647;
            pointer-events: none;
            display: none;
          }
          #${CARD_ID} {
            position: relative;
            width: min(560px, 40vw);
            border-radius: 22px;
            border: 2px solid rgba(255,255,255,0.68);
            padding: 18px 24px;
            background:
              radial-gradient(circle at 12% 8%, rgba(56,189,248,0.24), transparent 34%),
              radial-gradient(circle at 90% 94%, rgba(167,139,250,0.3), transparent 38%),
              linear-gradient(130deg, rgba(15,23,42,0.94), rgba(30,41,59,0.95));
            box-shadow: 0 0 0 3px rgba(59,130,246,0.22), 0 18px 48px rgba(2,6,23,0.72);
            overflow: hidden;
            animation: incaslop-nowplaying-enter 380ms cubic-bezier(0.2, 0.7, 0.2, 1), incaslop-nowplaying-float 3.4s ease-in-out infinite;
          }
          #${GLOW_ID} {
            position: absolute;
            inset: -35% auto auto -20%;
            width: 65%;
            height: 150%;
            background: linear-gradient(90deg, rgba(56,189,248,0.58), rgba(59,130,246,0.1));
            filter: blur(26px);
            opacity: 0.48;
            transform: rotate(-16deg);
            pointer-events: none;
          }
          #${LABEL_ID} {
            position: relative;
            font-family: "Segoe UI", "Noto Sans", "DejaVu Sans", "Noto Color Emoji", "Segoe UI Emoji", "Apple Color Emoji", sans-serif;
            font-size: 14px;
            line-height: 1;
            font-weight: 700;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: #7dd3fc;
            margin-bottom: 9px;
            text-shadow: 0 0 14px rgba(56,189,248,0.45);
          }
          #${TITLE_ID} {
            position: relative;
            font-family: "Segoe UI", "Noto Sans", "DejaVu Sans", "Noto Color Emoji", "Segoe UI Emoji", "Apple Color Emoji", sans-serif;
            font-size: 35px;
            line-height: 1.15;
            font-weight: 900;
            letter-spacing: 0.01em;
            color: #f8fafc;
            text-wrap: balance;
            overflow-wrap: anywhere;
            text-shadow: 0 3px 18px rgba(15,23,42,0.74);
          }
          @keyframes incaslop-nowplaying-enter {
            from { opacity: 0; filter: blur(4px); }
            to { opacity: 1; filter: blur(0); }
          }
          @keyframes incaslop-nowplaying-float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-4px); }
          }
          @media (max-width: 1500px) {
            #${CARD_ID} {
              width: min(510px, 44vw);
            }
            #${TITLE_ID} {
              font-size: 30px;
            }
          }
        `
        document.head.appendChild(styleEl)
      }

      let root = document.getElementById(ROOT_ID)
      if (!root) {
        root = document.createElement('div')
        root.id = ROOT_ID

        const card = document.createElement('div')
        card.id = CARD_ID

        const glow = document.createElement('div')
        glow.id = GLOW_ID
        card.appendChild(glow)

        const label = document.createElement('div')
        label.id = LABEL_ID
        label.textContent = 'Ahora suena'
        card.appendChild(label)

        const titleEl = document.createElement('div')
        titleEl.id = TITLE_ID
        card.appendChild(titleEl)

        root.appendChild(card)
        document.body.appendChild(root)
      }

      const titleEl = document.getElementById(TITLE_ID)
      if (titleEl) titleEl.textContent = visible ? (title || '') : ''
      root.style.display = visible ? 'block' : 'none'
    }, {
      visible: stillVisible,
      title: this.#nowPlayingOverlay.title || '',
    })
  }

  async #syncStickerToPage() {
    if (!this.#page) return

    const now = Date.now()
    const stillVisible = this.#sticker.visible
      && this.#sticker.expiresAt
      && this.#sticker.expiresAt > now
      && this.#sticker.stickerUrl

    if (!stillVisible) {
      this.#sticker.visible = false
      this.#sticker.stickerUrl = ''
      this.#sticker.expiresAt = null
    }

    await this.#page.evaluate(({ visible, stickerUrl, topPct, leftPct }) => {
      const STYLE_ID = 'incaslop-sticker-style'
      const ROOT_ID = 'incaslop-sticker-root'
      const IMG_ID = 'incaslop-sticker-img'

      let styleEl = document.getElementById(STYLE_ID)
      if (!styleEl) {
        styleEl = document.createElement('style')
        styleEl.id = STYLE_ID
        styleEl.textContent = `
          #${ROOT_ID} {
            position: fixed;
            z-index: 2147483646;
            pointer-events: none;
            display: none;
            width: auto;
            max-width: min(400px, 38vw);
            max-height: 40vh;
            transform: translate(-50%, -50%);
            filter: drop-shadow(0 12px 32px rgba(2, 6, 23, 0.62));
            animation: incaslop-sticker-pop 320ms cubic-bezier(0.22, 0.7, 0.19, 1);
          }
          #${IMG_ID} {
            display: block;
            max-width: min(400px, 38vw);
            height: auto;
            max-height: 40vh;
            object-fit: contain;
          }
          @keyframes incaslop-sticker-pop {
            from { opacity: 0; transform: translate(-50%, -50%) scale(0.82) rotate(-4deg); }
            to { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
          }
          @media (max-width: 1200px) {
            #${ROOT_ID} {
              max-width: min(320px, 58vw);
            }
            #${IMG_ID} {
              max-width: min(320px, 58vw);
            }
          }
        `
        document.head.appendChild(styleEl)
      }

      let root = document.getElementById(ROOT_ID)
      if (!root) {
        root = document.createElement('div')
        root.id = ROOT_ID
        const img = document.createElement('img')
        img.id = IMG_ID
        img.alt = ''
        img.decoding = 'async'
        root.appendChild(img)
        document.body.appendChild(root)
      }

      const img = document.getElementById(IMG_ID)
      root.style.top = `${topPct}%`
      root.style.left = `${leftPct}%`

      if (!visible || !stickerUrl) {
        root.style.display = 'none'
        if (img) img.removeAttribute('src')
        return
      }

      if (img && img.getAttribute('src') !== stickerUrl) {
        img.setAttribute('src', stickerUrl)
      }
      root.style.display = 'block'
    }, {
      visible: stillVisible,
      stickerUrl: this.#sticker.stickerUrl,
      topPct: this.#sticker.position.topPct,
      leftPct: this.#sticker.position.leftPct,
    })
  }

  async showOverlayMessage({ text, expiresAt, style }) {
    if (!this.#page) throw new Error('Stream is not running')

    this.#overlay.visible = true
    this.#overlay.text = text
    this.#overlay.expiresAt = expiresAt
    this.#overlay.style = normalizeOverlayStyle(style)
    await this.#syncOverlayToPage()
  }

  async clearOverlayMessage() {
    this.#overlay.visible = false
    this.#overlay.text = ''
    this.#overlay.expiresAt = null
    this.#overlay.style = OVERLAY_DEFAULT_STYLE
    await this.#syncOverlayToPage()
  }

  #clearStickerTimer() {
    if (!this.#stickerTimer) return
    clearTimeout(this.#stickerTimer)
    this.#stickerTimer = null
  }

  #pickStickerPosition() {
    return {
      topPct: 18 + Math.round(Math.random() * 64),
      leftPct: 18 + Math.round(Math.random() * 64),
    }
  }

  #probeGifDurationMs(gifUrl) {
    try {
      const result = spawnSync(
        'ffprobe',
        [
          '-v', 'error',
          '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1',
          gifUrl,
        ],
        { encoding: 'utf8', timeout: 4000 },
      )
      if (result.status !== 0) return null
      const seconds = Number((result.stdout || '').trim())
      if (!Number.isFinite(seconds) || seconds <= 0) return null
      return Math.round(seconds * 1000)
    } catch {
      return null
    }
  }

  #resolveStickerDurationMs(stickerUrl, type = 'image') {
    const probed = type === 'gif' ? this.#probeGifDurationMs(stickerUrl) : null
    const fallback = STICKER_DEFAULT_DURATION_MS
    const raw = probed || fallback
    return Math.min(STICKER_MAX_DURATION_MS, Math.max(1200, raw))
  }

  async showSticker({ stickerUrl, type = 'image' }) {
    if (!this.#page) throw new Error('Stream is not running')

    const durationMs = this.#resolveStickerDurationMs(stickerUrl, type)
    const now = Date.now()
    this.#sticker.visible = true
    this.#sticker.stickerUrl = stickerUrl
    this.#sticker.type = type
    this.#sticker.expiresAt = now + durationMs
    this.#sticker.position = this.#pickStickerPosition()
    this.#clearStickerTimer()
    await this.#syncStickerToPage()

    this.#stickerTimer = setTimeout(() => {
      this.#sticker.visible = false
      this.#sticker.stickerUrl = ''
      this.#sticker.expiresAt = null
      this.#syncStickerToPage().catch((e) => {
        console.warn('[sticker] auto-hide error:', e.message)
      })
    }, durationMs)
  }

  async showGifSticker({ gifUrl }) {
    return this.showSticker({ stickerUrl: gifUrl, type: 'gif' })
  }

  #normalizeTrackLabel(trackName) {
    if (!trackName || typeof trackName !== 'string') return 'Track desconocido'
    const noExt = trackName.replace(/\.[^.]+$/, '')
    const normalized = noExt.replace(/[_-]+/g, ' ').trim()
    return normalized || 'Track desconocido'
  }

  #clearNowPlayingTimer() {
    if (!this.#nowPlayingTimer) return
    clearTimeout(this.#nowPlayingTimer)
    this.#nowPlayingTimer = null
  }

  async #showNowPlayingModal(trackName) {
    if (!this.#page) return

    const now = Date.now()
    this.#nowPlayingOverlay.visible = true
    this.#nowPlayingOverlay.title = this.#normalizeTrackLabel(trackName)
    this.#nowPlayingOverlay.expiresAt = now + NOW_PLAYING_DURATION_MS
    this.#clearNowPlayingTimer()
    await this.#syncNowPlayingOverlayToPage()

    this.#nowPlayingTimer = setTimeout(() => {
      this.#nowPlayingOverlay.visible = false
      this.#nowPlayingOverlay.title = ''
      this.#nowPlayingOverlay.expiresAt = null
      this.#syncNowPlayingOverlayToPage().catch((e) => {
        console.warn('[now-playing] auto-hide error:', e.message)
      })
    }, NOW_PLAYING_DURATION_MS)
  }

  #clearAudioTrackWatcher() {
    if (!this.#audioTrackWatcherTimer) return
    clearInterval(this.#audioTrackWatcherTimer)
    this.#audioTrackWatcherTimer = null
    this.#audioTrackWatcherInFlight = false
  }

  #clearAudioFallbackTimer() {
    if (!this.#audioFallbackTimer) return
    clearTimeout(this.#audioFallbackTimer)
    this.#audioFallbackTimer = null
  }

  #startAudioTrackWatcher() {
    this.#clearAudioTrackWatcher()
    this.#audioTrackWatcherTimer = setInterval(() => {
      this.#checkAudioTrackChange().catch((e) => {
        console.warn('[audio] track watcher error:', e.message)
      })
    }, AUDIO_TRACK_WATCH_INTERVAL_MS)
  }

  async #checkAudioTrackChange() {
    if (this.#audioTrackWatcherInFlight) return
    if (this.#status !== 'streaming' || !this.#page) return

    this.#audioTrackWatcherInFlight = true
    try {
      const audioStatus = this.#audioLoop.getStatus({ isStreaming: true })
      const track = audioStatus.currentTrack

      if (!track) {
        this.#lastAudioTrackIndex = null
        return
      }

      if (this.#lastAudioTrackIndex === null) {
        this.#lastAudioTrackIndex = track.index
        return
      }

      if (track.index !== this.#lastAudioTrackIndex) {
        this.#lastAudioTrackIndex = track.index
        await this.#showNowPlayingModal(track.name)
      }
    } finally {
      this.#audioTrackWatcherInFlight = false
    }
  }

  async switchUrl(url) {
    if (!this.#page) throw new Error('Stream is not running')

    await this.#page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
    await this.#hideChromiumUI()
    await this.#syncOverlayToPage()
    this.#currentUrl = url
    this.#saveState()
    this.#log('info', 'stream.switch', '[stream] Switched URL', { url })
  }

  async #restartFfmpeg() {
    if (!this.#runtime) return
    await this.#stopFfmpeg()
    await this.#startFfmpeg()
    this.#log('info', 'audio.ffmpeg.restart', '[audio] FFmpeg reiniciado para aplicar cambios de playlist')
  }

  async #stopFfmpeg() {
    const proc = this.#ffmpegProc
    if (!proc) return

    proc.__intentionalStop = true
    this.#ffmpegProc = null
    this.#clearAudioTrackWatcher()
    this.#clearAudioFallbackTimer()
    this.#lastAudioTrackIndex = null
    this.#clearStickerTimer()
    this.#sticker.visible = false
    this.#sticker.stickerUrl = ''
    this.#sticker.expiresAt = null
    this.#audioLoop.clearLoopStart()

    await new Promise((resolve) => {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        resolve()
      }
      proc.once('close', finish)
      killProc(proc)
      setTimeout(finish, 4000)
    })
  }

  async #startFfmpeg() {
    if (!this.#runtime) throw new Error('Runtime de stream no inicializado')

    const audio = this.#audioLoop.getStatus({ isStreaming: false })
    const { display, w, h, fps, rtmpTarget, env } = this.#runtime
    const { VIDEO_BITRATE, MAXRATE, BUFSIZE, GOP, PRESET, AUDIO_BITRATE } = this.#config

    const ffmpegArgs = [
      '-f', 'x11grab',
      '-framerate', fps,
      '-video_size', `${w}x${h}`,
      '-i', `${display}.0`,
    ]

    if (audio.enabled) {
      ffmpegArgs.push(
        '-stream_loop', '-1',
        '-f', 'concat',
        '-safe', '0',
        '-i', this.#audioLoop.getPlaylistFile(),
      )
    }

    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-preset', PRESET || 'veryfast',
      '-b:v', VIDEO_BITRATE || '4500k',
      '-maxrate', MAXRATE || '4500k',
      '-bufsize', BUFSIZE || '9000k',
      '-pix_fmt', 'yuv420p',
      '-g', GOP || '60',
    )

    if (audio.enabled) {
      ffmpegArgs.push(
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:a', 'aac',
        '-b:a', AUDIO_BITRATE || '192k',
        '-ar', '44100',
        '-ac', '2',
      )
      this.#audioLoop.markLoopStart()
      const initialTrack = this.#audioLoop.getStatus({ isStreaming: true }).currentTrack
      this.#lastAudioTrackIndex = initialTrack?.index ?? null
      this.#startAudioTrackWatcher()
      this.#scheduleAudioFallbackIfNeeded(audio)
      console.log(`[audio] Loop activo con ${audio.trackCount} pista(s)`)
    } else {
      ffmpegArgs.push('-an')
      this.#clearAudioTrackWatcher()
      this.#lastAudioTrackIndex = null
      this.#audioLoop.clearLoopStart()
      for (const warning of audio.warnings) {
        console.warn('[audio]', warning)
      }
    }

    ffmpegArgs.push('-f', 'flv', rtmpTarget)

    const proc = spawn('ffmpeg', ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'], env })
    this.#ffmpegProc = proc

    proc.stderr.removeAllListeners('data')
    proc.stderr.on('data', (d) => this.#logPipe('ffmpeg.stderr', '[ffmpeg] ', d))
    proc.on('error', (e) => this.#log('error', 'ffmpeg.error', '[ffmpeg] error', { error: e.message }))
    proc.on('close', (code) => {
      if (proc.__intentionalStop) return
      if (this.#status === 'streaming') {
        this.#log('error', 'ffmpeg.close', '[ffmpeg] exited unexpectedly', { code })
        this.#status = 'error'
      }
    })
  }

  #scheduleAudioFallbackIfNeeded(audio) {
    this.#clearAudioFallbackTimer()
    if (audio.mode !== 'playlist' || audio.repeat || !audio.finiteDurationSec) return
    const delayMs = Math.max(1000, Math.ceil(audio.finiteDurationSec * 1000))
    this.#audioFallbackTimer = setTimeout(async () => {
      try {
        this.#audioLoop.playCatalog()
        if (this.#status === 'streaming') await this.#restartFfmpeg()
        this.#log('info', 'audio.playlist.fallback', '[audio] Playlist terminada, volviendo al catalogo')
      } catch (e) {
        this.#log('warn', 'audio.playlist.fallback.fail', '[audio] No se pudo volver al catalogo', { error: e.message })
      }
    }, delayMs)
  }
}
